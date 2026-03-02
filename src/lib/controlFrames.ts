// ============================================================
// Control Frame Transformations
// Convert thrust direction from control-frame angles to inertial
// ============================================================

import { DEG2RAD } from './orbitalMechanics';

/**
 * Given a state vector [x,y,z,vx,vy,vz,...], compute the thrust direction
 * in the inertial frame given control-frame angles.
 *
 * Control frames:
 * - inertial: azimuth/elevation define direction directly in inertial frame
 * - vnc: Velocity-Normal-Conormal frame
 *         V = velocity direction
 *         N = orbit normal (r×v / |r×v|)
 *         C = V × N
 * - vuw: Velocity-radial-crosstrack frame
 *         V (or U direction) = velocity direction
 *         W = orbit normal
 *         U = W × V (roughly radial)
 */
export function thrustDirectionInertial(
    azimuthDeg: number,
    elevationDeg: number,
    controlFrame: string,
    stateVec: number[],
): [number, number, number] {
    const az = azimuthDeg * DEG2RAD;
    const el = elevationDeg * DEG2RAD;

    // Unit direction in control frame (spherical → Cartesian)
    // x = cos(el)*cos(az), y = cos(el)*sin(az), z = sin(el)
    const dCF = [
        Math.cos(el) * Math.cos(az),
        Math.cos(el) * Math.sin(az),
        Math.sin(el),
    ];

    if (controlFrame === 'inertial') {
        return [dCF[0], dCF[1], dCF[2]];
    }

    const [x, y, z, vx, vy, vz] = stateVec;
    const rVec = [x, y, z];
    const vVec = [vx, vy, vz];

    const vMag = Math.sqrt(vVec[0] ** 2 + vVec[1] ** 2 + vVec[2] ** 2);
    if (vMag < 1e-15) return [dCF[0], dCF[1], dCF[2]]; // fallback

    // V-hat = velocity direction
    const vHat = [vVec[0] / vMag, vVec[1] / vMag, vVec[2] / vMag];

    // h = r × v (orbit normal)
    const h = cross(rVec, vVec);
    const hMag = Math.sqrt(h[0] ** 2 + h[1] ** 2 + h[2] ** 2);

    if (controlFrame === 'vnc') {
        // V = velocity, N = orbit normal, C = V × N
        const nHat = hMag > 1e-15 ? [h[0] / hMag, h[1] / hMag, h[2] / hMag] : [0, 0, 1];
        const cHat = cross(vHat, nHat);

        // Transform: direction = dCF[0]*V + dCF[1]*N + dCF[2]*C
        return [
            dCF[0] * vHat[0] + dCF[1] * nHat[0] + dCF[2] * cHat[0],
            dCF[0] * vHat[1] + dCF[1] * nHat[1] + dCF[2] * cHat[1],
            dCF[0] * vHat[2] + dCF[1] * nHat[2] + dCF[2] * cHat[2],
        ];
    }

    if (controlFrame === 'vuw') {
        // V = velocity, W = orbit normal, U = W × V
        const wHat = hMag > 1e-15 ? [h[0] / hMag, h[1] / hMag, h[2] / hMag] : [0, 0, 1];
        const uHat = cross(wHat, vHat);

        return [
            dCF[0] * vHat[0] + dCF[1] * uHat[0] + dCF[2] * wHat[0],
            dCF[0] * vHat[1] + dCF[1] * uHat[1] + dCF[2] * wHat[1],
            dCF[0] * vHat[2] + dCF[1] * uHat[2] + dCF[2] * wHat[2],
        ];
    }

    return [dCF[0], dCF[1], dCF[2]];
}

function cross(a: number[], b: number[]): number[] {
    return [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    ];
}
