// ============================================================
// Reference Frame Transformations
// Earth Inertial, Moon Inertial, Sun Inertial
// ============================================================

import { CartesianState, EARTH_MOON_DISTANCE, EARTH_SUN_DISTANCE } from './types';

/**
 * Simplified Moon position in Earth-Inertial frame.
 * Uses circular orbit approximation.
 * Period ≈ 27.3 days = 2,360,592 s
 * Inclination ≈ 5.14 deg to ecliptic (simplified to equatorial here for v1)
 */
export function moonPositionECI(epochSeconds: number): [number, number, number] {
    const T_MOON = 2360592.0; // orbital period in seconds (27.3 days)
    const omega = (2 * Math.PI) / T_MOON;
    const theta = omega * epochSeconds;
    return [
        EARTH_MOON_DISTANCE * Math.cos(theta),
        EARTH_MOON_DISTANCE * Math.sin(theta),
        0,
    ];
}

/**
 * Simplified Moon velocity in Earth-Inertial frame (circular orbit).
 */
export function moonVelocityECI(epochSeconds: number): [number, number, number] {
    const T_MOON = 2360592.0;
    const omega = (2 * Math.PI) / T_MOON;
    const theta = omega * epochSeconds;
    const vMag = EARTH_MOON_DISTANCE * omega; // km/s
    return [
        -vMag * Math.sin(theta),
        vMag * Math.cos(theta),
        0,
    ];
}

/**
 * Simplified Earth position in Sun-Inertial frame.
 * Period ≈ 365.25 days
 */
export function earthPositionSCI(epochSeconds: number): [number, number, number] {
    const T_EARTH = 365.25 * 86400.0;
    const omega = (2 * Math.PI) / T_EARTH;
    const theta = omega * epochSeconds;
    return [
        EARTH_SUN_DISTANCE * Math.cos(theta),
        EARTH_SUN_DISTANCE * Math.sin(theta),
        0,
    ];
}

export function earthVelocitySCI(epochSeconds: number): [number, number, number] {
    const T_EARTH = 365.25 * 86400.0;
    const omega = (2 * Math.PI) / T_EARTH;
    const theta = omega * epochSeconds;
    const vMag = EARTH_SUN_DISTANCE * omega;
    return [
        -vMag * Math.sin(theta),
        vMag * Math.cos(theta),
        0,
    ];
}

/**
 * Sun position in Earth-Inertial frame = -Earth position in Sun frame
 */
export function sunPositionECI(epochSeconds: number): [number, number, number] {
    const ep = earthPositionSCI(epochSeconds);
    return [-ep[0], -ep[1], -ep[2]];
}

/**
 * Transform state from one reference frame to another.
 * Currently supports: earthInertial, moonInertial, sunInertial
 */
export function transformState(
    state: CartesianState,
    fromFrame: string,
    toFrame: string,
    epochSeconds: number
): CartesianState {
    if (fromFrame === toFrame) return { ...state };

    // Convert to Earth Inertial as intermediate
    let eci = { ...state };

    if (fromFrame === 'moonInertial') {
        const mPos = moonPositionECI(epochSeconds);
        const mVel = moonVelocityECI(epochSeconds);
        eci = {
            x: state.x + mPos[0], y: state.y + mPos[1], z: state.z + mPos[2],
            vx: state.vx + mVel[0], vy: state.vy + mVel[1], vz: state.vz + mVel[2],
        };
    } else if (fromFrame === 'sunInertial') {
        const ePos = earthPositionSCI(epochSeconds);
        const eVel = earthVelocitySCI(epochSeconds);
        // sunInertial → earthInertial: subtract Earth's position in Sun frame
        eci = {
            x: state.x - ePos[0], y: state.y - ePos[1], z: state.z - ePos[2],
            vx: state.vx - eVel[0], vy: state.vy - eVel[1], vz: state.vz - eVel[2],
        };
    }

    // Convert from Earth Inertial to target frame
    if (toFrame === 'earthInertial') return eci;

    if (toFrame === 'moonInertial') {
        const mPos = moonPositionECI(epochSeconds);
        const mVel = moonVelocityECI(epochSeconds);
        return {
            x: eci.x - mPos[0], y: eci.y - mPos[1], z: eci.z - mPos[2],
            vx: eci.vx - mVel[0], vy: eci.vy - mVel[1], vz: eci.vz - mVel[2],
        };
    }

    if (toFrame === 'sunInertial') {
        const ePos = earthPositionSCI(epochSeconds);
        const eVel = earthVelocitySCI(epochSeconds);
        return {
            x: eci.x + ePos[0], y: eci.y + ePos[1], z: eci.z + ePos[2],
            vx: eci.vx + eVel[0], vy: eci.vy + eVel[1], vz: eci.vz + eVel[2],
        };
    }

    return eci;
}
