// ============================================================
// Force Models: Point-Mass Gravity
// ============================================================

import { MU_EARTH, MU_MOON, MU_SUN } from './types';
import { moonPositionECI, sunPositionECI, earthPositionSCI } from './referenceFrames';

/**
 * Point-mass gravitational acceleration: a = -mu * r / |r|^3
 * @param pos - position vector [x, y, z] in km
 * @param bodyPos - position of gravitating body [x, y, z] in km
 * @param mu - gravitational parameter in km³/s²
 * @returns acceleration [ax, ay, az] in km/s²
 */
function pointMassGravity(
    pos: number[],
    bodyPos: number[],
    mu: number
): [number, number, number] {
    const dx = pos[0] - bodyPos[0];
    const dy = pos[1] - bodyPos[1];
    const dz = pos[2] - bodyPos[2];
    const r = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const r3 = r * r * r;

    return [-mu * dx / r3, -mu * dy / r3, -mu * dz / r3];
}

/**
 * Earth gravity at position (in Earth-Centered Inertial).
 * Central body at origin.
 */
export function earthGravityAccel(pos: number[]): [number, number, number] {
    return pointMassGravity(pos, [0, 0, 0], MU_EARTH);
}

/**
 * Moon third-body gravity perturbation (in Earth-Centered Inertial).
 */
export function moonGravityAccelECI(pos: number[], epochSeconds: number): [number, number, number] {
    const moonPos = moonPositionECI(epochSeconds);
    return pointMassGravity(pos, moonPos, MU_MOON);
}

/**
 * Sun third-body gravity perturbation (in Earth-Centered Inertial).
 */
export function sunGravityAccelECI(pos: number[], epochSeconds: number): [number, number, number] {
    const sunPos = sunPositionECI(epochSeconds);
    return pointMassGravity(pos, sunPos, MU_SUN);
}

/**
 * Moon gravity as central body (Moon-Centered Inertial).
 */
export function moonGravityAccelMCI(pos: number[]): [number, number, number] {
    return pointMassGravity(pos, [0, 0, 0], MU_MOON);
}

/**
 * Earth third-body perturbation in Moon-Centered Inertial.
 */
export function earthGravityAccelMCI(pos: number[], epochSeconds: number): [number, number, number] {
    const moonPos = moonPositionECI(epochSeconds);
    // Earth is at -moonPos relative to Moon
    const earthPosInMCI = [-moonPos[0], -moonPos[1], -moonPos[2]];
    return pointMassGravity(pos, earthPosInMCI, MU_EARTH);
}

/**
 * Sun gravity as central body (Sun-Centered Inertial).
 */
export function sunGravityAccelSCI(pos: number[]): [number, number, number] {
    return pointMassGravity(pos, [0, 0, 0], MU_SUN);
}

/**
 * Earth third-body perturbation in Sun-Centered Inertial.
 */
export function earthGravityAccelSCI(pos: number[], epochSeconds: number): [number, number, number] {
    const earthPos = earthPositionSCI(epochSeconds);
    return pointMassGravity(pos, earthPos, MU_EARTH);
}

/**
 * Moon third-body perturbation in Sun-Centered Inertial.
 */
export function moonGravityAccelSCI(pos: number[], epochSeconds: number): [number, number, number] {
    const earthPos = earthPositionSCI(epochSeconds);
    const moonPosECI = moonPositionECI(epochSeconds);
    const moonPosSCI: number[] = [
        earthPos[0] + moonPosECI[0],
        earthPos[1] + moonPosECI[1],
        earthPos[2] + moonPosECI[2],
    ];
    return pointMassGravity(pos, moonPosSCI, MU_MOON);
}
