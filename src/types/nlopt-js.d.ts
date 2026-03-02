declare module 'nlopt-js' {
    export const ready: Promise<void>;

    export enum Algorithm {
        LD_SLSQP = 'LD_SLSQP',
        LD_MMA = 'LD_MMA',
        LN_COBYLA = 'LN_COBYLA',
        LN_BOBYQA = 'LN_BOBYQA',
        GN_ISRES = 'GN_ISRES',
        GN_DIRECT = 'GN_DIRECT',
        GN_CRS2_LM = 'GN_CRS2_LM',
        LN_NELDERMEAD = 'LN_NELDERMEAD',
        LN_SBPLX = 'LN_SBPLX',
    }

    export type ObjectiveFunction = (x: number[], grad: number[] | null) => number;

    export class Optimize {
        constructor(algorithm: Algorithm, numVars: number);
        setMinObjective(fn: ObjectiveFunction, tol?: number): void;
        setMaxObjective(fn: ObjectiveFunction, tol?: number): void;
        setLowerBounds(bounds: number[]): void;
        setUpperBounds(bounds: number[]): void;
        setMaxeval(maxeval: number): void;
        addEqualityConstraint(fn: ObjectiveFunction, tol: number): void;
        addInequalityConstraint(fn: ObjectiveFunction, tol: number): void;
        optimize(x0: number[]): { x: number[]; value: number };
        delete(): void;
    }
}
