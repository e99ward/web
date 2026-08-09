// app.js - Three.js Visualization and UI Coordinator

// UI State
const state = {
    // Pitch parameters (default: 4-seam fastball)
    speed: 95,
    spinRate: 2400,
    spinTilt: 15,
    gyroEfficiency: 0.95,

    // Release geometry
    releaseHeight: 6.0,      // feet
    releaseX: -2.0,           // feet (positive for RHP)
    releaseExtension: 5.5,   // feet
    launchAngleZ: -1.8,      // degrees (vertical)
    launchAngleX: 0.8,      // degrees (horizontal)

    // Viz options
    showSpinless: true,
    activeCamera: 'pitcher', // pitcher, batter, catcher, side, interactive
    animationSpeed: 0.25,     // slow motion default

    // Simulation result
    simResult: null
};

// Preset constants
const PRESETS = {
    fastball: {
        speed: 95, spinRate: 2400, spinTilt: 15, gyroEfficiency: 95,
        releaseHeight: 6.0, releaseX: -2.0, releaseExtension: 5.5,
        launchAngleZ: -1.8, launchAngleX: 1.8
    },
    sinker: {
        speed: 92, spinRate: 2150, spinTilt: 60, gyroEfficiency: 85,
        releaseHeight: 5.8, releaseX: -2.2, releaseExtension: 5.7,
        launchAngleZ: -2.0, launchAngleX: 2.0
    },
    slider: {
        speed: 84, spinRate: 2500, spinTilt: 240, gyroEfficiency: 35,
        releaseHeight: 5.9, releaseX: -2.1, releaseExtension: 5.4,
        launchAngleZ: -1.0, launchAngleX: 2.2
    },
    curveball: {
        speed: 78, spinRate: 2600, spinTilt: 180, gyroEfficiency: 90,
        releaseHeight: 6.2, releaseX: -1.8, releaseExtension: 5.3,
        launchAngleZ: 1.2, launchAngleX: 1.5
    },
    cutter: {
        speed: 89, spinRate: 2400, spinTilt: 330, gyroEfficiency: 50,
        releaseHeight: 6.0, releaseX: -2.1, releaseExtension: 5.5,
        launchAngleZ: -1.5, launchAngleX: 1.3
    },
    changeup: {
        speed: 83, spinRate: 1650, spinTilt: 60, gyroEfficiency: 80,
        releaseHeight: 5.7, releaseX: -2.0, releaseExtension: 5.6,
        launchAngleZ: -1.5, launchAngleX: 1.8
    }
};

// Conversions
const FT_TO_M = 0.3048;
const M_TO_FT = 3.28084;
const IN_TO_M = 0.0254;
const M_TO_IN = 39.3701;

// Three.js Globals
let scene, camera, renderer, orbitControls;
let ballMesh, ballShadow;
let spinlessBallMesh, spinlessBallShadow;
let actualTrailLine, spinlessTrailLine;
let strikeZoneMesh, strikeZoneFrontFrame;
let animationTime = 0;
let isAnimating = true;

// 2D Strike Zone Canvas Globals
let szCanvas, szCtx;

// Spin-viewer inset globals
let spinViewer = null; // { renderer, scene, camera, ball, axisArrow, time }

// Initialize
window.addEventListener('DOMContentLoaded', () => {
    initThree();
    initStrikeZoneCanvas();
    initSpinViewer();
    setupEventListeners();
    applyPreset('fastball');
    runSimulation();
    animate();
});

// Create dynamic baseball texture
function createBaseballTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    // Leather base (slight warm cream color)
    ctx.fillStyle = '#f7f6f2';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw subtle leather texture grain
    ctx.fillStyle = '#eceae3';
    for (let i = 0; i < 2000; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        ctx.fillRect(x, y, 1, 1);
    }

    // Helper to draw realistic seam + stitching
    const drawRealisticSeam = (centerY, amplitude, isFlipped = false) => {
        const w = canvas.width;
        const k = (2 * Math.PI) / w;

        // 1. Draw leather fold/groove (crease.6 shadow)
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        for (let x = 0; x <= w; x++) {
            const angleVal = (x / w) * Math.PI * 2;
            const y = centerY + amplitude * (isFlipped ? -Math.sin(angleVal) : Math.sin(angleVal));
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();

        ctx.strokeStyle = 'rgba(0, 0, 0, 0.04)';
        ctx.lineWidth = 8;
        ctx.stroke();

        // 2. Draw red stitching threads (alternating slant to form V-pattern)
        const step = 5; // distance along seam
        const stitchOffset = 6.5; // distance from seam center to stitch hole
        ctx.lineWidth = 1.6;

        for (let x = 0; x < w; x += step) {
            const angleVal = (x / w) * Math.PI * 2;
            const y = centerY + amplitude * (isFlipped ? -Math.sin(angleVal) : Math.sin(angleVal));

            // Tangent calculation
            const cosVal = Math.cos(angleVal);
            const dy = amplitude * k * (isFlipped ? -cosVal : cosVal);
            const len = Math.sqrt(1 + dy * dy);

            // Tangent and normal vectors
            const tx = 1 / len;
            const ty = dy / len;
            const nx = -ty;
            const ny = tx;

            // Deep crimson color for authentic thread
            ctx.strokeStyle = '#c41d1d';

            // Left stitch (pointing diagonally outward and forward)
            const lx1 = x - nx * 1.5;
            const ly1 = y - ny * 1.5;
            const lx2 = x - nx * stitchOffset + tx * 3;
            const ly2 = y - ny * stitchOffset + ty * 3;

            ctx.beginPath();
            ctx.moveTo(lx1, ly1);
            ctx.lineTo(lx2, ly2);
            ctx.stroke();

            // Right stitch
            const rx1 = x + nx * 1.5;
            const ry1 = y + ny * 1.5;
            const rx2 = x + nx * stitchOffset + tx * 3;
            const ry2 = y + ny * stitchOffset + ty * 3;

            ctx.beginPath();
            ctx.moveTo(rx1, ry1);
            ctx.lineTo(rx2, ry2);
            ctx.stroke();

            // 3. Draw tiny dark stitch entry holes
            ctx.fillStyle = '#8f7e65';
            ctx.fillRect(lx2 - 0.75, ly2 - 0.75, 1.5, 1.5);
            ctx.fillRect(rx2 - 0.75, ry2 - 0.75, 1.5, 1.5);
        }
    };

    // Draw both seams
    drawRealisticSeam(64, 32, false);
    drawRealisticSeam(192, 32, true);

    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = 4; // sharpen texture viewing angles
    return texture;
}

function initThree() {
    const container = document.getElementById('canvas-container');
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Scene setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0c10);
    scene.fog = new THREE.FogExp2(0x0a0c10, 0.015);

    // Camera setup
    camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);

    // Renderer setup
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // Orbit Controls
    orbitControls = new THREE.OrbitControls(camera, renderer.domElement);
    orbitControls.enableDamping = true;
    orbitControls.dampingFactor = 0.05;
    //orbitControls.maxPolarAngle = Math.PI / 2 - 0.01; // don't go below ground

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.35);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xb8fff0, 0x132019, 1.65);
    scene.add(hemiLight);

    // Stadium floodlight simulation
    const floodlight = new THREE.DirectionalLight(0xffffff, 0.85);
    floodlight.position.set(10, 30, 20);
    floodlight.castShadow = true;
    floodlight.shadow.mapSize.width = 2048;
    floodlight.shadow.mapSize.height = 2048;
    floodlight.shadow.camera.near = 0.5;
    floodlight.shadow.camera.far = 50;
    const d = 15;
    floodlight.shadow.camera.left = -d;
    floodlight.shadow.camera.right = d;
    floodlight.shadow.camera.top = d;
    floodlight.shadow.camera.bottom = -d;
    scene.add(floodlight);

    // Soft overhead light
    const keyLight = new THREE.PointLight(0xddf0ff, 0.5, 30);
    keyLight.position.set(0, 18.44, 5);
    scene.add(keyLight);

    // Field Geometry (Authentic Baseball Field Graphics)
    // (1) Green-colored ground field between pitcher and catcher
    const turfGeo = new THREE.PlaneGeometry(11, 28);
    const turfMat = new THREE.MeshStandardMaterial({
        color: 0x102620,
        roughness: 1
    });
    const turfMesh = new THREE.Mesh(turfGeo, turfMat);
    turfMesh.position.set(0, 9.22, -0.035);
    turfMesh.receiveShadow = true;
    scene.add(turfMesh);

    const laneGeo = new THREE.PlaneGeometry(3.6, 20.2);
    const laneMat = new THREE.MeshStandardMaterial({
        color: 0x17352c,
        roughness: 1
    });
    const laneMesh = new THREE.Mesh(laneGeo, laneMat);
    laneMesh.position.set(0, 9.22, -0.02);
    laneMesh.receiveShadow = true;
    scene.add(laneMesh);

    // Overlay Field Grid (matching refer.tsx)
    const gridHelper = new THREE.GridHelper(28, 28, 0x31584b, 0x1d3931);
    gridHelper.rotation.x = Math.PI / 2;
    gridHelper.position.set(0, 9.22, -0.005);
    gridHelper.material.opacity = 0.36;
    gridHelper.material.transparent = true;
    scene.add(gridHelper);

    // (2) Brown-colored pitcher's mound
    const moundGeo = new THREE.CylinderGeometry(1.45, 1.7, 0.18, 48);
    const moundMat = new THREE.MeshStandardMaterial({
        color: 0x593b22,
        roughness: 0.95
    });
    const moundMesh = new THREE.Mesh(moundGeo, moundMat);
    moundMesh.rotation.x = Math.PI / 2;
    moundMesh.position.set(0, 0, 0.04);
    moundMesh.receiveShadow = true;
    scene.add(moundMesh);

    // Pitcher's Rubber (placed on top of mound)
    const rubberGeo = new THREE.BoxGeometry(0.62, 0.16, 0.035);
    const rubberMat = new THREE.MeshStandardMaterial({
        color: 0xe8e3d6,
        roughness: 0.8
    });
    const rubberMesh = new THREE.Mesh(rubberGeo, rubberMat);
    rubberMesh.position.set(0, 0, 0.14);
    scene.add(rubberMesh);

    // Plate Cutout Circle (brown clay cutout around home plate)
    const plateCutoutGeo = new THREE.RingGeometry(0, 2.4, 64);
    const plateCutoutMat = new THREE.MeshStandardMaterial({
        color: 0x593b22,
        roughness: 0.95,
        side: THREE.DoubleSide
    });
    const plateCutoutMesh = new THREE.Mesh(plateCutoutGeo, plateCutoutMat);
    plateCutoutMesh.position.set(0, 18.44, 0.001);
    plateCutoutMesh.receiveShadow = true;
    scene.add(plateCutoutMesh);

    // (3) Home Plate (adhered flat to the ground, pentagon in XY plane)
    const plateShape = new THREE.Shape();
    const w = 0.4318; // 17 inches width
    plateShape.moveTo(-w / 2, 0);
    plateShape.lineTo(w / 2, 0);
    plateShape.lineTo(w / 2, 0.216);
    plateShape.lineTo(0, 0.4318);
    plateShape.lineTo(-w / 2, 0.216);
    plateShape.closePath();

    const plateGeo = new THREE.ShapeGeometry(plateShape);
    const plateMat = new THREE.MeshStandardMaterial({
        color: 0xece8dc,
        roughness: 0.72,
        side: THREE.DoubleSide
    });
    const plateMesh = new THREE.Mesh(plateGeo, plateMat);
    plateMesh.rotation.set(0, 0, 0); // Lies flat on XY ground
    plateMesh.position.set(0, 18.44, 0.012);
    plateMesh.receiveShadow = true;
    scene.add(plateMesh);

    // Virtual 3D Strike Zone Box
    // Width = 17" (0.4318m). Height = Knee (1.6 ft = 0.49m) to Chest (3.5 ft = 1.07m)
    // Depth = Home plate length (17" = 0.4318m).
    const szWidth = 0.4318;
    const szHeight = (3.5 - 1.6) * FT_TO_M; // 0.579m
    const szDepth = 0.4318;
    const szCenterZ = (1.6 + (3.5 - 1.6) / 2) * FT_TO_M; // 0.777m

    const szGeo = new THREE.BoxGeometry(szWidth, szDepth, szHeight); // Three.js box has height in Y, depth in Z. 
    // Wait, let's swap dimensions to match our coordinates (X: width, Y: depth/extension, Z: height)
    // BoxGeometry parameters: width, height, depth.
    // In our system, height is Z, depth is Y.
    // So BoxGeometry(szWidth, szHeight, szDepth)
    // Then we rotate or position properly.
    const szBoxGeo = new THREE.BoxGeometry(szWidth, szDepth, szHeight);
    const szMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.05,
        wireframe: false
    });
    strikeZoneMesh = new THREE.Mesh(szBoxGeo, szMat);
    // Center it. The front face is at y = 18.44. The box extends backwards from y = 18.44 to 18.87.
    // So center Y is 18.44 + szDepth / 2.
    strikeZoneMesh.position.set(0, 18.44 + szDepth / 2, szCenterZ);
    scene.add(strikeZoneMesh);

    // Glowing borders for the front face of the strike zone (cross-section frame)
    const frameEdges = new THREE.EdgesGeometry(new THREE.PlaneGeometry(szWidth, szHeight));
    const frameMat = new THREE.LineBasicMaterial({ color: 0xff4444, linewidth: 2 });
    strikeZoneFrontFrame = new THREE.LineSegments(frameEdges, frameMat);
    strikeZoneFrontFrame.rotation.x = Math.PI / 2; // stand up facing pitcher
    strikeZoneFrontFrame.position.set(0, 18.44, szCenterZ);
    scene.add(strikeZoneFrontFrame);

    // Add thin wireframe edges to the 3D box to make it look premium
    const szBoxEdges = new THREE.EdgesGeometry(szBoxGeo);
    const szBoxWire = new THREE.LineSegments(szBoxEdges, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.15 }));
    strikeZoneMesh.add(szBoxWire);

    // Baseball Sphere
    const ballRadius = 0.0366; // 3.66 cm
    const ballGeo = new THREE.SphereGeometry(ballRadius, 32, 32);
    const ballTexture = createBaseballTexture();
    const ballMat = new THREE.MeshPhongMaterial({
        map: ballTexture,
        shininess: 30,
        bumpMap: ballTexture,
        bumpScale: 0.001
    });
    ballMesh = new THREE.Mesh(ballGeo, ballMat);
    ballMesh.castShadow = true;
    scene.add(ballMesh);

    // Baseball Ground Shadow
    const shadowGeo = new THREE.RingGeometry(0, ballRadius, 32);
    const shadowMat = new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide
    });
    ballShadow = new THREE.Mesh(shadowGeo, shadowMat);
    ballShadow.rotation.x = -Math.PI / 2;
    ballShadow.position.z = 0.01;
    scene.add(ballShadow);

    // Spinless reference ball
    const spinlessBallMat = new THREE.MeshBasicMaterial({
        color: 0xff0055,
        transparent: true,
        opacity: 0.45
    });
    spinlessBallMesh = new THREE.Mesh(new THREE.SphereGeometry(ballRadius * 0.9, 16, 16), spinlessBallMat);
    scene.add(spinlessBallMesh);

    // Spinless Ground Shadow
    spinlessBallShadow = new THREE.Mesh(shadowGeo, new THREE.MeshBasicMaterial({
        color: 0x550011,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide
    }));
    spinlessBallShadow.rotation.x = -Math.PI / 2;
    spinlessBallShadow.position.z = 0.01;
    scene.add(spinlessBallShadow);

    // Trajectory Trails (Initial lines)
    const lineMatActual = new THREE.LineBasicMaterial({
        color: 0x0088ff,
        linewidth: 2.5
    });
    const lineMatSpinless = new THREE.LineBasicMaterial({
        color: 0xff0055,
        linewidth: 1.5,
        transparent: true,
        opacity: 0.65
    });

    const dummyGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    actualTrailLine = new THREE.Line(dummyGeo, lineMatActual);
    spinlessTrailLine = new THREE.Line(dummyGeo, lineMatSpinless);

    scene.add(actualTrailLine);
    scene.add(spinlessTrailLine);

    // Set initial camera view
    updateCameraView();

    // Resize handler
    window.addEventListener('resize', () => {
        const w = container.clientWidth;
        const h = container.clientHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
    });
}

// ─── Spin Viewer Inset ───────────────────────────────────────────────────────
function initSpinViewer() {
    const SIZE = 280; // px

    // Create dedicated canvas and position it over the main viewport
    const canvas = document.createElement('canvas');
    canvas.id = 'spin-viewer-canvas';
    canvas.width = SIZE;
    canvas.height = SIZE;
    canvas.style.cssText = [
        'position:absolute',
        'right:16px',
        'bottom:16px',
        'width:' + SIZE + 'px',
        'height:' + SIZE + 'px',
        'border-radius:12px',
        'background:rgba(10,12,16,0.72)',
        'border:1px solid rgba(255,255,255,0.12)',
        'box-shadow:0 4px 24px rgba(0,0,0,0.55)',
        'pointer-events:none',
        'display:none',
        'z-index:20',
        'backdrop-filter:blur(6px)'
    ].join(';');

    const container = document.getElementById('canvas-container');
    container.style.position = 'relative'; // ensure stacking context
    container.appendChild(canvas);

    // Label overlay (HTML, positioned on top of the canvas)
    const label = document.createElement('div');
    label.id = 'spin-viewer-label';
    label.style.cssText = [
        'position:absolute',
        'right:16px',
        'bottom:' + (SIZE + 20) + 'px',
        'width:' + SIZE + 'px',
        'text-align:center',
        'font-family:Outfit,sans-serif',
        'font-size:10px',
        'font-weight:500',
        'letter-spacing:0.08em',
        'color:rgba(255,255,255,0.55)',
        'text-transform:uppercase',
        'pointer-events:none',
        'display:none',
        'z-index:21'
    ].join(';');
    label.textContent = 'Spin Axis';
    container.appendChild(label);

    // ── Dedicated Three.js scene ──
    const svScene = new THREE.Scene();
    const svCamera = new THREE.PerspectiveCamera(38, 1, 0.01, 10);
    svCamera.position.set(0, -0.5, 0); // (0.22, -0.38, 0.18)
    svCamera.lookAt(0, 0, 0);
    svCamera.up.set(0, 0, 1);

    const svRenderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    svRenderer.setSize(SIZE, SIZE);
    svRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    svRenderer.setClearColor(0x000000, 0); // transparent background handled by CSS

    // Lights
    svScene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const svKey = new THREE.DirectionalLight(0xffffff, 1.1);
    svKey.position.set(1, -1, 2);
    svScene.add(svKey);
    const svFill = new THREE.DirectionalLight(0x88aaff, 0.4);
    svFill.position.set(-1, 1, -1);
    svScene.add(svFill);

    // Baseball ball (reuse the same texture creator)
    const svBallGeo = new THREE.SphereGeometry(0.1, 48, 48);
    const svTexture = createBaseballTexture();
    const svBallMat = new THREE.MeshPhongMaterial({
        map: svTexture,
        shininess: 45,
        bumpMap: svTexture,
        bumpScale: 0.003
    });
    const svBall = new THREE.Mesh(svBallGeo, svBallMat);
    svScene.add(svBall);

    // Spin-axis arrow (ArrowHelper: from -axis tip to +axis tip)
    const svArrow = new THREE.ArrowHelper(
        new THREE.Vector3(0, 0, 1),  // initial direction (up)
        new THREE.Vector3(0, 0, -0.14), // origin (bottom of arrow)
        0.28,   // length
        0x00ddff,  // hex color
        0.06,   // headLength
        0.035   // headWidth
    );
    svScene.add(svArrow);

    // Opposite-end stub (makes it look like a double-headed axis line)
    const svArrowBack = new THREE.ArrowHelper(
        new THREE.Vector3(0, 0, -1),
        new THREE.Vector3(0, 0, 0.14),
        0.18,
        0x00ddff,
        0.045,
        0.028
    );
    svArrowBack.line.material.transparent = true;
    svArrowBack.line.material.opacity = 0.45;
    svArrowBack.cone.material.transparent = true;
    svArrowBack.cone.material.opacity = 0.45;
    svScene.add(svArrowBack);

    spinViewer = {
        renderer: svRenderer,
        scene: svScene,
        camera: svCamera,
        ball: svBall,
        arrow: svArrow,
        arrowBack: svArrowBack,
        canvas,
        label,
        time: 0
    };
}

function updateSpinViewer(dt) {
    if (!spinViewer) return;

    const isPitcher = (state.activeCamera === 'pitcher');
    spinViewer.canvas.style.display = isPitcher ? 'block' : 'none';
    spinViewer.label.style.display = isPitcher ? 'block' : 'none';
    if (!isPitcher) return;

    spinViewer.time += dt;

    // Spin axis direction from tilt angle
    // tilt 0° → 12:00 → pure backspin → axis points in +X (catcher-right)
    // tilt 90° → 3:00 → pure sidespin → axis points in -Z (down)
    // tilt 90° → 3:00 → pure sidespin → axis points in +Z (up)
    const tiltRad = state.spinTilt * Math.PI / 180;
    const axisDir = new THREE.Vector3(
        Math.cos(tiltRad),   // X component
        0,                   // no Y (gyro ignored for display)
        -Math.sin(tiltRad)   // Z component
    ).normalize();

    // Update arrow orientation
    spinViewer.arrow.setDirection(axisDir);
    spinViewer.arrow.position.copy(axisDir.clone().multiplyScalar(-0.14));
    spinViewer.arrowBack.setDirection(axisDir.clone().negate());
    spinViewer.arrowBack.position.copy(axisDir.clone().multiplyScalar(0.14));

    // Rotate the ball around spin axis
    const spinRateRad = state.spinRate * 2 * Math.PI / 60;
    // Animate at 1% speed so the seam motion is visible
    const angle = spinRateRad * spinViewer.time * 0.01;
    spinViewer.ball.quaternion.setFromAxisAngle(axisDir, angle);

    spinViewer.renderer.render(spinViewer.scene, spinViewer.camera);
}
// ─────────────────────────────────────────────────────────────────────────────

// Update camera position based on selection
function updateCameraView() {
    if (!orbitControls) return;

    orbitControls.enabled = false;

    // Rotate camera so Z-axis is up (ground at the bottom)
    camera.up.set(0, 0, 1);

    // target defaults
    const homePlateCenter = new THREE.Vector3(0, 18.44, (1.6 + (3.5 - 1.6) / 2) * FT_TO_M); // center of strike zone
    const releaseCenter = new THREE.Vector3(-state.releaseX * FT_TO_M, state.releaseExtension * FT_TO_M, state.releaseHeight * FT_TO_M);

    switch (state.activeCamera) {
        case 'pitcher':
            // Behind pitcher looking towards home plate
            camera.position.set(0, 2, 1.5);
            orbitControls.target.copy(homePlateCenter);
            break;

        case 'batter':
            // RHP batter view (slightly to the right side of home plate looking back at pitcher)
            camera.position.set(1.4, 19.1, 1.1);
            orbitControls.target.copy(releaseCenter);
            break;

        case 'catcher':
            // Right behind the catcher/umpire looking through the strike zone at the pitcher
            camera.position.set(0, 20.3, 0.95);
            orbitControls.target.copy(homePlateCenter);
            break;

        case 'side':
            // Side view showing whole trajectory
            camera.position.set(22, 10, 3);
            orbitControls.target.set(0, 9.22, 2.0);
            break;

        case 'interactive':
            // Turn orbit controls on and let user control
            orbitControls.enabled = true;
            camera.position.set(2, 24, 3);
            orbitControls.target.copy(homePlateCenter);
            break;
    }

    orbitControls.update();

    // Visual tweak: adjust field of view based on side vs longitudinal views
    if (state.activeCamera === 'side') {
        camera.fov = 35;
    } else {
        camera.fov = 45;
    }
    camera.updateProjectionMatrix();
}

function initStrikeZoneCanvas() {
    szCanvas = document.getElementById('strike-zone-canvas');
    szCtx = szCanvas.getContext('2d');
}

// 2D Strike Zone Drawing
function draw2DStrikeZone(actualCross, spinlessCross, resultText) {
    const width = szCanvas.width;
    const height = szCanvas.height;
    szCtx.clearRect(0, 0, width, height);

    // Coordinates conversion
    // Strike zone width: 17 inches (-8.5" to +8.5" in x)
    // Strike zone height: 1.5 ft to 3.5 ft (18" to 42" in z)
    // Let's map Canvas X (0 to 160) to X inches (-16" to 16")
    // Canvas Y (200 to 0) to Z inches (10" to 50")
    const xMinIn = -15;
    const xMaxIn = 15;
    const zMinIn = 10;
    const zMaxIn = 52;

    const getCanvasX = (inX) => ((inX - xMinIn) / (xMaxIn - xMinIn)) * width;
    const getCanvasY = (inZ) => height - ((inZ - zMinIn) / (zMaxIn - zMinIn)) * height;

    // Draw strike zone divisions (3x3 grid)
    const szLeft = getCanvasX(-8.5);
    const szRight = getCanvasX(8.5);
    const szTop = getCanvasY(42); // 3.5 ft
    const szBottom = getCanvasY(18); // 1.5 ft

    const szW = szRight - szLeft;
    const szH = szBottom - szTop;

    // Backdrop
    szCtx.fillStyle = 'rgba(255, 255, 255, 0.02)';
    szCtx.fillRect(szLeft, szTop, szW, szH);

    // Outer Zone Border
    szCtx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    szCtx.lineWidth = 2;
    szCtx.strokeRect(szLeft, szTop, szW, szH);

    // Grid divisions
    szCtx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    szCtx.lineWidth = 1;

    // Columns
    szCtx.beginPath();
    szCtx.moveTo(szLeft + szW / 3, szTop);
    szCtx.lineTo(szLeft + szW / 3, szBottom);
    szCtx.moveTo(szLeft + (2 * szW) / 3, szTop);
    szCtx.lineTo(szLeft + (2 * szW) / 3, szBottom);
    // Rows
    szCtx.moveTo(szLeft, szTop + szH / 3);
    szCtx.lineTo(szRight, szTop + szH / 3);
    szCtx.moveTo(szLeft, szTop + (2 * szH) / 3);
    szCtx.lineTo(szRight, szTop + (2 * szH) / 3);
    szCtx.stroke();

    // Label plate edges
    szCtx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    szCtx.font = '9px Outfit';
    szCtx.textAlign = 'center';
    szCtx.fillText("STRIKE ZONE", width / 2, szTop - 8);

    // Draw home plate outline (flat projection at bottom of graphic)
    const plateZBottom = 8; // draw at height 8"
    szCtx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    szCtx.beginPath();
    szCtx.moveTo(getCanvasX(-8.5), getCanvasY(plateZBottom));
    szCtx.lineTo(getCanvasX(8.5), getCanvasY(plateZBottom));
    szCtx.lineTo(getCanvasX(8.5), getCanvasY(plateZBottom - 2));
    szCtx.lineTo(getCanvasX(0), getCanvasY(plateZBottom - 4));
    szCtx.lineTo(getCanvasX(-8.5), getCanvasY(plateZBottom - 2));
    szCtx.closePath();
    szCtx.stroke();

    // 1. Draw Spinless Cross Point (if visible)
    let spinlessCanvasX = 0;
    let spinlessCanvasY = 0;
    if (state.showSpinless && spinlessCross) {
        spinlessCanvasX = getCanvasX(-spinlessCross.x * M_TO_IN);
        spinlessCanvasY = getCanvasY(spinlessCross.z * M_TO_IN);

        szCtx.fillStyle = 'rgba(255, 0, 85, 0.3)';
        szCtx.beginPath();
        szCtx.arc(spinlessCanvasX, spinlessCanvasY, 6, 0, Math.PI * 2);
        szCtx.fill();

        szCtx.strokeStyle = 'rgba(255, 0, 85, 0.6)';
        szCtx.lineWidth = 1;
        szCtx.stroke();

        // draw miniature 'X' inside
        szCtx.beginPath();
        szCtx.moveTo(spinlessCanvasX - 3, spinlessCanvasY - 3);
        szCtx.lineTo(spinlessCanvasX + 3, spinlessCanvasY + 3);
        szCtx.moveTo(spinlessCanvasX + 3, spinlessCanvasY - 3);
        szCtx.lineTo(spinlessCanvasX - 3, spinlessCanvasY + 3);
        szCtx.stroke();
    }

    // 2. Draw Actual Cross Point
    if (actualCross) {
        const actualCanvasX = getCanvasX(-actualCross.x * M_TO_IN);
        const actualCanvasY = getCanvasY(actualCross.z * M_TO_IN);

        const isStrike = (resultText === 'STRIKE');
        const color = isStrike ? '#b7ff3c' : '#00aeff'; // #ff3366
        const glow = isStrike ? 'rgba(51, 255, 51, 0.4)' : 'rgba(0, 174, 255, 0.4)'; // rgba(255, 51, 102, 0.4)'

        // Draw movement vector arrow (from spinless to actual)
        if (state.showSpinless && spinlessCross) {
            szCtx.strokeStyle = '#00ffaa';
            szCtx.lineWidth = 1.5;
            szCtx.setLineDash([2, 2]);
            szCtx.beginPath();
            szCtx.moveTo(spinlessCanvasX, spinlessCanvasY);
            szCtx.lineTo(actualCanvasX, actualCanvasY);
            szCtx.stroke();
            szCtx.setLineDash([]); // reset

            // Draw tiny arrowhead at actual point
            const angle = Math.atan2(actualCanvasY - spinlessCanvasY, actualCanvasX - spinlessCanvasX);
            szCtx.fillStyle = '#00ffaa';
            szCtx.beginPath();
            szCtx.moveTo(actualCanvasX, actualCanvasY);
            szCtx.lineTo(actualCanvasX - 5 * Math.cos(angle - Math.PI / 6), actualCanvasY - 5 * Math.sin(angle - Math.PI / 6));
            szCtx.lineTo(actualCanvasX - 5 * Math.cos(angle + Math.PI / 6), actualCanvasY - 5 * Math.sin(angle + Math.PI / 6));
            szCtx.fill();
        }

        // Actual ball landing spot dot
        // Glow circle
        szCtx.fillStyle = glow;
        szCtx.beginPath();
        szCtx.arc(actualCanvasX, actualCanvasY, 9, 0, Math.PI * 2);
        szCtx.fill();

        // Core circle
        szCtx.fillStyle = color;
        szCtx.beginPath();
        szCtx.arc(actualCanvasX, actualCanvasY, 6, 0, Math.PI * 2);
        szCtx.fill();

        szCtx.strokeStyle = '#ffffff';
        szCtx.lineWidth = 1.5;
        szCtx.beginPath();
        szCtx.arc(actualCanvasX, actualCanvasY, 6, 0, Math.PI * 2);
        szCtx.stroke();
    }
}

// Core Simulation execution
function runSimulation() {
    // Pack parameters
    const params = {
        speed: state.speed,
        spinRate: state.spinRate,
        spinTilt: state.spinTilt,
        gyroEfficiency: state.gyroEfficiency / 100, // percentage to fraction
        releaseHeight: state.releaseHeight * FT_TO_M,
        releaseX: state.releaseX * FT_TO_M,
        releaseExtension: state.releaseExtension * FT_TO_M,
        launchAngleZ: state.launchAngleZ,
        launchAngleX: state.launchAngleX
    };

    // Simulate
    state.simResult = window.Physics.simulatePitch(params);
    const result = state.simResult;

    // 1. Update Trajectory Trails
    const actualPoints = result.path.map(p => new THREE.Vector3(-p.x, p.y, p.z));
    actualTrailLine.geometry.dispose();
    actualTrailLine.geometry = new THREE.BufferGeometry().setFromPoints(actualPoints);
    actualTrailLine.visible = true;

    if (state.showSpinless) {
        const spinlessPoints = result.pathSpinless.map(p => new THREE.Vector3(-p.x, p.y, p.z));
        spinlessTrailLine.geometry.dispose();
        spinlessTrailLine.geometry = new THREE.BufferGeometry().setFromPoints(spinlessPoints);
        spinlessTrailLine.visible = true;

        spinlessBallMesh.visible = true;
        spinlessBallShadow.visible = true;
        document.getElementById('legend-spinless').style.opacity = '1';
    } else {
        spinlessTrailLine.visible = false;
        spinlessBallMesh.visible = false;
        spinlessBallShadow.visible = false;
        document.getElementById('legend-spinless').style.opacity = '0.3';
    }

    // 2. Fetch landing points at home plate (front face crossing point)
    const plateState = result.path[result.path.length - 1];
    const plateStateSpinless = result.pathSpinless[result.pathSpinless.length - 1];

    // 3. Determine if Strike or Ball
    // Strike zone: width = [-17"/2, 17"/2], height = [1.5 ft, 3.5 ft] in feet.
    // Convert plate crossing to inches
    const plateXIn = plateState.x * M_TO_IN;
    const plateZIn = plateState.z * M_TO_IN;

    const isInsideX = Math.abs(plateXIn) <= 8.5;
    const isInsideZ = plateZIn >= 18.0 && plateZIn <= 42.0; // 1.5ft to 3.5ft

    const isStrike = isInsideX && isInsideZ;
    const resultText = isStrike ? 'STRIKE' : 'BALL';

    // Update Result Banner CSS
    const banner = document.getElementById('result-banner');
    banner.textContent = resultText;
    if (isStrike) {
        banner.className = 'result-banner strike';
        strikeZoneFrontFrame.material.color.setHex(0xadff2f); //0xff3366
    } else {
        banner.className = 'result-banner ball';
        strikeZoneFrontFrame.material.color.setHex(0x00c8ff);
    }

    // 4. Update Live Analytics Panels
    document.getElementById('metric-ivb').textContent = `${result.metrics.inducedVerticalBreakIn >= 0 ? '+' : ''}${result.metrics.inducedVerticalBreakIn.toFixed(1)}"`;
    document.getElementById('metric-hb').textContent = `${result.metrics.horizontalBreakIn >= 0 ? '+' : ''}${result.metrics.horizontalBreakIn.toFixed(1)}"`;
    document.getElementById('metric-plateSpeed').textContent = `${result.metrics.plateSpeedMph.toFixed(1)} mph`;
    document.getElementById('metric-flightTime').textContent = `${result.metrics.flightTime.toFixed(3)} s`;

    // Apply colors to metrics to indicate direction
    const ivbEl = document.getElementById('metric-ivb');
    if (result.metrics.inducedVerticalBreakIn > 5) {
        ivbEl.style.color = '#38b000'; // high rise
    } else if (result.metrics.inducedVerticalBreakIn < -5) {
        ivbEl.style.color = '#ff0055'; // drop
    } else {
        ivbEl.style.color = '#fff';
    }

    const hbEl = document.getElementById('metric-hb');
    if (Math.abs(result.metrics.horizontalBreakIn) > 5) {
        hbEl.style.color = '#0088ff'; // sweep
    } else {
        hbEl.style.color = '#fff';
    }

    // Draw 2D Strike Zone
    draw2DStrikeZone(plateState, plateStateSpinless, resultText);

    // Reset animation time
    animationTime = 0;
    isAnimating = true;
}

// Main Animation Loop
function animate() {
    requestAnimationFrame(animate);

    // Update Orbit controls if active
    if (orbitControls && orbitControls.enabled) {
        orbitControls.update();
    }

    // Ball Flight Animation
    if (state.simResult && isAnimating) {
        const result = state.simResult;
        const path = result.path;
        const pathSpinless = result.pathSpinless;

        // Find current step based on animationTime
        // animationTime is in real-time simulation seconds
        // delta is calculated assuming typical refresh rate
        const dt = 0.016 * state.animationSpeed; // slow motion scale
        animationTime += dt;

        // Fetch interpolation points along the actual path
        let actualPoint = null;
        let spinlessPoint = null;

        // Find indices
        let idx = 0;
        while (idx < path.length - 1 && path[idx].t < animationTime) {
            idx++;
        }

        if (idx === 0) {
            actualPoint = path[0];
            spinlessPoint = pathSpinless[0];
        } else if (idx >= path.length - 1) {
            actualPoint = path[path.length - 1];
            spinlessPoint = pathSpinless[pathSpinless.length - 1];
            isAnimating = false; // stop at home plate
        } else {
            const pPrev = path[idx - 1];
            const pNext = path[idx];
            const ratio = (animationTime - pPrev.t) / (pNext.t - pPrev.t);

            actualPoint = {
                x: pPrev.x + ratio * (pNext.x - pPrev.x),
                y: pPrev.y + ratio * (pNext.y - pPrev.y),
                z: pPrev.z + ratio * (pNext.z - pPrev.z)
            };

            // Spinless interpolation
            let sIdx = Math.min(idx, pathSpinless.length - 1);
            if (sIdx > 0) {
                const sPrev = pathSpinless[sIdx - 1];
                const sNext = pathSpinless[sIdx];
                const sRatio = Math.min(1, Math.max(0, (animationTime - sPrev.t) / (sNext.t - sPrev.t)));
                spinlessPoint = {
                    x: sPrev.x + sRatio * (sNext.x - sPrev.x),
                    y: sPrev.y + sRatio * (sNext.y - sPrev.y),
                    z: sPrev.z + sRatio * (sNext.z - sPrev.z)
                };
            } else {
                spinlessPoint = pathSpinless[0];
            }
        }

        // Update Ball Position
        ballMesh.position.set(-actualPoint.x, actualPoint.y, actualPoint.z);
        // Spin the ball: rotate sphere around the spin vector
        // Convert spin rate to rotation angle
        const spinRateRad = state.spinRate * 2 * Math.PI / 60;
        // Spin axis (tilt and velocity aligned)
        // For simplicity, we rotate around the general spin axis calculated in physics.js
        // Rotate by spinRateRad * animationTime
        const rotationAngle = spinRateRad * animationTime;

        // Calculate axis direction
        const tiltRad = state.spinTilt * Math.PI / 180;
        const axisX = Math.cos(tiltRad);
        const axisZ = Math.sin(tiltRad);
        const rotationAxis = new THREE.Vector3(axisX, 0, axisZ).normalize();

        // Apply quaternion rotation to ball mesh
        ballMesh.quaternion.setFromAxisAngle(rotationAxis, rotationAngle);

        // Update Shadow on the ground (z=0.005)
        ballShadow.position.set(-actualPoint.x, actualPoint.y, 0.005);
        // Shadow opacity decreases as ball gets higher
        ballShadow.material.opacity = Math.max(0.1, 0.6 - actualPoint.z * 0.15);
        // Shadow size increases slightly as ball gets higher (diffuse)
        const scale = 1 + actualPoint.z * 0.25;
        ballShadow.scale.set(scale, scale, 1);

        // Update Spinless Reference Ball
        if (state.showSpinless && spinlessPoint) {
            spinlessBallMesh.position.set(-spinlessPoint.x, spinlessPoint.y, spinlessPoint.z);
            spinlessBallShadow.position.set(-spinlessPoint.x, spinlessPoint.y, 0.005);
            spinlessBallShadow.material.opacity = Math.max(0.05, 0.4 - spinlessPoint.z * 0.12);
        }
    } else if (!isAnimating) {
        // If animation completed, hold at home plate
        const finalActual = state.simResult.path[state.simResult.path.length - 1];
        const finalSpinless = state.simResult.pathSpinless[state.simResult.pathSpinless.length - 1];

        ballMesh.position.set(-finalActual.x, finalActual.y, finalActual.z);
        ballShadow.position.set(-finalActual.x, finalActual.y, 0.005);

        if (state.showSpinless) {
            spinlessBallMesh.position.set(-finalSpinless.x, finalSpinless.y, finalSpinless.z);
            spinlessBallShadow.position.set(-finalSpinless.x, finalSpinless.y, 0.005);
        }
    }

    // Render scene
    renderer.render(scene, camera);

    // Render spin-viewer inset
    const frameDt = 0.016; // ~60fps assumed
    updateSpinViewer(frameDt);
}

// Preset loader
function applyPreset(name) {
    const preset = PRESETS[name];
    if (!preset) return;

    // Update state
    state.speed = preset.speed;
    state.spinRate = preset.spinRate;
    state.spinTilt = preset.spinTilt;
    state.gyroEfficiency = preset.gyroEfficiency;

    state.releaseHeight = preset.releaseHeight;
    state.releaseX = preset.releaseX;
    state.releaseExtension = preset.releaseExtension;
    state.launchAngleZ = preset.launchAngleZ;
    state.launchAngleX = preset.launchAngleX;

    // Update UI controls
    document.getElementById('input-speed').value = preset.speed;
    document.getElementById('val-speed').textContent = preset.speed;

    document.getElementById('input-spinRate').value = preset.spinRate;
    document.getElementById('val-spinRate').textContent = preset.spinRate;

    document.getElementById('input-spinTilt').value = degToSliderVal(preset.spinTilt);
    updateSpinTiltUI(preset.spinTilt);

    document.getElementById('input-gyroEfficiency').value = preset.gyroEfficiency;
    document.getElementById('val-gyroEfficiency').textContent = preset.gyroEfficiency;

    // Fine Adjustments
    document.getElementById('input-releaseHeight').value = preset.releaseHeight;
    document.getElementById('val-releaseHeight').textContent = preset.releaseHeight.toFixed(1);

    document.getElementById('input-releaseX').value = preset.releaseX;
    document.getElementById('val-releaseX').textContent = preset.releaseX.toFixed(1);

    document.getElementById('input-releaseExtension').value = preset.releaseExtension;
    document.getElementById('val-releaseExtension').textContent = preset.releaseExtension.toFixed(1);

    document.getElementById('input-launchAngleZ').value = preset.launchAngleZ;
    document.getElementById('val-launchAngleZ').textContent = preset.launchAngleZ.toFixed(1);

    document.getElementById('input-launchAngleX').value = preset.launchAngleX;
    document.getElementById('val-launchAngleX').textContent = preset.launchAngleX.toFixed(1);

    // Presets active class styling
    document.querySelectorAll('.preset-btn').forEach(btn => {
        if (btn.getAttribute('data-preset') === name) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

// Convert degree in [0, 360) to slider value in [-179, 180]
function degToSliderVal(deg) {
    let d = deg % 360;
    if (d < 0) d += 360;
    if (d > 180) {
        d -= 360;
    }
    return d;
}

// Convert tilt angle (degrees) to Clock string format
function tiltToClock(deg) {
    const totalMinutes = Math.round(deg * 2); // 360 degrees = 720 minutes
    let hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours === 0) hours = 12;

    const minutesStr = minutes.toString().padStart(2, '0');
    return `${hours}:${minutesStr}`;
}

// Update clock dial hand position & text display
function updateSpinTiltUI(deg) {
    document.getElementById('val-spinTilt').textContent = `${deg}°`;
    document.getElementById('val-spinClock').textContent = tiltToClock(deg);

    // Rotate the SVG dial hand
    // SVG hand starts at top (12:00, which is 0 degrees tilt)
    // Rotate it clockwise by deg degrees
    const dialHand = document.getElementById('dial-hand');
    dialHand.setAttribute('transform', `rotate(${deg}, 0, 0)`);
}

// Set up UI Event listeners
function setupEventListeners() {
    // 1. Presets Buttons
    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const name = e.target.getAttribute('data-preset');
            applyPreset(name);
            runSimulation();
            updateCameraView(); // reset target to pitch zone
        });
    });

    // 2. Physics & Geometry sliders
    const connectSlider = (sliderId, stateProp, valDisplayId, decimals = 0, isTilt = false) => {
        const slider = document.getElementById(sliderId);
        const display = document.getElementById(valDisplayId);

        slider.addEventListener('input', (e) => {
            let val = parseFloat(e.target.value);

            // Remove active classes on presets when sliders are adjusted manually
            if (stateProp === 'speed' || stateProp === 'spinRate' || stateProp === 'spinTilt' || stateProp === 'gyroEfficiency') {
                document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
            }

            if (isTilt) {
                let normalizedVal = val < 0 ? val + 360 : val;
                state[stateProp] = normalizedVal;
                updateSpinTiltUI(normalizedVal);
            } else {
                state[stateProp] = val;
                display.textContent = decimals > 0 ? val.toFixed(decimals) : val;
            }

            runSimulation();
        });
    };

    connectSlider('input-speed', 'speed', 'val-speed');
    connectSlider('input-spinRate', 'spinRate', 'val-spinRate');
    connectSlider('input-spinTilt', 'spinTilt', '', 0, true);
    connectSlider('input-gyroEfficiency', 'gyroEfficiency', 'val-gyroEfficiency');

    connectSlider('input-releaseHeight', 'releaseHeight', 'val-releaseHeight', 1);
    connectSlider('input-releaseX', 'releaseX', 'val-releaseX', 1);
    connectSlider('input-releaseExtension', 'releaseExtension', 'val-releaseExtension', 1);
    connectSlider('input-launchAngleZ', 'launchAngleZ', 'val-launchAngleZ', 1);
    connectSlider('input-launchAngleX', 'launchAngleX', 'val-launchAngleX', 1);

    // 3. SVG Clock dial click/drag interface
    const dialSvg = document.getElementById('clock-dial');
    let isDraggingDial = false;

    const handleDialInteraction = (e) => {
        const rect = dialSvg.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        // Calculate angle between center and mouse pointer
        const mouseX = e.clientX;
        const mouseY = e.clientY;
        const dx = mouseX - centerX;
        const dy = mouseY - centerY;

        // Angle in radians (starting from top y axis going clockwise)
        // Math.atan2(y, x) starts from right x axis going counter-clockwise
        // We want 0 degrees at top (x=0, y=-1)
        let angleDeg = Math.round(Math.atan2(dy, dx) * 180 / Math.PI) + 90;
        if (angleDeg < 0) angleDeg += 360;

        state.spinTilt = angleDeg;
        document.getElementById('input-spinTilt').value = degToSliderVal(angleDeg);
        updateSpinTiltUI(angleDeg);

        // Remove preset highlight
        document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));

        runSimulation();
    };

    dialSvg.addEventListener('mousedown', (e) => {
        isDraggingDial = true;
        handleDialInteraction(e);
    });

    window.addEventListener('mousemove', (e) => {
        if (isDraggingDial) {
            handleDialInteraction(e);
        }
    });

    window.addEventListener('mouseup', () => {
        isDraggingDial = false;
    });

    // Touch support for dial (tablets/phones)
    dialSvg.addEventListener('touchstart', (e) => {
        isDraggingDial = true;
        if (e.touches.length > 0) {
            handleDialInteraction(e.touches[0]);
        }
        e.preventDefault();
    });
    dialSvg.addEventListener('touchmove', (e) => {
        if (isDraggingDial && e.touches.length > 0) {
            handleDialInteraction(e.touches[0]);
        }
        e.preventDefault();
    });
    dialSvg.addEventListener('touchend', () => {
        isDraggingDial = false;
    });

    // 4. Camera view buttons
    document.querySelectorAll('.cam-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const btnEl = e.currentTarget;
            state.activeCamera = btnEl.getAttribute('data-camera');

            document.querySelectorAll('.cam-btn').forEach(b => b.classList.remove('active'));
            btnEl.classList.add('active');

            updateCameraView();
        });
    });

    // 5. Show Spinless Toggle
    const toggleSpinless = document.getElementById('toggle-spinless');
    toggleSpinless.addEventListener('change', (e) => {
        state.showSpinless = e.target.checked;
        runSimulation();
    });

    // 6. Accordion Toggle (Release parameters)
    const accHeader = document.getElementById('release-geometry-toggle');
    const accContent = document.getElementById('release-geometry-content');
    accHeader.addEventListener('click', () => {
        accHeader.classList.toggle('open');
        accContent.classList.toggle('open');
    });

    // Double click viewport to replay animation
    document.getElementById('canvas-container').addEventListener('dblclick', () => {
        animationTime = 0;
        isAnimating = true;
    });
}
