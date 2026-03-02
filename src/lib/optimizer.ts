// ============================================================
// Optimization Engine
// Wraps nlopt-js for nonlinear trajectory optimization via Web Worker
// ============================================================

import {
    Mission,
    OptimizationConfig,
    OptimizationIteration,
    OptimizationResult,
} from './types';

/**
 * Run the optimization using a Web Worker to prevent UI blocking.
 */
export async function runOptimization(
    mission: Mission,
    config: OptimizationConfig,
    onIteration: (iter: OptimizationIteration) => void,
    shouldStop: () => boolean,
    onLog?: (line: string) => void,
): Promise<OptimizationResult> {

    const nVars = config.variables.length;
    if (nVars === 0) {
        return {
            status: 'failed',
            iterations: [],
            bestObjective: NaN,
            bestVariables: [],
            message: 'No optimization variables defined.',
        };
    }

    // Map algorithm name to nlopt constant
    const algorithmMap: Record<string, string> = {
        'LD_SLSQP': 'LD_SLSQP',
        'LD_MMA': 'LD_MMA',
        'LN_COBYLA': 'LN_COBYLA',
        'LN_BOBYQA': 'LN_BOBYQA',
        'GN_ISRES': 'GN_ISRES',
    };

    return new Promise((resolve) => {
        // Instantiate the worker
        const worker = new Worker(new URL('./optimizer.worker.ts', import.meta.url), { type: 'module' });

        const iterations: OptimizationIteration[] = [];
        let isComplete = false;
        let forceKillTimeout: ReturnType<typeof setTimeout> | null = null;
        let stopSent = false;

        // Helper to resolve with whatever we've collected so far
        const forceResolve = (message: string) => {
            if (isComplete) return;
            isComplete = true;
            clearInterval(stopCheckInterval);
            if (forceKillTimeout) clearTimeout(forceKillTimeout);
            worker.terminate();

            const bestObj = iterations.length > 0 ? iterations[iterations.length - 1].objectiveValue : NaN;
            const bestVars = iterations.length > 0 ? iterations[iterations.length - 1].variables : [];
            resolve({
                status: 'stopped',
                iterations,
                bestObjective: bestObj,
                bestVariables: bestVars,
                message,
            });
        };

        // Interval to check if stop was requested via UI button
        const stopCheckInterval = setInterval(() => {
            if (shouldStop() && !isComplete) {
                worker.postMessage({ type: 'STOP' });

                // Start a force-kill timeout if we haven't already
                if (!stopSent) {
                    stopSent = true;
                    forceKillTimeout = setTimeout(() => {
                        forceResolve('Optimization force-stopped (worker unresponsive).');
                    }, 3000);
                }
            }
        }, 100);

        worker.onmessage = (e) => {
            const { type, payload } = e.data;

            if (type === 'ITERATION') {
                iterations.push(payload);
                onIteration(payload);
            } else if (type === 'LOG') {
                if (onLog) onLog(payload);
            } else if (type === 'RESULT') {
                isComplete = true;
                clearInterval(stopCheckInterval);
                if (forceKillTimeout) clearTimeout(forceKillTimeout);
                worker.terminate();

                // If the worker sends a result with empty iterations (like on stop), backfill from what we collected
                const finalIterations = payload.iterations && payload.iterations.length > 0 ? payload.iterations : iterations;
                const bestObj = finalIterations.length > 0 ? finalIterations[finalIterations.length - 1].objectiveValue : NaN;
                const bestVars = finalIterations.length > 0 ? finalIterations[finalIterations.length - 1].variables : [];

                let finalStatus = payload.status;
                let finalMessage = payload.message;

                // Safety check: if status is 'converged' but constraints are violated, override to 'failed'
                if (finalStatus === 'converged' && finalIterations.length > 0 && config.constraints.length > 0) {
                    const lastIter = finalIterations[finalIterations.length - 1];
                    const hasViolations = lastIter.maxConstraintViolation > 0 ||
                        (lastIter.constraintViolations && lastIter.constraintViolations.some((v: number) => isNaN(v) || v > 0.01));
                    if (hasViolations) {
                        finalStatus = 'failed';
                        finalMessage = 'Optimization finished, but constraints are not satisfied.';
                    }
                }

                resolve({
                    ...payload,
                    status: finalStatus,
                    message: finalMessage,
                    iterations: finalIterations,
                    bestObjective: isNaN(payload.bestObjective) ? bestObj : payload.bestObjective,
                    bestVariables: payload.bestVariables.length === 0 ? bestVars : payload.bestVariables,
                });
            }
        };

        worker.onerror = (err) => {
            isComplete = true;
            clearInterval(stopCheckInterval);
            if (forceKillTimeout) clearTimeout(forceKillTimeout);
            worker.terminate();
            resolve({
                status: 'failed',
                iterations,
                bestObjective: iterations.length > 0 ? iterations[iterations.length - 1].objectiveValue : NaN,
                bestVariables: iterations.length > 0 ? iterations[iterations.length - 1].variables : [],
                message: `Worker error: ${err.message}`,
            });
        };

        // Start the worker
        worker.postMessage({
            type: 'START',
            payload: {
                mission,
                config,
                nVars,
                algorithmMap
            }
        });
    });
}
