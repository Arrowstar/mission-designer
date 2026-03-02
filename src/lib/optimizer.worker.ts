// ============================================================
// Optimization Web Worker
// Runs nlopt-js in a background thread to prevent UI blocking
// ============================================================

import {
    Mission,
    OptimizationConfig,
    OptimizationIteration,
    OptimizationResult,
    TrajectoryResult,
} from './types';
import { propagateSpacecraft } from './propagator';
import { cartesianToKeplerian, muForFrame, radiusForFrame, computeStateQuantity } from './orbitalMechanics';
import { scaleVariable, unscaleVariable } from './optimizationScaling';

/**
 * Resolve a dot-path into a mission object to get/set values.
 * E.g. "spacecraft[0].segments[1].termination.duration"
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
function getByPath(obj: any, path: string): any {
    const keys = path.replace(/\[(\d+)\]/g, '.$1').split('.');
    let current = obj;
    for (const key of keys) {
        current = current[key];
    }
    return current;
}

function setByPath(obj: any, path: string, value: any): void {
    const keys = path.replace(/\[(\d+)\]/g, '.$1').split('.');
    let current = obj;
    for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Deep clone a mission (used to mutate per-iteration without side effects).
 */
function cloneMission(mission: Mission): Mission {
    return JSON.parse(JSON.stringify(mission));
}

/**
 * Get the state quantity at the end of a segment for a spacecraft.
 */
function getQuantityAtSegmentEnd(
    result: TrajectoryResult,
    segmentId: string,
    quantity: string,
    refFrame: string,
): number {
    const segResult = result.segments.find(s => s.segmentId === segmentId);
    if (!segResult || segResult.points.length === 0) return NaN;

    const lastPt = segResult.points[segResult.points.length - 1];
    return computeStateQuantity(lastPt, quantity, refFrame);
}

let stopRequested = false;

self.onmessage = async (e: MessageEvent) => {
    const { type, payload } = e.data;

    if (type === 'STOP') {
        stopRequested = true;
        return;
    }

    if (type === 'START') {
        stopRequested = false;
        const { mission, config, nVars, algorithmMap } = payload;

        const iterations: OptimizationIteration[] = [];
        let stoppedByManualCriteria = '';
        try {
            // Dynamically import nlopt-js (WASM)
            let nloptModule: any;
            try {
                const imported = await import('nlopt-js');
                nloptModule = imported.default || imported;
                await nloptModule.ready;
            } catch (err) {
                self.postMessage({
                    type: 'RESULT',
                    payload: {
                        status: 'failed',
                        iterations: [],
                        bestObjective: NaN,
                        bestVariables: [],
                        message: `Failed to load nlopt-js: ${err}`,
                    } as OptimizationResult
                });
                return;
            }

            if (nVars === 0) {
                self.postMessage({
                    type: 'RESULT',
                    payload: {
                        status: 'failed',
                        iterations: [],
                        bestObjective: NaN,
                        bestVariables: [],
                        message: 'No optimization variables defined.',
                    } as OptimizationResult
                });
                return;
            }

            let iterCount = 0;

            const algName = algorithmMap[config.algorithm] || 'LN_COBYLA';
            self.postMessage({ type: 'LOG', payload: `Starting ${algName} with nVars=${nVars}, maxEval=${config.maxIterations || 200}, ftolRel=${config.ftolRel || 1e-6}, xtolRel=${config.xtolRel || 0}` });

            const opt = new nloptModule.Optimize(nloptModule.Algorithm[algName as keyof typeof nloptModule.Algorithm], nVars);

            // Set scaled bounds [0, 1] for all variables
            const lowerBoundsScaled = Array(nVars).fill(0);
            const upperBoundsScaled = Array(nVars).fill(1);
            opt.setLowerBounds(lowerBoundsScaled);
            opt.setUpperBounds(upperBoundsScaled);

            opt.setMaxeval(config.maxIterations || 200);

            // nlopt-js only exposes setMaxeval, setMaxtime, and ftolRel via setMinObjective's 2nd arg.
            // For other criteria (xtolRel, xtolAbs, ftolAbs, stopval), we check manually in the objective fn.
            let prevX: number[] | null = null;
            let prevCost: number | null = null;

            // Objective function
            opt.setMinObjective((x: number[], grad: number[] | null) => {
                if (stopRequested || stoppedByManualCriteria !== '') {
                    if (grad) grad.fill(0);
                    return prevCost !== null ? prevCost : 1e10;
                }

                // Manual stopping criteria checks
                if (prevX) {
                    // xtolRel check
                    if (config.xtolRel && config.xtolRel > 0) {
                        let maxRelChange = 0;
                        for (let i = 0; i < nVars; i++) {
                            const denom = Math.max(Math.abs(x[i]), 1e-10);
                            const relChange = Math.abs(x[i] - prevX[i]) / denom;
                            if (relChange > maxRelChange) maxRelChange = relChange;
                        }
                        // Only stop if there WAS a change, but it was too small
                        if (maxRelChange > 0 && maxRelChange < config.xtolRel) {
                            stoppedByManualCriteria = 'xtolRel';
                            if (grad) grad.fill(0);
                            return prevCost !== null ? prevCost : 1e10;
                        }
                    }
                    // xtolAbs check
                    if (config.xtolAbs && config.xtolAbs > 0) {
                        let maxAbsChange = 0;
                        for (let i = 0; i < nVars; i++) {
                            const absChange = Math.abs(x[i] - prevX[i]);
                            if (absChange > maxAbsChange) maxAbsChange = absChange;
                        }
                        if (maxAbsChange > 0 && maxAbsChange < config.xtolAbs) {
                            stoppedByManualCriteria = 'xtolAbs';
                            if (grad) grad.fill(0);
                            return prevCost !== null ? prevCost : 1e10;
                        }
                    }
                }
                prevX = [...x];

                const testMission = cloneMission(mission);

                // Apply currently scaled variables, converting to unscaled
                for (let i = 0; i < nVars; i++) {
                    const unscaledValue = unscaleVariable(
                        x[i],
                        config.variables[i].lowerBound,
                        config.variables[i].upperBound
                    );
                    setByPath(testMission, config.variables[i].path, unscaledValue);
                }

                // Propagate all spacecraft
                const results = new Map<string, TrajectoryResult>();
                try {
                    for (const sc of testMission.spacecraft) {
                        results.set(sc.id, propagateSpacecraft(sc));
                    }
                } catch (err) {
                    const msg = err instanceof Error ? err.message : String(err);
                    self.postMessage({ type: 'LOG', payload: `Iter ${iterCount} [Objective Error]: ${msg}` });
                    // Return large penalty to discourage this region
                    return 1e10;
                }

                // Evaluate objectives
                let cost = 0;
                for (const obj of config.objectives) {
                    const result = results.get(obj.spacecraftId);
                    if (!result) continue;

                    const segRes = result.segments.find((s: any) => s.segmentId === obj.segmentId);
                    if (!segRes || segRes.points.length === 0) continue;

                    const lastPt = segRes.points[segRes.points.length - 1];

                    switch (obj.type) {
                        case 'minimizeMass':
                            // NLopt minimizes the return value
                            // To minimize mass, return mass
                            cost += obj.weight * lastPt.mass / (obj.scaleFactor || 1.0);
                            break;
                        case 'maximizeMass':
                            // To maximize mass, return -mass
                            cost += obj.weight * (-lastPt.mass) / (obj.scaleFactor || 1.0);
                            break;
                        case 'minimizeDeltaV':
                            cost += obj.weight * segRes.deltaV / (obj.scaleFactor || 1.0);
                            break;
                    }
                }

                // Numerical gradient (if needed)
                if (grad) {
                    const h = config.slsqpMaxStepSize || 1e-6;
                    for (let i = 0; i < nVars; i++) {
                        const xp = [...x];
                        xp[i] += h;
                        const testMission2 = cloneMission(mission);
                        for (let j = 0; j < nVars; j++) {
                            const unscaledValue = unscaleVariable(
                                xp[j],
                                config.variables[j].lowerBound,
                                config.variables[j].upperBound
                            );
                            setByPath(testMission2, config.variables[j].path, unscaledValue);
                        }
                        const results2 = new Map<string, TrajectoryResult>();
                        try {
                            for (const sc of testMission2.spacecraft) {
                                results2.set(sc.id, propagateSpacecraft(sc));
                            }
                        } catch (err) {
                            const msg = err instanceof Error ? err.message : String(err);
                            self.postMessage({ type: 'LOG', payload: `Iter ${iterCount} [Gradient Error]: ${msg}` });
                            grad[i] = 0;
                            continue;
                        }
                        let cost2 = 0;
                        for (const obj of config.objectives) {
                            const result = results2.get(obj.spacecraftId);
                            if (!result) continue;
                            const segRes = result.segments.find((s: any) => s.segmentId === obj.segmentId);
                            if (!segRes || segRes.points.length === 0) continue;
                            const lastPt = segRes.points[segRes.points.length - 1];
                            switch (obj.type) {
                                case 'minimizeMass': cost2 += obj.weight * lastPt.mass / (obj.scaleFactor || 1.0); break;
                                case 'maximizeMass': cost2 += obj.weight * (-lastPt.mass) / (obj.scaleFactor || 1.0); break;
                                case 'minimizeDeltaV': cost2 += obj.weight * segRes.deltaV / (obj.scaleFactor || 1.0); break;
                            }
                        }
                        const gValue = (cost2 - cost) / h;
                        grad[i] = isNaN(gValue) ? 0 : gValue;
                    }
                }

                // Evaluate constraint violations for reporting
                const violations: number[] = [];
                let maxViolation = 0;
                for (let i = 0; i < config.constraints.length; i++) {
                    const con = config.constraints[i];
                    const result = results.get(con.spacecraftId);
                    if (!result) { violations.push(NaN); continue; }

                    const val = getQuantityAtSegmentEnd(result, con.segmentId, con.quantity, con.referenceFrame);

                    let rawViolation = 0;
                    if (con.mode === 'absolute') {
                        rawViolation = val - (con.targetValue ?? 0);
                    } else {
                        const relResult = results.get(con.relativeSpacecraftId ?? '');
                        if (!relResult) { violations.push(NaN); continue; }
                        const relVal = getQuantityAtSegmentEnd(relResult, con.relativeSegmentId ?? '', con.quantity, con.referenceFrame);
                        rawViolation = val - relVal;
                    }

                    // Compute actual violation amount based on constraint type
                    // (0 means satisfied, >0 means violated by this amount)
                    let actualViolation = 0;
                    if (con.constraintType === 'equality') {
                        actualViolation = Math.max(0, Math.abs(rawViolation) - con.tolerance);
                    } else if (con.constraintType === 'inequalityLTE') {
                        actualViolation = Math.max(0, rawViolation - con.tolerance);
                    } else if (con.constraintType === 'inequalityGTE') {
                        actualViolation = Math.max(0, -rawViolation - con.tolerance); // Check if val < target - tol
                    }
                    violations.push(actualViolation);
                    if (actualViolation > maxViolation) {
                        maxViolation = actualViolation;
                    }
                }

                // Manual ftolAbs and stopval checks (must come after cost is computed)
                if (prevCost !== null) {
                    if (config.ftolAbs && config.ftolAbs > 0) {
                        const absChange = Math.abs(cost - prevCost);
                        if (absChange > 0 && absChange < config.ftolAbs) {
                            stoppedByManualCriteria = 'ftolAbs';
                            // Still record this iteration before stopping
                            const rawUnscaledVariables = Array.from<number>(x).map((val, i) =>
                                unscaleVariable(val, config.variables[i].lowerBound, config.variables[i].upperBound)
                            );
                            const iteration: OptimizationIteration = {
                                iteration: iterCount++,
                                objectiveValue: cost,
                                constraintViolations: violations,
                                maxConstraintViolation: maxViolation,
                                variables: rawUnscaledVariables,
                                activeTrajectories: Array.from(results.values()),
                            };
                            iterations.push(iteration);
                            self.postMessage({ type: 'ITERATION', payload: iteration });
                            self.postMessage({ type: 'LOG', payload: `Iter ${iteration.iteration}: obj=${cost.toExponential(4)}, maxViol=${maxViolation.toExponential(2)} [ftolAbs reached]` });
                            if (grad) grad.fill(0);
                            return cost;
                        }
                    }
                }
                if (config.stopval !== undefined && config.stopval !== null) {
                    if (cost <= config.stopval) {
                        stoppedByManualCriteria = 'stopval';
                        const rawUnscaledVariables = Array.from<number>(x).map((val, i) =>
                            unscaleVariable(val, config.variables[i].lowerBound, config.variables[i].upperBound)
                        );
                        const iteration: OptimizationIteration = {
                            iteration: iterCount++,
                            objectiveValue: cost,
                            constraintViolations: violations,
                            maxConstraintViolation: maxViolation,
                            variables: rawUnscaledVariables,
                            activeTrajectories: Array.from(results.values()),
                        };
                        iterations.push(iteration);
                        self.postMessage({ type: 'ITERATION', payload: iteration });
                        self.postMessage({ type: 'LOG', payload: `Iter ${iteration.iteration}: obj=${cost.toExponential(4)}, maxViol=${maxViolation.toExponential(2)} [stopval reached]` });
                        if (grad) grad.fill(0);
                        return cost;
                    }
                }
                prevCost = cost;

                const rawUnscaledVariables = Array.from<number>(x).map((val, i) =>
                    unscaleVariable(val, config.variables[i].lowerBound, config.variables[i].upperBound)
                );

                const iteration: OptimizationIteration = {
                    iteration: iterCount++,
                    objectiveValue: cost,
                    constraintViolations: violations,
                    maxConstraintViolation: maxViolation,
                    variables: rawUnscaledVariables,
                    activeTrajectories: Array.from(results.values()),
                };
                iterations.push(iteration);

                // POST ITERATION TO MAIN THREAD
                self.postMessage({ type: 'ITERATION', payload: iteration });

                // POST LOG LINE TO MAIN THREAD
                const logLine = `Iter ${iteration.iteration}: obj=${cost.toExponential(4)}, maxViol=${maxViolation.toExponential(2)}`;
                self.postMessage({ type: 'LOG', payload: logLine });

                return cost;
            }, config.ftolRel || 1e-6);

            // Add constraints
            for (const con of config.constraints) {
                const scaledTolerance = con.tolerance / (con.scaleFactor || 1.0);

                const constraintFn = (x: number[], grad: number[] | null) => {
                    if (stopRequested || stoppedByManualCriteria !== '') {
                        if (grad) grad.fill(0);
                        return 0; // zero violation
                    }
                    const testMission = cloneMission(mission);
                    for (let i = 0; i < nVars; i++) {
                        const unscaledValue = unscaleVariable(
                            x[i],
                            config.variables[i].lowerBound,
                            config.variables[i].upperBound
                        );
                        setByPath(testMission, config.variables[i].path, unscaledValue);
                    }
                    const results = new Map<string, TrajectoryResult>();
                    try {
                        for (const sc of testMission.spacecraft) {
                            results.set(sc.id, propagateSpacecraft(sc));
                        }
                    } catch (err) {
                        const msg = err instanceof Error ? err.message : String(err);
                        self.postMessage({ type: 'LOG', payload: `[Constraint Error]: ${msg}` });
                        return 1e10; // Large penalty
                    }

                    const result = results.get(con.spacecraftId);
                    if (!result) return 1e10;

                    const val = getQuantityAtSegmentEnd(result, con.segmentId, con.quantity, con.referenceFrame);

                    let target = con.targetValue ?? 0;
                    if (con.mode === 'relative') {
                        const relResult = results.get(con.relativeSpacecraftId ?? '');
                        if (relResult) {
                            target = getQuantityAtSegmentEnd(relResult, con.relativeSegmentId ?? '', con.quantity, con.referenceFrame);
                        }
                    }

                    let violation = val - target;
                    violation = violation / (con.scaleFactor || 1.0);

                    // Numerical gradient
                    if (grad) {
                        const h = config.slsqpMaxStepSize || 1e-6;
                        for (let i = 0; i < nVars; i++) {
                            const xp = [...x];
                            xp[i] += h;
                            const tm2 = cloneMission(mission);
                            for (let j = 0; j < nVars; j++) {
                                const unscaledValue = unscaleVariable(
                                    xp[j],
                                    config.variables[j].lowerBound,
                                    config.variables[j].upperBound
                                );
                                setByPath(tm2, config.variables[j].path, unscaledValue);
                            }
                            const r2 = new Map<string, TrajectoryResult>();
                            try {
                                for (const sc of tm2.spacecraft) {
                                    r2.set(sc.id, propagateSpacecraft(sc));
                                }
                            } catch (err) {
                                const msg = err instanceof Error ? err.message : String(err);
                                self.postMessage({ type: 'LOG', payload: `[Constraint Gradient Error]: ${msg}` });
                                grad[i] = 0;
                                continue;
                            }
                            const res2 = r2.get(con.spacecraftId);
                            const val2 = res2 ? getQuantityAtSegmentEnd(res2, con.segmentId, con.quantity, con.referenceFrame) : 1e10;
                            let target2 = con.targetValue ?? 0;
                            if (con.mode === 'relative') {
                                const relRes2 = r2.get(con.relativeSpacecraftId ?? '');
                                if (relRes2) {
                                    target2 = getQuantityAtSegmentEnd(relRes2, con.relativeSegmentId ?? '', con.quantity, con.referenceFrame);
                                }
                            }
                            const violation2 = (val2 - target2) / (con.scaleFactor || 1.0);
                            const gValue = (violation2 - violation) / h;
                            grad[i] = isNaN(gValue) ? 0 : gValue;
                        }
                    }

                    return violation;
                };

                if (con.constraintType === 'equality') {
                    opt.addEqualityConstraint(constraintFn, scaledTolerance);
                } else if (con.constraintType === 'inequalityLTE') {
                    opt.addInequalityConstraint(constraintFn, scaledTolerance);
                } else if (con.constraintType === 'inequalityGTE') {
                    // g(x) >= 0 → -g(x) <= 0
                    opt.addInequalityConstraint((x: number[], grad: number[] | null) => {
                        const result = constraintFn(x, grad);
                        if (grad) {
                            for (let i = 0; i < grad.length; i++) grad[i] = -grad[i];
                        }
                        return -result;
                    }, scaledTolerance);
                }
            }

            // Initial guess — read current values from the mission object
            const x0 = config.variables.map((v: any) => {
                const unscaledValue = getByPath(mission, v.path);
                let scaled = scaleVariable(unscaledValue, v.lowerBound, v.upperBound);
                // Clamp to [0, 1] to prevent nlopt C++ invalid_argument exceptions!
                if (scaled < 0) scaled = 0;
                if (scaled > 1) scaled = 1;
                return scaled;
            });

            // Optimize
            const result = opt.optimize(x0);

            // Apply best solution back to physical units
            const bestX = Array.from<number>(result.x).map((val: number, i: number) =>
                unscaleVariable(val, config.variables[i].lowerBound, config.variables[i].upperBound)
            );

            opt.delete(); // Free WASM memory

            // Check constraint violations on the final iteration
            // constraintViolations now stores actual violation amounts (0 = satisfied, >0 = violated)
            let finalStatus: 'converged' | 'failed' | 'stopped' = 'converged';
            let finalMsg = `Optimization converged in ${iterations.length} iterations.`;

            if (stopRequested) {
                finalStatus = 'stopped';
                finalMsg = 'Optimization stopped by user.';
            } else if (stoppedByManualCriteria !== '') {
                finalMsg = `Optimization converged (${stoppedByManualCriteria} reached) in ${iterations.length} iterations.`;
            }

            if (iterations.length > 0 && config.constraints.length > 0) {
                const finalIter = iterations[iterations.length - 1];
                const hasViolations = finalIter.maxConstraintViolation > 0 ||
                    finalIter.constraintViolations.some(v => isNaN(v));

                if (hasViolations) {
                    finalStatus = 'failed';
                    finalMsg = `Optimization stopped, but constraints are violated.`;
                }
            }

            self.postMessage({
                type: 'RESULT',
                payload: {
                    status: finalStatus,
                    iterations,
                    bestObjective: result.value,
                    bestVariables: bestX,
                    message: finalMsg,
                } as OptimizationResult
            });

        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            // msg might be changed by WASM wrapper (e.g. to "Maximum number of iterations reached")
            // so we also check if stoppedByManualCriteria was set.
            const isManualStop = msg === 'OPTIMIZATION_STOPPED' || stopRequested || stoppedByManualCriteria !== '';

            if (isManualStop) {
                // Determine if this was a convergence stop or user stop
                const isConverged = stoppedByManualCriteria !== '' && !stopRequested;
                let finalStatus: 'stopped' | 'converged' | 'failed' = isConverged ? 'converged' : 'stopped';
                let finalStatusMsg = isConverged
                    ? `Optimization converged (${stoppedByManualCriteria} reached) in ${iterations.length} iterations.`
                    : 'Optimization stopped by user.';

                if (isConverged && iterations.length > 0 && config.constraints.length > 0) {
                    const finalIter = iterations[iterations.length - 1];
                    const hasViolations = finalIter.maxConstraintViolation > 0 ||
                        finalIter.constraintViolations.some(v => isNaN(v));

                    if (hasViolations) {
                        finalStatus = 'failed';
                        finalStatusMsg = `Optimization stopped, but constraints are violated.`;
                    }
                }

                self.postMessage({
                    type: 'RESULT',
                    payload: {
                        status: finalStatus,
                        iterations: [],
                        bestObjective: NaN,
                        bestVariables: [],
                        message: finalStatusMsg,
                    } as OptimizationResult
                });
            } else {
                self.postMessage({
                    type: 'RESULT',
                    payload: {
                        status: 'failed',
                        iterations: [],
                        bestObjective: NaN,
                        bestVariables: [],
                        message: `Optimization failed: ${msg}`,
                    } as OptimizationResult
                });
            }
        }
    }
};
