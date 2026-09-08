import * as THREE from 'three';
import { makeCanvas, canvasTexture } from './materials.js';

/**
 * Lightweight particle / decal effects: dust puffs, impact bursts, ball trail,
 * shockwave rings, confetti for gamebreakers.
 */
export class FXSystem {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
    this.max = 600;
    this.geo = new THREE.BufferGeometry();
    this.positions = new Float32Array(this.max * 3);
    this.colors = new Float32Array(this.max * 3);
    this.sizes = new Float32Array(this.max);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    this.geo.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: softDotTexture() } },
      vertexShader: `
        attribute float size; attribute vec3 color; varying vec3 vColor;
        void main(){ vColor = color; vec4 mv = modelViewMatrix * vec4(position,1.0);
          gl_PointSize = size * (300.0 / -mv.z); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `
        uniform sampler2D map; varying vec3 vColor;
        void main(){ vec4 t = texture2D(map, gl_PointCoord); if (t.a < 0.05) discard; gl_FragColor = vec4(vColor, t.a); }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });
    this.points = new THREE.Points(this.geo, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);

    this.rings = [];
    this.ringGeo = new THREE.RingGeometry(0.8, 1.0, 40);
    this.trail = null;
    this.setupTrail();
  }

  setupTrail() {
    const n = 24;
    this.trailN = n;
    this.trailPts = new Float32Array(n * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.trailPts, 3));
    const m = new THREE.LineBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.0, linewidth: 2 });
    this.trail = new THREE.Line(g, m);
    this.trail.frustumCulled = false;
    this.scene.add(this.trail);
    this.trailHistory = [];
    this.trailColor = new THREE.Color(0xffd23f);
  }

  spawn(pos, vel, color, size, life, opts = {}) {
    if (this.particles.length >= this.max) this.particles.shift();
    this.particles.push({
      x: pos.x,
      y: pos.y,
      z: pos.z,
      vx: vel.x,
      vy: vel.y,
      vz: vel.z,
      r: color.r,
      g: color.g,
      b: color.b,
      size,
      life,
      maxLife: life,
      gravity: opts.gravity ?? 0,
      drag: opts.drag ?? 0.98,
      floor: opts.floor ?? true,
    });
  }

  dust(pos, count = 8, strength = 1) {
    const c = new THREE.Color(0xb9b3a6);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = (0.6 + Math.random() * 1.4) * strength;
      this.spawn(
        { x: pos.x + Math.cos(a) * 0.15, y: pos.y + 0.05, z: pos.z + Math.sin(a) * 0.15 },
        { x: Math.cos(a) * s, y: 0.6 + Math.random() * 0.8 * strength, z: Math.sin(a) * s },
        c,
        0.25 + Math.random() * 0.3,
        0.45 + Math.random() * 0.3,
        { gravity: -1.5, drag: 0.94 },
      );
    }
  }

  burst(pos, color, count = 24, speed = 4, size = 0.22) {
    const c = new THREE.Color(color);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const b = (Math.random() - 0.3) * Math.PI;
      const s = speed * (0.4 + Math.random() * 0.8);
      this.spawn(pos, { x: Math.cos(a) * Math.cos(b) * s, y: Math.sin(b) * s + 1, z: Math.sin(a) * Math.cos(b) * s }, c, size * (0.6 + Math.random() * 0.8), 0.5 + Math.random() * 0.5, { gravity: -6, drag: 0.97 });
    }
  }

  confetti(pos, colors, count = 120) {
    for (let i = 0; i < count; i++) {
      const c = new THREE.Color(colors[i % colors.length]);
      const a = Math.random() * Math.PI * 2;
      const s = 3 + Math.random() * 6;
      this.spawn(pos, { x: Math.cos(a) * s * 0.5, y: 5 + Math.random() * 6, z: Math.sin(a) * s * 0.5 }, c, 0.16 + Math.random() * 0.14, 2 + Math.random() * 1.5, { gravity: -3.5, drag: 0.985 });
    }
  }

  sparks(pos, color, count = 14) {
    const c = new THREE.Color(color);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 2 + Math.random() * 3;
      this.spawn(pos, { x: Math.cos(a) * s, y: Math.random() * 3, z: Math.sin(a) * s }, c, 0.1 + Math.random() * 0.1, 0.3 + Math.random() * 0.3, { gravity: -8, drag: 0.96 });
    }
  }

  shockwave(pos, color = 0xffffff, maxScale = 4, life = 0.5) {
    const m = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(pos.x, 0.04, pos.z);
    m.scale.setScalar(0.2);
    this.scene.add(m);
    this.rings.push({ mesh: m, life, maxLife: life, maxScale });
  }

  updateTrail(ballPos, active, color) {
    if (active) {
      this.trailHistory.push([ballPos.x, ballPos.y, ballPos.z]);
      if (this.trailHistory.length > this.trailN) this.trailHistory.shift();
      if (color) this.trail.material.color.set(color);
      this.trail.material.opacity += (0.9 - this.trail.material.opacity) * 0.3;
    } else {
      if (this.trailHistory.length) this.trailHistory.shift();
      this.trail.material.opacity *= 0.85;
    }
    const n = this.trailHistory.length;
    for (let i = 0; i < this.trailN; i++) {
      const src = this.trailHistory[Math.min(i, n - 1)] || [0, -10, 0];
      this.trailPts[i * 3] = src[0];
      this.trailPts[i * 3 + 1] = src[1];
      this.trailPts[i * 3 + 2] = src[2];
    }
    this.trail.geometry.attributes.position.needsUpdate = true;
  }

  update(dt) {
    const ps = this.particles;
    let n = 0;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.life -= dt;
      if (p.life <= 0) {
        ps.splice(i, 1);
        continue;
      }
      p.vy += p.gravity * dt;
      p.vx *= p.drag;
      p.vz *= p.drag;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (p.floor && p.y < 0.02) {
        p.y = 0.02;
        p.vy = Math.abs(p.vy) * 0.3;
        p.vx *= 0.8;
        p.vz *= 0.8;
      }
    }
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      const u = p.life / p.maxLife;
      this.positions[n * 3] = p.x;
      this.positions[n * 3 + 1] = p.y;
      this.positions[n * 3 + 2] = p.z;
      this.colors[n * 3] = p.r;
      this.colors[n * 3 + 1] = p.g;
      this.colors[n * 3 + 2] = p.b;
      this.sizes[n] = p.size * (0.3 + u * 0.7);
      n++;
    }
    this.geo.setDrawRange(0, n);
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
    this.geo.attributes.size.needsUpdate = true;

    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life -= dt;
      const u = 1 - r.life / r.maxLife;
      r.mesh.scale.setScalar(0.2 + u * r.maxScale);
      r.mesh.material.opacity = (1 - u) * 0.9;
      if (r.life <= 0) {
        this.scene.remove(r.mesh);
        r.mesh.material.dispose();
        this.rings.splice(i, 1);
      }
    }
  }
}

let _dot = null;
function softDotTexture() {
  if (_dot) return _dot;
  const c = makeCanvas(64, 64);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 4, 32, 32, 30);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.6)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  _dot = canvasTexture(c);
  return _dot;
}
