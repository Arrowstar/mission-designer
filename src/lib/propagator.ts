// ============================================================
// Propagation Engine
// Uses math.js solveODE (RK45) for numerical integration
// ============================================================

// @ts-expect-error: solveODE is available in mathjs v12+ but missing from types
import { solveODE } from 'mathjs';
import {
    Spacecraft,
    Segment,
    CartesianState,
    TrajectoryPoint,
    SegmentResult,
    TrajectoryResult,
} from './types';
import { keplerianToCartesian, muForFrame } from './orbitalMechanics';
import { transformState } from './referenceFrames';
import { thrustDirectionInertial } from './controlFrames';
import {
    earthGravityAccel,
    moonGravityAccelECI,
    sunGravityAccelECI,
    moonGravityAccelMCI,
    earthGravityAccelMCI,
    sunGravityAccelSCI,
    earthGravityAccelSCI,
    moonGravityAccelSCI,
} from './gravity';

const G0 = 9.80665e-3; // km/s² — standard gravity for Isp calculations

/**
 * Build the right-hand side of the ODE for a trajectory segment.
 * State vector: [x, y, z, vx, vy, vz, mass] in km, km/s, kg
 */
export function buildForceFunction(
    segment: Segment,
    spacecraft: Spacecraft,
    segmentRefFrame: string,
    epoch0: number,
    tSegStart: number,
) {
    const forceModel = segment.forceModel;
    const thrust = segment.thrust;

    // Find the engine if thrust is enabled
    let engine = spacecraft.engines[0];
    if (thrust.enabled && thrust.engineId) {
        const found = spacecraft.engines.find(e => e.id === thrust.engineId);
        if (found) engine = found;
    }

    return function (t: number, y: number[]): number[] {
        const currentEpoch = epoch0 + tSegStart + t;
        const pos = [y[0], y[1], y[2]];
        const mass = y[6];

        let ax = 0, ay = 0, az = 0;

        // ==========================
        // Gravitational accelerations
        // ==========================
        if (segmentRefFrame === 'earthInertial') {
            if (forceModel.earthGravity) {
                const g = earthGravityAccel(pos);
                ax += g[0]; ay += g[1]; az += g[2];
            }
            if (forceModel.moonGravity) {
                const g = moonGravityAccelECI(pos, currentEpoch);
                ax += g[0]; ay += g[1]; az += g[2];
            }
            if (forceModel.sunGravity) {
                const g = sunGravityAccelECI(pos, currentEpoch);
                ax += g[0]; ay += g[1]; az += g[2];
            }
        } else if (segmentRefFrame === 'moonInertial') {
            if (forceModel.moonGravity) {
                const g = moonGravityAccelMCI(pos);
                ax += g[0]; ay += g[1]; az += g[2];
            }
            if (forceModel.earthGravity) {
                const g = earthGravityAccelMCI(pos, currentEpoch);
                ax += g[0]; ay += g[1]; az += g[2];
            }
            if (forceModel.sunGravity) {
                // Approximate Sun gravity in Moon-centered frame
                // For simplicity, transform pos to Sun frame and compute
                const g = sunGravityAccelECI(pos, currentEpoch); // approximation for v1
                ax += g[0]; ay += g[1]; az += g[2];
            }
        } else if (segmentRefFrame === 'sunInertial') {
            if (forceModel.sunGravity) {
                const g = sunGravityAccelSCI(pos);
                ax += g[0]; ay += g[1]; az += g[2];
            }
            if (forceModel.earthGravity) {
                const g = earthGravityAccelSCI(pos, currentEpoch);
                ax += g[0]; ay += g[1]; az += g[2];
            }
            if (forceModel.moonGravity) {
                const g = moonGravityAccelSCI(pos, currentEpoch);
                ax += g[0]; ay += g[1]; az += g[2];
            }
        }

        // ==========================
        // Thrust acceleration
        // ==========================
        let dmdt = 0;
        if (thrust.enabled && engine) {
            // Smooth thrust ramp-down near propellant depletion to avoid a
            // discontinuity in the ODE right-hand side.  A hard cutoff at
            // mass == dryMass creates a step function in the derivatives
            // that RK45 can never step across (the error estimate between
            // the 4th- and 5th-order solutions remains large at any step size).
            const propRemaining = mass - spacecraft.dryMass;
            const RAMP_KG = 0.1; // taper thrust linearly over the last 0.1 kg
            const thrustScale = Math.max(0, Math.min(1, propRemaining / RAMP_KG));

            if (thrustScale > 0) {
                const thrustN = engine.thrust * thrustScale; // Newtons (scaled)
                const isp = engine.isp;       // seconds
                const thrustKm = thrustN / 1000.0; // convert N to kN (kg·km/s²)

                // Thrust direction in inertial frame
                const dir = thrustDirectionInertial(
                    thrust.azimuth,
                    thrust.elevation,
                    thrust.controlFrame,
                    y,
                );

                const aThrust = thrustKm / mass; // km/s²
                ax += aThrust * dir[0];
                ay += aThrust * dir[1];
                az += aThrust * dir[2];

                // Mass flow rate: mdot = -T / (Isp * g0)
                dmdt = -thrustN / (isp * G0 * 1000); // kg/s
            }
        }

        return [y[3], y[4], y[5], ax, ay, az, dmdt];
    };
}

/**
 * Get the initial Cartesian state for a spacecraft, converting from
 * Keplerian if necessary, and transform to the propagation reference frame.
 */
export function getInitialCartesian(spacecraft: Spacecraft, propFrame: string, epoch: number): CartesianState {
    const initState = spacecraft.initialState;
    let cart: CartesianState;

    if (initState.coordinateType === 'keplerian') {
        const mu = muForFrame(initState.referenceFrame);
        cart = keplerianToCartesian(initState.keplerian, mu);
    } else {
        cart = { ...initState.cartesian };
    }

    // Transform to propagation frame if different
    if (initState.referenceFrame !== propFrame) {
        cart = transformState(cart, initState.referenceFrame, propFrame, epoch);
    }

    return cart;
}

/**
 * Compute total propellant mass for a spacecraft.
 */
function totalPropellantMass(spacecraft: Spacecraft): number {
    return spacecraft.tanks.reduce((sum, t) => sum + t.propellantMass, 0);
}

// Radius threshold (km) beyond which we consider the trajectory divergent
// ~6.7 AU — well beyond any cislunar or interplanetary scenario
const DIVERGE_RADIUS_KM = 1e9;

/**
 * Propagate a single segment.
 */
export function propagateSegment(
    initialState: number[], // [x,y,z,vx,vy,vz,mass]
    segment: Segment,
    spacecraft: Spacecraft,
    refFrame: string,
    epoch0: number,
    tSegStart: number,
): SegmentResult {
    const duration = segment.termination.duration;

    const rawForceFn = buildForceFunction(segment, spacecraft, refFrame, epoch0, tSegStart);

    // ---- Instrumented wrapper around the force function ----
    // Provides diagnostic output and early divergence detection.
    let evalCount = 0;
    let lastLogCount = 0;
    let lastT = 0;
    const LOG_INTERVAL = 50_000;     // log every N evaluations
    const segLabel = segment.name || segment.id;

    const MAX_EVALS = 200_000; // safety cap — ~1 s wall-time on typical hardware

    const forceFn = (t: number, y: number[]): number[] => {
        evalCount++;
        lastT = t;

        // Hard eval cap — fail fast if the integrator is stuck
        if (evalCount > MAX_EVALS) {
            const r = Math.sqrt(y[0] * y[0] + y[1] * y[1] + y[2] * y[2]);
            const v = Math.sqrt(y[3] * y[3] + y[4] * y[4] + y[5] * y[5]);
            throw new Error(
                `Integrator stalled in segment "${segLabel}": ` +
                `${MAX_EVALS.toLocaleString()} evaluations reached at ` +
                `t=${t.toFixed(1)}/${duration.toFixed(1)} s ` +
                `(${(100 * t / duration).toFixed(1)}%), ` +
                `r=${r.toFixed(1)} km, v=${v.toFixed(3)} km/s, mass=${y[6].toFixed(2)} kg`
            );
        }

        // Periodic diagnostic logging
        if (evalCount - lastLogCount >= LOG_INTERVAL) {
            lastLogCount = evalCount;
            const r = Math.sqrt(y[0] * y[0] + y[1] * y[1] + y[2] * y[2]);
            const v = Math.sqrt(y[3] * y[3] + y[4] * y[4] + y[5] * y[5]);
            console.warn(
                `[propagator] Seg "${segLabel}": ${evalCount.toLocaleString()} evals, ` +
                `t=${t.toFixed(1)}/${duration.toFixed(1)} s ` +
                `(${(100 * t / duration).toFixed(1)}%), ` +
                `r=${r.toFixed(1)} km, v=${v.toFixed(3)} km/s, mass=${y[6].toFixed(2)} kg`
            );
        }

        // Early divergence detection
        const r2 = y[0] * y[0] + y[1] * y[1] + y[2] * y[2];
        if (r2 > DIVERGE_RADIUS_KM * DIVERGE_RADIUS_KM) {
            const r = Math.sqrt(r2);
            const v = Math.sqrt(y[3] * y[3] + y[4] * y[4] + y[5] * y[5]);
            throw new Error(
                `Trajectory diverged in segment "${segLabel}": ` +
                `r=${r.toExponential(2)} km (limit ${DIVERGE_RADIUS_KM.toExponential(0)} km), ` +
                `v=${v.toExponential(2)} km/s at t=${t.toFixed(1)} s ` +
                `after ${evalCount.toLocaleString()} evaluations. ` +
                `The orbit may be hyperbolic or the force model is not capturing the dynamics.`
            );
        }

        return rawForceFn(t, y);
    };

    // Use math.js solveODE with RK45
    let result;
    try {
        result = solveODE(forceFn, [0, duration], initialState, {
            method: 'RK45',
            tol: 1e-8,
            maxStep: duration / 50,   // ensure enough resolution
            minStep: duration / 1e8,  // prevent step collapse
            maxIter: 500_000,
        });
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        // Log final diagnostics regardless of error type
        console.error(
            `[propagator] Segment "${segLabel}" FAILED after ${evalCount.toLocaleString()} ` +
            `evaluations at t=${lastT.toFixed(1)}/${duration.toFixed(1)} s: ${msg}`
        );
        throw e;
    }

    // Log completion summary
    console.log(
        `[propagator] Segment "${segLabel}" completed: ${evalCount.toLocaleString()} evaluations, ` +
        `${(result.t as number[]).length} output points`
    );

    const points: TrajectoryPoint[] = [];
    const tArr = result.t as number[];
    const yArr = result.y as number[][];

    for (let k = 0; k < tArr.length; k++) {
        const yRow = yArr[k];
        points.push({
            t: tSegStart + tArr[k],
            x: yRow[0], y: yRow[1], z: yRow[2],
            vx: yRow[3], vy: yRow[4], vz: yRow[5],
            mass: yRow[6],
        });
    }

    // Calculate deltaV for this segment
    const m0 = initialState[6];
    const mf = points[points.length - 1].mass;
    let deltaV = 0;
    if (segment.thrust.enabled && m0 > 0 && mf > 0 && mf < m0) {
        const engine = spacecraft.engines.find(e => e.id === segment.thrust.engineId) || spacecraft.engines[0];
        if (engine) {
            deltaV = engine.isp * G0 * Math.log(m0 / mf); // km/s
        }
    }

    return {
        segmentId: segment.id,
        points,
        deltaV,
    };
}

/**
 * Propagate all segments for a spacecraft sequentially.
 */
export function propagateSpacecraft(
    spacecraft: Spacecraft,
    epoch0: number = spacecraft.initialState.epoch,
): TrajectoryResult {
    // Determine propagation reference frame from the initial state
    const refFrame = spacecraft.initialState.referenceFrame;

    const cart = getInitialCartesian(spacecraft, refFrame, epoch0);
    const totalMass = spacecraft.dryMass + totalPropellantMass(spacecraft);

    let currentState = [cart.x, cart.y, cart.z, cart.vx, cart.vy, cart.vz, totalMass];
    let tStart = 0;

    const segmentResults: SegmentResult[] = [];

    for (const segment of spacecraft.segments) {
        const result = propagateSegment(currentState, segment, spacecraft, refFrame, epoch0, tStart);
        segmentResults.push(result);

        // Update state for next segment
        const lastPt = result.points[result.points.length - 1];
        currentState = [lastPt.x, lastPt.y, lastPt.z, lastPt.vx, lastPt.vy, lastPt.vz, lastPt.mass];
        tStart = lastPt.t;
    }

    return {
        spacecraftId: spacecraft.id,
        segments: segmentResults,
    };
}
