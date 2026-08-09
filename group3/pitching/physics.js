// physics.js - Baseball Pitch Trajectory Physics Simulator

// Constants
const G = 9.80665; // Gravity (m/s^2)
const AIR_DENSITY = 1.225; // Air density at sea level (kg/m^3)
const BALL_MASS = 0.145; // Baseball mass (kg)
const BALL_RADIUS = 0.0366; // Baseball radius (m) (approx 2.9" diameter)
const BALL_AREA = Math.PI * BALL_RADIUS * BALL_RADIUS; // Cross-sectional area (m^2)
const DRAG_COEFF = 0.35; // Drag coefficient for a baseball

// Vector Mathematics Helpers
const Vector = {
    add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
    sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
    scale: (v, s) => [v[0] * s, v[1] * s, v[2] * s],
    dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
    cross: (a, b) => [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0]
    ],
    mag: (v) => Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]),
    normalize: (v) => {
        const m = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
        return m === 0 ? [0, 0, 0] : [v[0] / m, v[1] / m, v[2] / m];
    }
};

/**
 * Calculates the derivatives for the state vector [x, y, z, vx, vy, vz]
 * @param {Array} state - [x, y, z, vx, vy, vz]
 * @param {Array} spinVec - Angular velocity vector [wx, wy, wz] in rad/s
 * @param {boolean} useMagnus - Whether to include the Magnus force
 * @returns {Array} Derivatives [vx, vy, vz, ax, ay, az]
 */
function getDerivatives(state, spinVec, useMagnus = true) {
    const pos = [state[0], state[1], state[2]];
    const vel = [state[3], state[4], state[5]];
    const vMag = Vector.mag(vel);

    if (vMag === 0) {
        return [0, 0, 0, 0, 0, -G];
    }

    const vUnit = Vector.normalize(vel);

    // 1. Gravity Acceleration
    const aGrav = [0, 0, -G];

    // 2. Drag Acceleration
    // Fd = -0.5 * Cd * rho * A * v^2
    const aDragMag = (0.5 * DRAG_COEFF * AIR_DENSITY * BALL_AREA * vMag * vMag) / BALL_MASS;
    const aDrag = Vector.scale(vUnit, -aDragMag);

    // 3. Magnus Acceleration
    let aMagnus = [0, 0, 0];
    if (useMagnus) {
        const wMag = Vector.mag(spinVec);
        if (wMag > 0) {
            const wUnit = Vector.normalize(spinVec);

            // Cross product of spin axis and velocity direction
            const crossVec = Vector.cross(wUnit, vUnit);
            const crossMag = Vector.mag(crossVec);

            // Active spin is the component of spin perpendicular to velocity
            const wActive = wMag * crossMag;

            // Spin parameter S = R * w_active / v
            const S = (BALL_RADIUS * wActive) / vMag;

            // Lift Coefficient Cl (empirical formula from Alan Nathan)
            const Cl = S > 0 ? 1 / (1.4 + 1.25 / S) : 0;

            if (crossMag > 0.0001) {
                // Magnus force direction is in the direction of (wUnit x vUnit)
                const magnusDir = Vector.normalize(crossVec);
                const aMagForce = (0.5 * Cl * AIR_DENSITY * BALL_AREA * vMag * vMag) / BALL_MASS;
                aMagnus = Vector.scale(magnusDir, aMagForce);
            }
        }
    }

    // Total acceleration
    const accel = Vector.add(Vector.add(aGrav, aDrag), aMagnus);

    return [vel[0], vel[1], vel[2], accel[0], accel[1], accel[2]];
}

/**
 * Runs a single RK4 step
 */
function rk4Step(state, spinVec, dt, useMagnus = true) {
    const k1 = getDerivatives(state, spinVec, useMagnus);

    const state2 = state.map((val, i) => val + 0.5 * dt * k1[i]);
    const k2 = getDerivatives(state2, spinVec, useMagnus);

    const state3 = state.map((val, i) => val + 0.5 * dt * k2[i]);
    const k3 = getDerivatives(state3, spinVec, useMagnus);

    const state4 = state.map((val, i) => val + dt * k3[i]);
    const k4 = getDerivatives(state4, spinVec, useMagnus);

    return state.map((val, i) => val + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
}

/**
 * Simulates a pitch trajectory from release to home plate
 * @param {Object} params - Pitch parameters
 * @returns {Object} Trajectory path and statistics
 */
function simulatePitch(params) {
    // 1. Initial State Setup
    const releaseX = params.releaseX ?? 0.0; // meters (horizontal)
    const releaseY = params.releaseExtension ?? 1.67; // meters (extension, typical 5.5 ft)
    const releaseZ = params.releaseHeight ?? 1.83; // meters (height, typical 6.0 ft)

    const speedMph = params.speed ?? 90.0;
    const speedMs = speedMph * 0.44704; // convert to m/s

    const launchAngleX = (params.launchAngleX ?? 0.0) * Math.PI / 180; // horizontal angle
    const launchAngleZ = (params.launchAngleZ ?? -1.5) * Math.PI / 180; // vertical angle

    // Compute initial velocity vector
    // Pitch travels in +y direction, with horizontal angle x and vertical angle z
    const vx0 = speedMs * Math.sin(launchAngleX) * Math.cos(launchAngleZ);
    const vy0 = speedMs * Math.cos(launchAngleX) * Math.cos(launchAngleZ);
    const vz0 = speedMs * Math.sin(launchAngleZ);

    let state = [releaseX, releaseY, releaseZ, vx0, vy0, vz0];

    // 2. Spin Axis and Vector Setup
    const spinRpm = params.spinRate ?? 2200;
    const spinRadS = spinRpm * 2 * Math.PI / 60;
    const gyroEfficiency = params.gyroEfficiency ?? 1.0; // 0.0 to 1.0

    // Tilt angle in degrees: 0° is 12:00 (pure backspin), 90° is 3:00 (pure right sidespin)
    const tiltDeg = params.spinTilt ?? 0;
    const tiltRad = tiltDeg * Math.PI / 180;

    // Construct local basis vectors based on initial velocity direction to determine spin axis
    const v0 = [vx0, vy0, vz0];
    const v0Unit = Vector.normalize(v0);

    // Horizontal transverse axis (perpendicular to v0 and vertical up vector)
    const uX = Vector.normalize(Vector.cross(v0Unit, [0, 0, 1]));
    // Vertical transverse axis (perpendicular to uX and v0)
    const uZ = Vector.normalize(Vector.cross(uX, v0Unit));

    // Spin axis for Magnus effect (transverse spin)
    // tilt = 0 (12:00 backspin) -> uX (points right) -> lift is upward
    // tilt = 90 (3:00 sidespin) -> uZ (points up) -> lift is left
    const uTransverse = Vector.add(Vector.scale(uX, Math.cos(tiltRad)), Vector.scale(uZ, Math.sin(tiltRad)));
    // tilt = 90 (3:00 sidespin) -> -uZ (points down) -> lift is right
    // const uTransverse = Vector.sub(Vector.scale(uX, Math.cos(tiltRad)), Vector.scale(uZ, Math.sin(tiltRad)));

    // Total spin vector = transverse component + gyro component
    const spinTransverse = Vector.scale(uTransverse, gyroEfficiency * spinRadS);
    const spinGyro = Vector.scale(v0Unit, Math.sqrt(1 - gyroEfficiency * gyroEfficiency) * spinRadS);
    const spinVec = Vector.add(spinTransverse, spinGyro);

    // 3. Run Simulation
    const dt = 0.001; // 1 ms steps
    const path = [];
    const maxSteps = 1000; // safety limit (1 second of flight)

    const homePlateY = 18.44; // 60.5 feet from rubber in meters

    // Store initial point
    path.push({
        x: state[0],
        y: state[1],
        z: state[2],
        vx: state[3],
        vy: state[4],
        vz: state[5],
        t: 0
    });

    let t = 0;
    let step = 0;

    while (state[1] < homePlateY && state[2] > 0 && step < maxSteps) {
        state = rk4Step(state, spinVec, dt, true);
        t += dt;
        step++;

        path.push({
            x: state[0],
            y: state[1],
            z: state[2],
            vx: state[3],
            vy: state[4],
            vz: state[5],
            t: t
        });
    }

    // Interpolate state exactly at home plate (y = 18.44) for precise metrics
    let plateState = null;
    if (path.length >= 2) {
        const pLast = path[path.length - 1];
        const pPrev = path[path.length - 2];
        if (pLast.y >= homePlateY && pPrev.y < homePlateY) {
            const factor = (homePlateY - pPrev.y) / (pLast.y - pPrev.y);
            plateState = {
                x: pPrev.x + factor * (pLast.x - pPrev.x),
                y: homePlateY,
                z: pPrev.z + factor * (pLast.z - pPrev.z),
                vx: pPrev.vx + factor * (pLast.vx - pPrev.vx),
                vy: pPrev.vy + factor * (pLast.vy - pPrev.vy),
                vz: pPrev.vz + factor * (pLast.vz - pPrev.vz),
                t: pPrev.t + factor * (pLast.t - pPrev.t)
            };
        }
    }
    if (!plateState) {
        plateState = path[path.length - 1];
    }

    // 4. Run Spinless Reference Simulation (to calculate break)
    let stateSpinless = [releaseX, releaseY, releaseZ, vx0, vy0, vz0];
    const pathSpinless = [];
    pathSpinless.push({ x: stateSpinless[0], y: stateSpinless[1], z: stateSpinless[2], t: 0 });

    let tS = 0;
    let stepS = 0;
    while (stateSpinless[1] < homePlateY && stateSpinless[2] > 0 && stepS < maxSteps) {
        stateSpinless = rk4Step(stateSpinless, [0, 0, 0], dt, false); // spinVec = 0
        tS += dt;
        stepS++;
        pathSpinless.push({ x: stateSpinless[0], y: stateSpinless[1], z: stateSpinless[2], t: tS });
    }

    let plateStateSpinless = null;
    if (pathSpinless.length >= 2) {
        const pLast = pathSpinless[pathSpinless.length - 1];
        const pPrev = pathSpinless[pathSpinless.length - 2];
        if (pLast.y >= homePlateY && pPrev.y < homePlateY) {
            const factor = (homePlateY - pPrev.y) / (pLast.y - pPrev.y);
            plateStateSpinless = {
                x: pPrev.x + factor * (pLast.x - pPrev.x),
                y: homePlateY,
                z: pPrev.z + factor * (pLast.z - pPrev.z),
                t: pPrev.t + factor * (pLast.t - pPrev.t)
            };
        }
    }
    if (!plateStateSpinless) {
        plateStateSpinless = pathSpinless[pathSpinless.length - 1];
    }

    // 5. Calculate Metrics
    const M_TO_INCHES = 39.3701;

    // Spin Break is the difference at home plate between spin and spinless
    const horizontalBreakM = plateState.x - plateStateSpinless.x;
    const inducedVerticalBreakM = plateState.z - plateStateSpinless.z;

    const horizontalBreakIn = horizontalBreakM * M_TO_INCHES;
    const inducedVerticalBreakIn = inducedVerticalBreakM * M_TO_INCHES;

    // Plate speed
    const plateSpeedMs = Math.sqrt(plateState.vx * plateState.vx + plateState.vy * plateState.vy + plateState.vz * plateState.vz);
    const plateSpeedMph = plateSpeedMs / 0.44704;

    return {
        path: path,
        pathSpinless: pathSpinless,
        metrics: {
            flightTime: plateState.t,
            plateSpeedMph: plateSpeedMph,
            horizontalBreakIn: horizontalBreakIn,
            inducedVerticalBreakIn: inducedVerticalBreakIn,
            plateXIn: plateState.x * M_TO_INCHES,
            plateZIn: plateState.z * M_TO_INCHES,
            plateXM: plateState.x,
            plateZM: plateState.z,
            releaseXIn: releaseX * M_TO_INCHES,
            releaseZIn: releaseZ * M_TO_INCHES,
            totalDropIn: (releaseZ - plateState.z) * M_TO_INCHES
        }
    };
}

// Export for browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { simulatePitch, Vector };
} else {
    window.Physics = { simulatePitch, Vector };
}
