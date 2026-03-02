// ============================================================
// Optimization Scaling Layer
// Handles scaling optimization variables to [0, 1] for nlopt-js
// and unscaling them back to their physical units for simulation.
// ============================================================

/**
 * Scales a physical variable linearly so that its value is 0 at the lower bound
 * and 1 at the upper bound.
 *
 * @param unscaled The current physical value.
 * @param lower The lower bound in physical units.
 * @param upper The upper bound in physical units.
 * @returns The scaled value, nominally entirely between 0 and 1.
 */
export function scaleVariable(unscaled: number, lower: number, upper: number): number {
    if (upper === lower) {
        return 0; // Avoid division by zero, though equal bounds are generally not a good idea for an optimizer
    }
    return (unscaled - lower) / (upper - lower);
}

/**
 * Unscales a [0, 1] mapped variable back to its native physical parameters
 * based on the provided lower and upper bounds.
 *
 * @param scaled The scaled value (between 0 and 1).
 * @param lower The lower bound in physical units.
 * @param upper The upper bound in physical units.
 * @returns The unscaled physical value.
 */
export function unscaleVariable(scaled: number, lower: number, upper: number): number {
    return lower + scaled * (upper - lower);
}

/**
 * Utility function to determine the display unit for an optimization variable
 * based on its JSON path within the Mission structure.
 *
 * @param path The JSON path string mapping to the variable (e.g. "spacecraft[0].dryMass")
 * @returns The physical unit symbol as a string (e.g., 'kg', 'km', '°').
 */
export function getVariableUnit(path: string): string {
    // Check if it's a segment-level property
    const segMatch = path.match(/^spacecraft\[\d+\]\.segments\[\d+\]\.?(.*)/);
    if (segMatch) {
        const quantity = segMatch[1];

        const segmentUnits: Record<string, string> = {
            'termination.duration': 's',
            'thrust.azimuth': '°',
            'thrust.elevation': '°',
        };

        return segmentUnits[quantity] || '';
    }

    // Spacecraft-level properties
    const scMatch = path.match(/^spacecraft\[\d+\]\.?(.*)/);
    if (scMatch) {
        const rest = scMatch[1];

        const scUnits: Record<string, string> = {
            'dryMass': 'kg',
            'initialState.cartesian.x': 'km',
            'initialState.cartesian.y': 'km',
            'initialState.cartesian.z': 'km',
            'initialState.cartesian.vx': 'km/s',
            'initialState.cartesian.vy': 'km/s',
            'initialState.cartesian.vz': 'km/s',
            'initialState.keplerian.a': 'km',
            'initialState.keplerian.e': '',
            'initialState.keplerian.i': '°',
            'initialState.keplerian.raan': '°',
            'initialState.keplerian.aop': '°',
            'initialState.keplerian.ta': '°',
        };

        return scUnits[rest] || '';
    }

    return '';
}
