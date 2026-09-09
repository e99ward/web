/**
 * Generative Art & Interactive Particle Lab Engine
 * Project 4 - Group 3
 */

// Color Palettes
const PALETTES = {
  violet: {
    name: 'Cyber Violet',
    colors: ['#8b5cf6', '#c084fc', '#ec4899', '#f43f5e', '#a855f7'],
    bg: '#09090f'
  },
  sunset: {
    name: 'Neon Sunset',
    colors: ['#f97316', '#fb923c', '#ec4899', '#f43f5e', '#fbbf24'],
    bg: '#0c0714'
  },
  aurora: {
    name: 'Emerald Aurora',
    colors: ['#10b981', '#34d399', '#06b6d4', '#38bdf8', '#6ee7b7'],
    bg: '#041315'
  },
  gold: {
    name: 'Cosmic Gold',
    colors: ['#fbbf24', '#f59e0b', '#d97706', '#fde68a', '#ffffff'],
    bg: '#120d04'
  },
  matrix: {
    name: 'Cyber Matrix',
    colors: ['#22c55e', '#4ade80', '#86efac', '#15803d', '#bbf7d0'],
    bg: '#021206'
  },
  monochrome: {
    name: 'Mono Glow',
    colors: ['#ffffff', '#cbd5e1', '#94a3b8', '#64748b', '#e2e8f0'],
    bg: '#0b0f19'
  }
};

class ArtEngine {
  constructor() {
    this.canvas = document.getElementById('art-canvas');
    this.ctx = this.canvas.getContext('2d', { alpha: false });

    // Settings
    this.mode = 'flow'; // 'flow' | 'constellation' | 'spirograph' | 'quantum'
    this.paletteKey = 'violet';
    this.palette = PALETTES[this.paletteKey];
    this.particleCount = 600;
    this.speed = 2.0;
    this.trailDecay = 0.08; // Trail opacity (0.01 = long trails, 0.3 = fast clear)
    this.particleSize = 2.0;
    this.interactionRadius = 140;
    this.interactionMode = 'vortex'; // 'vortex' | 'attract' | 'repulse' | 'connect'
    this.isPaused = false;
    
    // Performance & State
    this.width = 0;
    this.height = 0;
    this.particles = [];
    this.spiroTime = 0;
    this.lastTime = performance.now();
    this.fps = 60;
    this.frameCount = 0;
    this.fpsTimer = performance.now();

    // Mouse & Touch
    this.mouse = {
      x: null,
      y: null,
      targetX: null,
      targetY: null,
      isDown: false,
      active: false
    };

    this.init();
  }

  init() {
    this.handleResize();
    window.addEventListener('resize', () => this.handleResize());

    this.initParticles();
    this.setupEvents();
    this.bindUI();
    this.clearBackground(true);

    requestAnimationFrame((t) => this.render(t));
  }

  handleResize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    this.ctx.scale(dpr, dpr);

    if (this.particles.length === 0) {
      this.initParticles();
    }
    this.clearBackground(true);
  }

  clearBackground(force = false) {
    this.ctx.fillStyle = this.palette.bg;
    if (force || this.trailDecay >= 0.95 || this.mode === 'spirograph') {
      this.ctx.fillRect(0, 0, this.width, this.height);
    } else {
      this.ctx.fillStyle = this.getBgWithAlpha(this.trailDecay);
      this.ctx.fillRect(0, 0, this.width, this.height);
    }
  }

  getBgWithAlpha(alpha) {
    const hex = this.palette.bg.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16) || 9;
    const g = parseInt(hex.substring(2, 4), 16) || 9;
    const b = parseInt(hex.substring(4, 6), 16) || 15;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  initParticles() {
    this.particles = [];
    const count = this.mode === 'constellation' ? Math.min(this.particleCount, 220) : this.particleCount;

    for (let i = 0; i < count; i++) {
      this.particles.push(this.createParticle());
    }
  }

  createParticle() {
    const colorList = this.palette.colors;
    const color = colorList[Math.floor(Math.random() * colorList.length)];
    return {
      x: Math.random() * this.width,
      y: Math.random() * this.height,
      vx: (Math.random() - 0.5) * 2,
      vy: (Math.random() - 0.5) * 2,
      prevX: 0,
      prevY: 0,
      color: color,
      size: Math.random() * this.particleSize + 1,
      life: Math.random() * 200 + 100,
      maxLife: 300,
      angle: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.05
    };
  }

  setupEvents() {
    const updateMouse = (e) => {
      this.mouse.targetX = e.clientX;
      this.mouse.targetY = e.clientY;
      this.mouse.active = true;
    };

    window.addEventListener('mousemove', updateMouse);
    window.addEventListener('mousedown', (e) => {
      this.mouse.isDown = true;
      updateMouse(e);
    });
    window.addEventListener('mouseup', () => {
      this.mouse.isDown = false;
    });
    window.addEventListener('mouseleave', () => {
      this.mouse.active = false;
    });

    // Touch
    window.addEventListener('touchmove', (e) => {
      if (e.touches.length > 0) {
        updateMouse(e.touches[0]);
      }
    }, { passive: true });
    window.addEventListener('touchstart', (e) => {
      if (e.touches.length > 0) {
        this.mouse.isDown = true;
        updateMouse(e.touches[0]);
      }
    }, { passive: true });
    window.addEventListener('touchend', () => {
      this.mouse.isDown = false;
      this.mouse.active = false;
    });
  }

  render(currentTime) {
    requestAnimationFrame((t) => this.render(t));

    if (this.isPaused) return;

    // Smooth Mouse coordinates interpolation
    if (this.mouse.targetX !== null) {
      if (this.mouse.x === null) {
        this.mouse.x = this.mouse.targetX;
        this.mouse.y = this.mouse.targetY;
      } else {
        this.mouse.x += (this.mouse.targetX - this.mouse.x) * 0.2;
        this.mouse.y += (this.mouse.targetY - this.mouse.y) * 0.2;
      }
    }

    // FPS Calculation
    this.frameCount++;
    if (currentTime - this.fpsTimer >= 500) {
      this.fps = Math.round((this.frameCount * 1000) / (currentTime - this.fpsTimer));
      this.frameCount = 0;
      this.fpsTimer = currentTime;
      const fpsEl = document.getElementById('hud-fps');
      if (fpsEl) fpsEl.textContent = `${this.fps} FPS`;
    }

    this.spiroTime += 0.02 * this.speed;

    // Render by Mode
    switch (this.mode) {
      case 'flow':
        this.renderFlowField(currentTime);
        break;
      case 'constellation':
        this.renderConstellation();
        break;
      case 'spirograph':
        this.renderSpirograph();
        break;
      case 'quantum':
        this.renderQuantumSwarm();
        break;
    }
  }

  /* -------------------------------------------------------------
     Mode 1: Flow Field (Organic Streamlines)
     ------------------------------------------------------------- */
  renderFlowField(time) {
    this.clearBackground();
    const t = time * 0.0004 * this.speed;
    const scale = 0.003;

    this.ctx.lineWidth = this.particleSize;

    for (let p of this.particles) {
      p.prevX = p.x;
      p.prevY = p.y;

      // Mathematical Trigonometric Vector Flow Angle
      const n1 = Math.sin(p.x * scale + t) * Math.cos(p.y * scale - t);
      const n2 = Math.cos(p.x * scale * 1.5 - t * 0.8) * Math.sin(p.y * scale * 1.5 + t * 0.8);
      let angle = (n1 + n2) * Math.PI * 2;

      // Mouse Force Field
      if (this.mouse.active && this.mouse.x !== null) {
        const dx = this.mouse.x - p.x;
        const dy = this.mouse.y - p.y;
        const dist = Math.hypot(dx, dy);

        if (dist < this.interactionRadius && dist > 1) {
          const power = (1 - dist / this.interactionRadius);
          if (this.interactionMode === 'vortex') {
            angle += Math.atan2(dy, dx) + Math.PI / 2 * (power * 4);
          } else if (this.interactionMode === 'attract') {
            angle = Math.atan2(dy, dx);
          } else if (this.interactionMode === 'repulse') {
            angle = Math.atan2(-dy, -dx);
          }
        }
      }

      p.vx = Math.cos(angle) * this.speed * 1.8;
      p.vy = Math.sin(angle) * this.speed * 1.8;

      p.x += p.vx;
      p.y += p.vy;

      // Draw glowing trail segment
      this.ctx.beginPath();
      this.ctx.strokeStyle = p.color;
      this.ctx.moveTo(p.prevX, p.prevY);
      this.ctx.lineTo(p.x, p.y);
      this.ctx.stroke();

      // Wrap edges or reset if out of bounds
      if (p.x < 0 || p.x > this.width || p.y < 0 || p.y > this.height) {
        p.x = Math.random() * this.width;
        p.y = Math.random() * this.height;
        p.prevX = p.x;
        p.prevY = p.y;
      }
    }
  }

  /* -------------------------------------------------------------
     Mode 2: Cosmic Constellation & Plexus Network
     ------------------------------------------------------------- */
  renderConstellation() {
    this.clearBackground(true); // Sharp refresh
    const count = this.particles.length;
    const maxDist = this.interactionRadius * 0.9;

    for (let i = 0; i < count; i++) {
      let p = this.particles[i];

      p.x += p.vx * this.speed * 0.6;
      p.y += p.vy * this.speed * 0.6;

      // Bounce at boundaries
      if (p.x <= 0 || p.x >= this.width) p.vx *= -1;
      if (p.y <= 0 || p.y >= this.height) p.vy *= -1;

      // Mouse Proximity Physics
      if (this.mouse.active && this.mouse.x !== null) {
        const dx = this.mouse.x - p.x;
        const dy = this.mouse.y - p.y;
        const dist = Math.hypot(dx, dy);

        if (dist < this.interactionRadius) {
          const force = (1 - dist / this.interactionRadius) * 2;
          if (this.interactionMode === 'repulse') {
            p.x -= (dx / dist) * force * 3;
            p.y -= (dy / dist) * force * 3;
          } else if (this.interactionMode === 'attract' || this.interactionMode === 'vortex') {
            p.x += (dx / dist) * force * 2;
            p.y += (dy / dist) * force * 2;
          }
        }
      }

      // Draw node point
      this.ctx.fillStyle = p.color;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size * 1.2, 0, Math.PI * 2);
      this.ctx.fill();

      // Draw connecting plexus lines
      for (let j = i + 1; j < count; j++) {
        let p2 = this.particles[j];
        const dx = p.x - p2.x;
        const dy = p.y - p2.y;
        const dist = Math.hypot(dx, dy);

        if (dist < maxDist) {
          const alpha = (1 - dist / maxDist) * 0.65;
          this.ctx.strokeStyle = `rgba(168, 85, 247, ${alpha})`;
          this.ctx.lineWidth = 1;
          this.ctx.beginPath();
          this.ctx.moveTo(p.x, p.y);
          this.ctx.lineTo(p2.x, p2.y);
          this.ctx.stroke();
        }
      }

      // Connect to mouse if nearby
      if (this.mouse.active && this.mouse.x !== null) {
        const mdx = p.x - this.mouse.x;
        const mdy = p.y - this.mouse.y;
        const mdist = Math.hypot(mdx, mdy);
        if (mdist < this.interactionRadius) {
          const alpha = (1 - mdist / this.interactionRadius) * 0.9;
          this.ctx.strokeStyle = `rgba(236, 72, 153, ${alpha})`;
          this.ctx.lineWidth = 1.5;
          this.ctx.beginPath();
          this.ctx.moveTo(p.x, p.y);
          this.ctx.lineTo(this.mouse.x, this.mouse.y);
          this.ctx.stroke();
        }
      }
    }
  }

  /* -------------------------------------------------------------
     Mode 3: Hypnotic Spirograph / Lissajous Symmetry
     ------------------------------------------------------------- */
  renderSpirograph() {
    // Gentle fading trails
    this.ctx.fillStyle = this.getBgWithAlpha(Math.max(0.02, this.trailDecay * 0.5));
    this.ctx.fillRect(0, 0, this.width, this.height);

    const cx = this.mouse.active && this.mouse.x !== null ? this.mouse.x : this.width / 2;
    const cy = this.mouse.active && this.mouse.y !== null ? this.mouse.y : this.height / 2;

    const R = Math.min(this.width, this.height) * 0.28;
    const r = R * 0.42;
    const d = R * 0.65;
    const symmetry = 6;
    const steps = 80;

    this.ctx.lineWidth = this.particleSize;

    for (let sym = 0; sym < symmetry; sym++) {
      const symAngle = (sym * Math.PI * 2) / symmetry;
      this.ctx.beginPath();
      this.ctx.strokeStyle = this.palette.colors[sym % this.palette.colors.length];

      for (let i = 0; i < steps; i++) {
        const theta = this.spiroTime + (i * 0.05);
        const k = (R - r) / r;
        const x = (R - r) * Math.cos(theta) + d * Math.cos(k * theta);
        const y = (R - r) * Math.sin(theta) - d * Math.sin(k * theta);

        // Rotate by symmetry angle
        const rx = x * Math.cos(symAngle) - y * Math.sin(symAngle);
        const ry = x * Math.sin(symAngle) + y * Math.cos(symAngle);

        if (i === 0) {
          this.ctx.moveTo(cx + rx, cy + ry);
        } else {
          this.ctx.lineTo(cx + rx, cy + ry);
        }
      }
      this.ctx.stroke();
    }
  }

  /* -------------------------------------------------------------
     Mode 4: Quantum Particle Swarm / Vortex
     ------------------------------------------------------------- */
  renderQuantumSwarm() {
    this.clearBackground();
    const targetX = this.mouse.active && this.mouse.x !== null ? this.mouse.x : this.width / 2;
    const targetY = this.mouse.active && this.mouse.y !== null ? this.mouse.y : this.height / 2;

    for (let p of this.particles) {
      p.prevX = p.x;
      p.prevY = p.y;

      const dx = targetX - p.x;
      const dy = targetY - p.y;
      const dist = Math.hypot(dx, dy) || 1;
      const angle = Math.atan2(dy, dx);

      // Orbital vortex acceleration
      const orbitalForce = 2.5 * this.speed;
      const gravity = Math.min(dist * 0.008, 4) * this.speed;

      if (this.interactionMode === 'repulse') {
        p.vx -= Math.cos(angle) * (150 / dist) * this.speed;
        p.vy -= Math.sin(angle) * (150 / dist) * this.speed;
      } else {
        // Spiral vortex around target
        p.vx += (Math.cos(angle) * gravity + Math.cos(angle + Math.PI / 2) * orbitalForce) * 0.1;
        p.vy += (Math.sin(angle) * gravity + Math.sin(angle + Math.PI / 2) * orbitalForce) * 0.1;
      }

      // Friction
      p.vx *= 0.94;
      p.vy *= 0.94;

      p.x += p.vx;
      p.y += p.vy;

      // Draw particle line trail
      this.ctx.strokeStyle = p.color;
      this.ctx.lineWidth = p.size;
      this.ctx.beginPath();
      this.ctx.moveTo(p.prevX, p.prevY);
      this.ctx.lineTo(p.x, p.y);
      this.ctx.stroke();

      // Teleport if too far or dead
      if (dist > Math.max(this.width, this.height) * 0.85) {
        p.x = targetX + (Math.random() - 0.5) * 100;
        p.y = targetY + (Math.random() - 0.5) * 100;
        p.vx = (Math.random() - 0.5) * 4;
        p.vy = (Math.random() - 0.5) * 4;
      }
    }
  }

  /* -------------------------------------------------------------
     UI Bindings & Control Sync
     ------------------------------------------------------------- */
  bindUI() {
    // Mode Pills
    const modePills = document.querySelectorAll('.mode-pill');
    modePills.forEach(pill => {
      pill.addEventListener('click', () => {
        modePills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        this.mode = pill.dataset.mode;
        this.initParticles();
        this.clearBackground(true);
        this.showToast(`Switched Mode: ${pill.textContent.trim()}`);
      });
    });

    // Sliders
    this.bindSlider('slider-count', 'val-count', (v) => {
      this.particleCount = parseInt(v);
      this.initParticles();
      const countEl = document.getElementById('hud-particles');
      if (countEl) countEl.textContent = this.particleCount;
    });

    this.bindSlider('slider-speed', 'val-speed', (v) => {
      this.speed = parseFloat(v);
    });

    this.bindSlider('slider-trail', 'val-trail', (v) => {
      // Invert so high value = long persistent trails
      this.trailDecay = 0.45 - (parseFloat(v) * 0.004);
    });

    this.bindSlider('slider-size', 'val-size', (v) => {
      this.particleSize = parseFloat(v);
      this.particles.forEach(p => p.size = Math.random() * this.particleSize + 1);
    });

    this.bindSlider('slider-radius', 'val-radius', (v) => {
      this.interactionRadius = parseInt(v);
    });

    // Palettes
    const chips = document.querySelectorAll('.palette-chip');
    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        chips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.paletteKey = chip.dataset.palette;
        this.palette = PALETTES[this.paletteKey];
        this.initParticles();
        this.clearBackground(true);
        this.showToast(`Palette: ${this.palette.name}`);
      });
    });

    // Interaction Modes
    const interBtns = document.querySelectorAll('.interaction-btn');
    interBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        interBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.interactionMode = btn.dataset.interact;
      });
    });

    // Presets
    const presetPills = document.querySelectorAll('.preset-pill');
    presetPills.forEach(pill => {
      pill.addEventListener('click', () => {
        this.applyPreset(pill.dataset.preset);
      });
    });

    // Action Toolbar Buttons
    const btnPause = document.getElementById('btn-pause');
    if (btnPause) {
      btnPause.addEventListener('click', () => {
        this.isPaused = !this.isPaused;
        btnPause.innerHTML = this.isPaused ? '▶️ 재생' : '⏸️ 일시정지';
        btnPause.classList.toggle('active', this.isPaused);
      });
    }

    const btnClear = document.getElementById('btn-clear');
    if (btnClear) {
      btnClear.addEventListener('click', () => {
        this.clearBackground(true);
        this.initParticles();
        this.showToast('Canvas Cleared');
      });
    }

    const btnRandom = document.getElementById('btn-random');
    if (btnRandom) {
      btnRandom.addEventListener('click', () => {
        this.randomizeAll();
      });
    }

    const btnSnapshot = document.getElementById('btn-snapshot');
    if (btnSnapshot) {
      btnSnapshot.addEventListener('click', () => {
        this.downloadSnapshot();
      });
    }

    // Panel Toggle
    const panel = document.getElementById('art-panel');
    const btnClosePanel = document.getElementById('btn-close-panel');
    const btnOpenPanel = document.getElementById('btn-open-panel');

    if (btnClosePanel && panel) {
      btnClosePanel.addEventListener('click', () => {
        panel.classList.add('collapsed');
      });
    }
    if (btnOpenPanel && panel) {
      btnOpenPanel.addEventListener('click', () => {
        panel.classList.remove('collapsed');
      });
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

  applyPreset(presetKey) {
    switch (presetKey) {
      case 'nebula':
        this.setMode('flow');
        this.setPalette('violet');
        this.setSliderVal('slider-count', 700);
        this.setSliderVal('slider-speed', 2.2);
        this.setSliderVal('slider-trail', 85);
        this.interactionMode = 'vortex';
        break;
      case 'matrix':
        this.setMode('flow');
        this.setPalette('matrix');
        this.setSliderVal('slider-count', 600);
        this.setSliderVal('slider-speed', 3.0);
        this.setSliderVal('slider-trail', 70);
        this.interactionMode = 'repulse';
        break;
      case 'plexus':
        this.setMode('constellation');
        this.setPalette('aurora');
        this.setSliderVal('slider-count', 180);
        this.setSliderVal('slider-speed', 1.2);
        this.setSliderVal('slider-radius', 160);
        this.interactionMode = 'attract';
        break;
      case 'spiro':
        this.setMode('spirograph');
        this.setPalette('sunset');
        this.setSliderVal('slider-speed', 1.8);
        this.setSliderVal('slider-size', 2.5);
        this.setSliderVal('slider-trail', 60);
        break;
      case 'quantum':
        this.setMode('quantum');
        this.setPalette('gold');
        this.setSliderVal('slider-count', 800);
        this.setSliderVal('slider-speed', 2.5);
        this.interactionMode = 'attract';
        break;
    }
    this.clearBackground(true);
    this.showToast(`Preset Applied: ${presetKey.toUpperCase()}`);
  }

  setMode(mode) {
    this.mode = mode;
    document.querySelectorAll('.mode-pill').forEach(p => {
      p.classList.toggle('active', p.dataset.mode === mode);
    });
    this.initParticles();
  }

  setPalette(key) {
    this.paletteKey = key;
    this.palette = PALETTES[key];
    document.querySelectorAll('.palette-chip').forEach(c => {
      c.classList.toggle('active', c.dataset.palette === key);
    });
    this.initParticles();
  }

  setSliderVal(id, val) {
    const el = document.getElementById(id);
    if (el) {
      el.value = val;
      el.dispatchEvent(new Event('input'));
    }
  }

  randomizeAll() {
    const modes = ['flow', 'constellation', 'spirograph', 'quantum'];
    const palettes = Object.keys(PALETTES);
    const randomMode = modes[Math.floor(Math.random() * modes.length)];
    const randomPalette = palettes[Math.floor(Math.random() * palettes.length)];

    this.setMode(randomMode);
    this.setPalette(randomPalette);
    this.setSliderVal('slider-count', Math.floor(Math.random() * 600 + 200));
    this.setSliderVal('slider-speed', (Math.random() * 3.5 + 0.8).toFixed(1));
    this.setSliderVal('slider-trail', Math.floor(Math.random() * 60 + 30));
    this.setSliderVal('slider-size', (Math.random() * 3 + 1).toFixed(1));

    this.clearBackground(true);
    this.showToast('🎲 Random Parameters Generated!');
  }

  downloadSnapshot() {
    const link = document.createElement('a');
    link.download = `generative-art-${this.mode}-${Date.now()}.png`;
    link.href = this.canvas.toDataURL('image/png');
    link.click();
    this.showToast('📸 High-Res Artwork Saved!');
  }

  showToast(msg) {
    const toast = document.getElementById('art-toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, 2200);
  }
}

// Instantiate on DOM load
window.addEventListener('DOMContentLoaded', () => {
  window.artEngine = new ArtEngine();
});
