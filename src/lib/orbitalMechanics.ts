// ============================================================
// Orbital Mechanics Utilities
// Cartesian ↔ Keplerian conversions
// ============================================================

import {
    CartesianState,
    KeplerianElements,
    TrajectoryPoint,
    MU_EARTH,
    R_EARTH,
    R_MOON,
    R_SUN,
} from './types';

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

/**
 * Convert Keplerian orbital elements to Cartesian state vector.
 */
export function keplerianToCartesian(
    elements: KeplerianElements,
    mu: number = MU_EARTH
): CartesianState {
    const { a, e, i: iDeg, raan: raanDeg, aop: aopDeg, ta: taDeg } = elements;
    const iRad = iDeg * DEG2RAD;
    const raanRad = raanDeg * DEG2RAD;
    const aopRad = aopDeg * DEG2RAD;
    const taRad = taDeg * DEG2RAD;

    // Semi-latus rectum
    const p = a * (1 - e * e);

    // Radius
    const r = p / (1 + e * Math.cos(taRad));

    // Position and velocity in perifocal frame
    const cosTA = Math.cos(taRad);
    const sinTA = Math.sin(taRad);

    const rPeri = [r * cosTA, r * sinTA, 0];
    const vMag = Math.sqrt(mu / p);
    const vPeri = [vMag * -sinTA, vMag * (e + cosTA), 0];

    // Rotation matrix from perifocal to inertial
    const cosRaan = Math.cos(raanRad);
    const sinRaan = Math.sin(raanRad);
    const cosAop = Math.cos(aopRad);
    const sinAop = Math.sin(aopRad);
    const cosI = Math.cos(iRad);
    const sinI = Math.sin(iRad);

    // DCM Columns
    const l1 = cosRaan * cosAop - sinRaan * sinAop * cosI;
    const m1 = sinRaan * cosAop + cosRaan * sinAop * cosI;
    const n1 = sinAop * sinI;

    const l2 = -cosRaan * sinAop - sinRaan * cosAop * cosI;
    const m2 = -sinRaan * sinAop + cosRaan * cosAop * cosI;
    const n2 = cosAop * sinI;

    return {
        x: l1 * rPeri[0] + l2 * rPeri[1],
        y: m1 * rPeri[0] + m2 * rPeri[1],
        z: n1 * rPeri[0] + n2 * rPeri[1],
        vx: l1 * vPeri[0] + l2 * vPeri[1],
        vy: m1 * vPeri[0] + m2 * vPeri[1],
        vz: n1 * vPeri[0] + n2 * vPeri[1],
    };
}

/**
 * Convert Cartesian state vector to Keplerian orbital elements.
 */
export function cartesianToKeplerian(
    state: CartesianState,
    mu: number = MU_EARTH
): KeplerianElements {
    const { x, y, z, vx, vy, vz } = state;

    const rVec = [x, y, z];
    const vVec = [vx, vy, vz];
    const rMag = Math.sqrt(x * x + y * y + z * z);
    const vMag = Math.sqrt(vx * vx + vy * vy + vz * vz);

    // Angular momentum h = r × v
    const hx = y * vz - z * vy;
    const hy = z * vx - x * vz;
    const hz = x * vy - y * vx;
    const hMag = Math.sqrt(hx * hx + hy * hy + hz * hz);

    // Node vector n = k × h
    const nx = -hy;
    const ny = hx;
    const nMag = Math.sqrt(nx * nx + ny * ny);

    // Eccentricity vector
    const rdotv = rVec[0] * vVec[0] + rVec[1] * vVec[1] + rVec[2] * vVec[2];
    const ex = (1 / mu) * ((vMag * vMag - mu / rMag) * x - rdotv * vx);
    const ey = (1 / mu) * ((vMag * vMag - mu / rMag) * y - rdotv * vy);
    const ez = (1 / mu) * ((vMag * vMag - mu / rMag) * z - rdotv * vz);
    const e = Math.sqrt(ex * ex + ey * ey + ez * ez);

    // Semi-major axis
    const energy = vMag * vMag / 2 - mu / rMag;
    const a = -mu / (2 * energy);

    // Inclination
    const i = Math.acos(Math.max(-1, Math.min(1, hz / hMag))) * RAD2DEG;

    // RAAN
    let raan = 0;
    if (nMag > 1e-10) {
        raan = Math.acos(Math.max(-1, Math.min(1, nx / nMag))) * RAD2DEG;
        if (ny < 0) raan = 360 - raan;
    }

    // Argument of periapsis
    let aop = 0;
    if (nMag > 1e-10 && e > 1e-10) {
        const ndote = (nx * ex + ny * ey) / (nMag * e);
        aop = Math.acos(Math.max(-1, Math.min(1, ndote))) * RAD2DEG;
        if (ez < 0) aop = 360 - aop;
    }

    // True anomaly
    let ta = 0;
    if (e > 1e-10) {
        const edotr = (ex * x + ey * y + ez * z) / (e * rMag);
        ta = Math.acos(Math.max(-1, Math.min(1, edotr))) * RAD2DEG;
        if (rdotv < 0) ta = 360 - ta;
    }

    return { a, e, i, raan, aop, ta };
}

/**
 * Return the gravitational parameter for a given reference frame's central body.
 */
export function muForFrame(frame: string): number {
    switch (frame) {
        case 'earthInertial': return MU_EARTH;
        case 'moonInertial': return 4902.800066;
        case 'sunInertial': return 132712440041.93938;
        default: return MU_EARTH;
    }
}

/**
 * Return the primary body radius for a given reference frame.
 */
export function radiusForFrame(frame: string): number {
    switch (frame) {
        case 'earthInertial': return R_EARTH;
        case 'moonInertial': return R_MOON;
        case 'sunInertial': return R_SUN;
        default: return R_EARTH;
    }
}

export { DEG2RAD, RAD2DEG };

/**
 * Compute a specific quantity for a state (mass, orbital elements, cartesian coordinates).
 */
export function computeStateQuantity(
    point: TrajectoryPoint,
    quantity: string,
    refFrame: string
): number {
    // Direct state quantities
    const directMap: Record<string, number> = {
        x: point.x, y: point.y, z: point.z,
        vx: point.vx, vy: point.vy, vz: point.vz,
        mass: point.mass,
    };

    if (quantity in directMap) return directMap[quantity];

    // Keplerian elements
    const mu = muForFrame(refFrame);
    const kep = cartesianToKeplerian(
        { x: point.x, y: point.y, z: point.z, vx: point.vx, vy: point.vy, vz: point.vz },
        mu
    );
    const rPeri = kep.a * (1 - kep.e);
    const rApo = kep.a * (1 + kep.e);
    const radius = radiusForFrame(refFrame);
    const altPeri = rPeri - radius;
    const altApo = rApo - radius;

    const kepMap: Record<string, number> = {
        a: kep.a, e: kep.e, i: kep.i, raan: kep.raan, aop: kep.aop, ta: kep.ta,
        rPeri, rApo, altPeri, altApo,
    };

    return kepMap[quantity] ?? NaN;
}
