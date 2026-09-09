/**
 * 3D WebGL Kinetic Sculpture & Shader Lab Engine
 * Project 5 - Group 3
 * Powered by Three.js
 */

const THEMES = {
  cyberpunk: {
    name: '사이버펑크',
    primary: 0xa855f7,
    secondary: 0xec4899,
    accent: 0x38bdf8,
    bg: 0x06060c
  },
  violet: {
    name: '네뷸라 바이올렛',
    primary: 0x8b5cf6,
    secondary: 0xc084fc,
    accent: 0x6366f1,
    bg: 0x070414
  },
  gold: {
    name: '리퀴드 골드',
    primary: 0xf59e0b,
    secondary: 0xfbbf24,
    accent: 0xd97706,
    bg: 0x0e0903
  },
  emerald: {
    name: '에메랄드 퀀텀',
    primary: 0x10b981,
    secondary: 0x06b6d4,
    accent: 0x34d399,
    bg: 0x020f0d
  },
  ice: {
    name: '프로즌 크리스탈',
    primary: 0x38bdf8,
    secondary: 0x93c5fd,
    accent: 0xe0f2fe,
    bg: 0x040a14
  }
};

class WebGLLabEngine {
  constructor() {
    this.canvas = document.getElementById('webgl-canvas');

    // Parameters
    this.shapeType = 'torusKnot'; // 'torusKnot' | 'geosphere' | 'waveGrid' | 'helix' | 'polyhedron'
    this.materialType = 'hologram'; // 'hologram' | 'chrome' | 'wireframe' | 'neonGlow' | 'points'
    this.themeKey = 'cyberpunk';
    this.theme = THEMES[this.themeKey];

    this.rotSpeed = 1.0;
    this.deformAmp = 0.35;
    this.deformFreq = 2.5;
    this.metalness = 0.85;
    this.roughness = 0.15;
    this.lightIntensity = 1.5;

    this.isAutoRotate = true;
    this.isDeforming = true;
    this.isWireframeOverlay = false;
    this.isPaused = false;

    // Performance
    this.lastTime = performance.now();
    this.frameCount = 0;
    this.fps = 60;
    this.fpsTimer = performance.now();

    // Built-in Camera Orbit Control state
    this.camDistance = 7.5;
    this.camTargetDistance = 7.5;
    this.camRotX = 0.2;
    this.camRotY = 0;
    this.camTargetRotX = 0.2;
    this.camTargetRotY = 0;
    this.isDragging = false;
    this.prevMousePos = { x: 0, y: 0 };
    this.touchStartDist = 0;

    this.init();
  }

  init() {
    if (typeof THREE === 'undefined') {
      console.error('Three.js library is not loaded');
      this.showToast('Three.js 라이브러리를 불러오는 중입니다...');
      return;
    }

    try {
      this.setupScene();
      this.setupLights();
      this.setupBackgroundParticles();
      this.buildSculpture();
      this.setupCameraControls();
      this.bindUI();

      window.addEventListener('resize', () => this.onResize());
      this.animate(performance.now());
    } catch (e) {
      console.error('WebGL Init Error:', e);
      this.showToast('WebGL 초기화 에러: ' + e.message);
    }
  }

  setupScene() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(this.theme.bg);
    this.scene.fog = new THREE.FogExp2(this.theme.bg, 0.04);

    this.camera = new THREE.PerspectiveCamera(45, this.width / this.height, 0.1, 100);
    this.updateCameraPosition();

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    if (THREE.ACESFilmicToneMapping) {
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.15;
    }
  }

  setupCameraControls() {
    // If OrbitControls is available, initialize it with fallback
    if (typeof THREE.OrbitControls === 'function') {
      try {
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.rotateSpeed = 0.8;
        this.controls.minDistance = 3.0;
        this.controls.maxDistance = 16.0;
        return;
      } catch (e) {
        console.warn('Using built-in smooth orbit fallback', e);
      }
    }

    // High-performance built-in smooth Orbit Controller (zero dependencies)
    const dom = this.canvas;

    dom.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.prevMousePos = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.prevMousePos.x;
      const dy = e.clientY - this.prevMousePos.y;

      this.camTargetRotY += dx * 0.005;
      this.camTargetRotX += dy * 0.005;

      // Clamp vertical angle
      this.camTargetRotX = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, this.camTargetRotX));
      this.prevMousePos = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    dom.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.camTargetDistance += e.deltaY * 0.006;
      this.camTargetDistance = Math.max(3.0, Math.min(16.0, this.camTargetDistance));
    }, { passive: false });

    // Touch support
    dom.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        this.isDragging = true;
        this.prevMousePos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else if (e.touches.length === 2) {
        this.touchStartDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      }
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      if (e.touches.length === 1 && this.isDragging) {
        const dx = e.touches[0].clientX - this.prevMousePos.x;
        const dy = e.touches[0].clientY - this.prevMousePos.y;

        this.camTargetRotY += dx * 0.006;
        this.camTargetRotX += dy * 0.006;
        this.camTargetRotX = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, this.camTargetRotX));

        this.prevMousePos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else if (e.touches.length === 2) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const factor = (this.touchStartDist - dist) * 0.01;
        this.camTargetDistance += factor;
        this.camTargetDistance = Math.max(3.0, Math.min(16.0, this.camTargetDistance));
        this.touchStartDist = dist;
      }
    }, { passive: true });

    window.addEventListener('touchend', () => {
      this.isDragging = false;
    });
  }

  updateCameraPosition() {
    // Smooth interpolation for built-in camera
    this.camRotX += (this.camTargetRotX - this.camRotX) * 0.1;
    this.camRotY += (this.camTargetRotY - this.camRotY) * 0.1;
    this.camDistance += (this.camTargetDistance - this.camDistance) * 0.1;

    const x = this.camDistance * Math.sin(this.camRotY) * Math.cos(this.camRotX);
    const y = this.camDistance * Math.sin(this.camRotX);
    const z = this.camDistance * Math.cos(this.camRotY) * Math.cos(this.camRotX);

    this.camera.position.set(x, y, z);
    this.camera.lookAt(0, 0, 0);
  }

  setupLights() {
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(this.ambientLight);

    // Orbital Point Lights
    this.light1 = new THREE.PointLight(this.theme.primary, 3, 20);
    this.light2 = new THREE.PointLight(this.theme.secondary, 3, 20);
    this.light3 = new THREE.PointLight(this.theme.accent, 2.5, 20);

    this.scene.add(this.light1);
    this.scene.add(this.light2);
    this.scene.add(this.light3);

    // Directional Rim Light
    this.dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    this.dirLight.position.set(5, 10, 7);
    this.scene.add(this.dirLight);
  }

  setupBackgroundParticles() {
    const starCount = 1200;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);

    const c1 = new THREE.Color(this.theme.primary);
    const c2 = new THREE.Color(this.theme.accent);

    for (let i = 0; i < starCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 35;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 35;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 35;

      const mixed = c1.clone().lerp(c2, Math.random());
      colors[i * 3] = mixed.r;
      colors[i * 3 + 1] = mixed.g;
      colors[i * 3 + 2] = mixed.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.06,
      vertexColors: true,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending
    });

    this.starField = new THREE.Points(geometry, material);
    this.scene.add(this.starField);
  }

  buildSculpture() {
    // Remove existing sculpture if present
    if (this.sculptureGroup) {
      this.scene.remove(this.sculptureGroup);
      this.disposeObject(this.sculptureGroup);
    }

    this.sculptureGroup = new THREE.Group();

    // Create Base Geometry
    this.currentGeometry = this.createGeometry(this.shapeType);
    this.originalPositions = this.currentGeometry.attributes.position.clone();

    // Create Materials
    this.mainMaterial = this.createMaterial(this.materialType);

    if (this.materialType === 'points') {
      this.mainMesh = new THREE.Points(this.currentGeometry, this.mainMaterial);
    } else {
      this.mainMesh = new THREE.Mesh(this.currentGeometry, this.mainMaterial);
    }

    this.sculptureGroup.add(this.mainMesh);

    // Wireframe Overlay Mesh
    const wireMat = new THREE.MeshBasicMaterial({
      color: this.theme.accent,
      wireframe: true,
      transparent: true,
      opacity: 0.35
    });
    this.wireMesh = new THREE.Mesh(this.currentGeometry, wireMat);
    this.wireMesh.visible = this.isWireframeOverlay;
    this.sculptureGroup.add(this.wireMesh);

    // Inner glowing core sphere for depth
    const coreGeo = new THREE.SphereGeometry(0.65, 24, 24);
    const coreMat = new THREE.MeshBasicMaterial({
      color: this.theme.primary,
      wireframe: true,
      transparent: true,
      opacity: 0.25
    });
    this.coreMesh = new THREE.Mesh(coreGeo, coreMat);
    this.sculptureGroup.add(this.coreMesh);

    this.scene.add(this.sculptureGroup);

    // Update Telemetry
    this.updateTelemetry();
  }

  createGeometry(type) {
    switch (type) {
      case 'torusKnot':
        return new THREE.TorusKnotGeometry(1.6, 0.48, 140, 36, 2, 3);
      case 'geosphere':
        return new THREE.IcosahedronGeometry(2.1, 5);
      case 'waveGrid': {
        const plane = new THREE.PlaneGeometry(5.2, 5.2, 48, 48);
        plane.rotateX(-Math.PI / 3);
        return plane;
      }
      case 'helix': {
        // Procedural 3D Helix Curve
        class HelixCurve extends THREE.Curve {
          constructor(scale = 1.6) {
            super();
            this.scale = scale;
          }
          getPoint(t, optionalTarget = new THREE.Vector3()) {
            const angle = 2 * Math.PI * t * 3.5;
            const x = Math.cos(angle) * this.scale;
            const y = (t - 0.5) * 4.8;
            const z = Math.sin(angle) * this.scale;
            return optionalTarget.set(x, y, z);
          }
        }
        const path = new HelixCurve(1.6);
        return new THREE.TubeGeometry(path, 120, 0.35, 24, false);
      }
      case 'polyhedron':
        return new THREE.OctahedronGeometry(2.2, 3);
      default:
        return new THREE.TorusKnotGeometry(1.6, 0.48, 120, 32);
    }
  }

  createMaterial(type) {
    const pColor = new THREE.Color(this.theme.primary);
    const sColor = new THREE.Color(this.theme.secondary);

    switch (type) {
      case 'hologram':
        return new THREE.MeshPhysicalMaterial({
          color: pColor,
          emissive: sColor,
          emissiveIntensity: 0.35,
          roughness: this.roughness,
          metalness: this.metalness,
          clearcoat: 1.0,
          clearcoatRoughness: 0.1,
          transmission: 0.35,
          ior: 1.5,
          wireframe: false
        });

      case 'chrome':
        return new THREE.MeshStandardMaterial({
          color: 0xffffff,
          roughness: 0.05,
          metalness: 0.98,
          emissive: pColor,
          emissiveIntensity: 0.15
        });

      case 'wireframe':
        return new THREE.MeshStandardMaterial({
          color: sColor,
          emissive: pColor,
          emissiveIntensity: 0.85,
          wireframe: true,
          roughness: 0.2,
          metalness: 0.5
        });

      case 'neonGlow':
        return new THREE.MeshStandardMaterial({
          color: pColor,
          emissive: sColor,
          emissiveIntensity: 0.95,
          roughness: 0.3,
          metalness: 0.3
        });

      case 'points':
        return new THREE.PointsMaterial({
          color: pColor,
          size: 0.045,
          transparent: true,
          opacity: 0.9,
          blending: THREE.AdditiveBlending
        });

      default:
        return new THREE.MeshStandardMaterial({ color: pColor });
    }
  }

  deformVertices(time) {
    if (!this.isDeforming || !this.currentGeometry) return;

    const pos = this.currentGeometry.attributes.position;
    const orig = this.originalPositions;
    const count = pos.count;
    const t = time * 0.0018 * this.rotSpeed;

    for (let i = 0; i < count; i++) {
      const ox = orig.getX(i);
      const oy = orig.getY(i);
      const oz = orig.getZ(i);

      const dist = Math.hypot(ox, oy, oz);
      const wave1 = Math.sin(dist * this.deformFreq + t * 2.0);
      const wave2 = Math.cos(ox * 2.0 + oz * 2.0 + t);
      const offset = (wave1 + wave2) * 0.5 * this.deformAmp;

      const scale = 1 + offset / (dist || 1);
      pos.setXYZ(i, ox * scale, oy * scale, oz * scale);
    }

    pos.needsUpdate = true;
    this.currentGeometry.computeVertexNormals();
  }

  animate(currentTime) {
    requestAnimationFrame((t) => this.animate(t));

    if (this.isPaused) return;

    // Controls update
    if (this.controls) {
      this.controls.update();
    } else {
      this.updateCameraPosition();
    }

    // Auto Rotation
    if (this.isAutoRotate && this.sculptureGroup) {
      this.sculptureGroup.rotation.x += 0.004 * this.rotSpeed;
      this.sculptureGroup.rotation.y += 0.007 * this.rotSpeed;
      this.sculptureGroup.rotation.z += 0.002 * this.rotSpeed;
    }

    // Dynamic Deform Mesh
    this.deformVertices(currentTime);

    // Orbital Lights Rotation
    const lt = currentTime * 0.0012;
    this.light1.position.x = Math.sin(lt) * 6;
    this.light1.position.y = Math.cos(lt * 0.7) * 4;
    this.light1.position.z = Math.cos(lt) * 6;

    this.light2.position.x = Math.cos(lt * 1.3) * 6;
    this.light2.position.y = Math.sin(lt * 0.9) * 5;
    this.light2.position.z = Math.sin(lt * 1.3) * 6;

    this.light3.position.x = Math.sin(lt * 0.5) * 5;
    this.light3.position.y = Math.cos(lt * 1.1) * 6;
    this.light3.position.z = Math.sin(lt * 0.8) * 5;

    // Background Stars gentle drift
    if (this.starField) {
      this.starField.rotation.y = lt * 0.03;
      this.starField.rotation.x = lt * 0.015;
    }

    // FPS Telemetry
    this.frameCount++;
    if (currentTime - this.fpsTimer >= 500) {
      this.fps = Math.round((this.frameCount * 1000) / (currentTime - this.fpsTimer));
      this.frameCount = 0;
      this.fpsTimer = currentTime;
      const fpsEl = document.getElementById('hud-fps');
      if (fpsEl) fpsEl.textContent = `${this.fps} FPS`;
    }

    this.renderer.render(this.scene, this.camera);
  }

  updateTelemetry() {
    if (!this.currentGeometry) return;
    const polyEl = document.getElementById('hud-polys');
    const vertices = this.currentGeometry.attributes.position.count;
    if (polyEl) polyEl.textContent = vertices.toLocaleString();
  }

  onResize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.width, this.height);
  }

  disposeObject(obj) {
    obj.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
  }

  /* -------------------------------------------------------------
     UI Bindings
     ------------------------------------------------------------- */
  bindUI() {
    // Shape Pills
    const shapePills = document.querySelectorAll('.shape-pill');
    shapePills.forEach((pill) => {
      pill.addEventListener('click', () => {
        shapePills.forEach((p) => p.classList.remove('active'));
        pill.classList.add('active');
        this.shapeType = pill.dataset.shape;
        this.buildSculpture();
        this.showToast(`3D 모델: ${pill.textContent.trim()}`);
      });
    });

    // Material Buttons
    const matBtns = document.querySelectorAll('.material-btn');
    matBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        matBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.materialType = btn.dataset.material;
        this.buildSculpture();
        this.showToast(`재질: ${btn.textContent.trim()}`);
      });
    });

    // Themes
    const themeChips = document.querySelectorAll('.theme-chip');
    themeChips.forEach((chip) => {
      chip.addEventListener('click', () => {
        themeChips.forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
        this.applyTheme(chip.dataset.theme);
      });
    });

    // Sliders
    this.bindSlider('slider-rot', 'val-rot', (v) => (this.rotSpeed = parseFloat(v)));
    this.bindSlider('slider-deform-amp', 'val-deform-amp', (v) => (this.deformAmp = parseFloat(v)));
    this.bindSlider('slider-deform-freq', 'val-deform-freq', (v) => (this.deformFreq = parseFloat(v)));
    this.bindSlider('slider-metal', 'val-metal', (v) => {
      this.metalness = parseFloat(v);
      if (this.mainMaterial && this.mainMaterial.metalness !== undefined) {
        this.mainMaterial.metalness = this.metalness;
      }
    });
    this.bindSlider('slider-rough', 'val-rough', (v) => {
      this.roughness = parseFloat(v);
      if (this.mainMaterial && this.mainMaterial.roughness !== undefined) {
        this.mainMaterial.roughness = this.roughness;
      }
    });
    this.bindSlider('slider-light', 'val-light', (v) => {
      this.lightIntensity = parseFloat(v);
      this.light1.intensity = 3 * this.lightIntensity;
      this.light2.intensity = 3 * this.lightIntensity;
      this.light3.intensity = 2.5 * this.lightIntensity;
    });

    // Toggle Buttons
    const btnAutoRot = document.getElementById('toggle-autorot');
    if (btnAutoRot) {
      btnAutoRot.addEventListener('click', () => {
        this.isAutoRotate = !this.isAutoRotate;
        btnAutoRot.classList.toggle('active', this.isAutoRotate);
      });
    }

    const btnDeform = document.getElementById('toggle-deform');
    if (btnDeform) {
      btnDeform.addEventListener('click', () => {
        this.isDeforming = !this.isDeforming;
        btnDeform.classList.toggle('active', this.isDeforming);
        if (!this.isDeforming && this.originalPositions && this.currentGeometry) {
          this.currentGeometry.attributes.position.copy(this.originalPositions);
          this.currentGeometry.attributes.position.needsUpdate = true;
          this.currentGeometry.computeVertexNormals();
        }
      });
    }

    const btnWire = document.getElementById('toggle-wire');
    if (btnWire) {
      btnWire.addEventListener('click', () => {
        this.isWireframeOverlay = !this.isWireframeOverlay;
        btnWire.classList.toggle('active', this.isWireframeOverlay);
        if (this.wireMesh) this.wireMesh.visible = this.isWireframeOverlay;
      });
    }

    // Presets
    const presetPills = document.querySelectorAll('.preset-pill');
    presetPills.forEach((pill) => {
      pill.addEventListener('click', () => {
        this.applyPreset(pill.dataset.preset);
      });
    });

    // Quick Actions
    const btnPause = document.getElementById('btn-pause');
    if (btnPause) {
      btnPause.addEventListener('click', () => {
        this.isPaused = !this.isPaused;
        btnPause.innerHTML = this.isPaused ? '▶️ 재생' : '⏸️ 일시정지';
        btnPause.classList.toggle('active', this.isPaused);
      });
    }

    const btnRandom = document.getElementById('btn-random');
    if (btnRandom) {
      btnRandom.addEventListener('click', () => this.randomizeAll());
    }

    const btnSnapshot = document.getElementById('btn-snapshot');
    if (btnSnapshot) {
      btnSnapshot.addEventListener('click', () => this.downloadSnapshot());
    }

    const btnResetCam = document.getElementById('btn-reset-cam');
    if (btnResetCam) {
      btnResetCam.addEventListener('click', () => {
        if (this.controls) {
          this.camera.position.set(0, 0, 7.5);
          this.controls.reset();
        } else {
          this.camTargetDistance = 7.5;
          this.camTargetRotX = 0.2;
          this.camTargetRotY = 0;
        }
        this.showToast('시점 초기화 완료');
      });
    }

    // Panel Toggle
    const panel = document.getElementById('gl-panel');
    const btnClose = document.getElementById('btn-close-panel');
    const btnOpen = document.getElementById('btn-open-panel');

    if (btnClose && panel) {
      btnClose.addEventListener('click', () => panel.classList.add('collapsed'));
    }
    if (btnOpen && panel) {
      btnOpen.addEventListener('click', () => panel.classList.remove('collapsed'));
    }
  }

  bindSlider(id, valId, callback) {
    const el = document.getElementById(id);
    const valEl = document.getElementById(valId);
    if (el) {
      el.addEventListener('input', (e) => {
        if (valEl) valEl.textContent = e.target.value;
        callback(e.target.value);
      });
    }
  }

  applyTheme(key) {
    this.themeKey = key;
    this.theme = THEMES[key];

    this.scene.background.set(this.theme.bg);
    this.scene.fog.color.set(this.theme.bg);

    this.light1.color.set(this.theme.primary);
    this.light2.color.set(this.theme.secondary);
    this.light3.color.set(this.theme.accent);

    this.buildSculpture();
    this.showToast(`테마: ${this.theme.name}`);
  }

  applyPreset(presetKey) {
    switch (presetKey) {
      case 'mobius':
        this.setShape('torusKnot');
        this.setMaterial('hologram');
        this.setTheme('cyberpunk');
        this.setSlider('slider-rot', 1.2);
        this.setSlider('slider-deform-amp', 0.25);
        break;
      case 'quantum':
        this.setShape('geosphere');
        this.setMaterial('points');
        this.setTheme('violet');
        this.setSlider('slider-rot', 1.6);
        this.setSlider('slider-deform-amp', 0.6);
        this.setSlider('slider-deform-freq', 3.5);
        break;
      case 'chrome':
        this.setShape('polyhedron');
        this.setMaterial('chrome');
        this.setTheme('ice');
        this.setSlider('slider-rot', 0.8);
        this.setSlider('slider-deform-amp', 0.4);
        break;
      case 'wave':
        this.setShape('waveGrid');
        this.setMaterial('neonGlow');
        this.setTheme('emerald');
        this.setSlider('slider-rot', 0.6);
        this.setSlider('slider-deform-amp', 0.5);
        break;
      case 'gold':
        this.setShape('helix');
        this.setMaterial('chrome');
        this.setTheme('gold');
        this.setSlider('slider-rot', 1.4);
        this.setSlider('slider-deform-amp', 0.3);
        break;
    }
    this.showToast(`프리셋 적용: ${presetKey.toUpperCase()}`);
  }

  setShape(shape) {
    this.shapeType = shape;
    document.querySelectorAll('.shape-pill').forEach((p) => {
      p.classList.toggle('active', p.dataset.shape === shape);
    });
    this.buildSculpture();
  }

  setMaterial(mat) {
    this.materialType = mat;
    document.querySelectorAll('.material-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.material === mat);
    });
    this.buildSculpture();
  }

  setTheme(theme) {
    this.themeKey = theme;
    this.theme = THEMES[theme];
    document.querySelectorAll('.theme-chip').forEach((c) => {
      c.classList.toggle('active', c.dataset.theme === theme);
    });
    this.applyTheme(theme);
  }

  setSlider(id, val) {
    const el = document.getElementById(id);
    if (el) {
      el.value = val;
      el.dispatchEvent(new Event('input'));
    }
  }

  randomizeAll() {
    const shapes = ['torusKnot', 'geosphere', 'waveGrid', 'helix', 'polyhedron'];
    const mats = ['hologram', 'chrome', 'wireframe', 'neonGlow', 'points'];
    const themes = Object.keys(THEMES);

    const rShape = shapes[Math.floor(Math.random() * shapes.length)];
    const rMat = mats[Math.floor(Math.random() * mats.length)];
    const rTheme = themes[Math.floor(Math.random() * themes.length)];

    this.setShape(rShape);
    this.setMaterial(rMat);
    this.setTheme(rTheme);

    this.setSlider('slider-rot', (Math.random() * 2.5 + 0.5).toFixed(1));
    this.setSlider('slider-deform-amp', (Math.random() * 0.7 + 0.1).toFixed(2));
    this.setSlider('slider-deform-freq', (Math.random() * 4.0 + 1.0).toFixed(1));

    this.showToast('🎲 랜덤 3D 조형 생성 완료!');
  }

  downloadSnapshot() {
    this.renderer.render(this.scene, this.camera);
    const link = document.createElement('a');
    link.download = `3d-kinetic-sculpture-${this.shapeType}-${Date.now()}.png`;
    link.href = this.renderer.domElement.toDataURL('image/png');
    link.click();
    this.showToast('📸 3D 고화질 렌더 저장 완료!');
  }

  showToast(msg) {
    const toast = document.getElementById('gl-toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, 2200);
  }
}

// Instantiate safely on DOM load
window.addEventListener('DOMContentLoaded', () => {
  window.webglEngine = new WebGLLabEngine();
});
