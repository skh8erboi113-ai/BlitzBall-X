import * as THREE from 'three';

let gradientMap = null;

/** 4-step toon ramp shared by every cel-shaded material. */
export function toonGradient() {
  if (gradientMap) return gradientMap;
  const colors = new Uint8Array([70, 140, 210, 255]);
  gradientMap = new THREE.DataTexture(colors, colors.length, 1, THREE.RedFormat);
  gradientMap.minFilter = THREE.NearestFilter;
  gradientMap.magFilter = THREE.NearestFilter;
  gradientMap.needsUpdate = true;
  return gradientMap;
}

const toonCache = new Map();
export function toon(color, opts = {}) {
  const key = typeof color === 'string' ? color + JSON.stringify(opts) : null;
  if (key && toonCache.has(key)) return toonCache.get(key);
  const m = new THREE.MeshToonMaterial({ color, gradientMap: toonGradient(), ...opts });
  if (key) toonCache.set(key, m);
  return m;
}

export const outlineMaterial = new THREE.MeshBasicMaterial({ color: 0x0b0b12, side: THREE.BackSide });

/** Adds an inverted-hull outline to a mesh. */
export function withOutline(mesh, thickness = 0.035) {
  const o = new THREE.Mesh(mesh.geometry, outlineMaterial);
  const r = mesh.geometry.boundingSphere || (mesh.geometry.computeBoundingSphere(), mesh.geometry.boundingSphere);
  const rad = Math.max(0.05, r ? r.radius : 0.3);
  const s = 1 + thickness / rad;
  o.scale.setScalar(s);
  o.renderOrder = -1;
  mesh.add(o);
  mesh.userData.outline = o;
  return mesh;
}

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export function canvasTexture(canvas, opts = {}) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = opts.anisotropy || 4;
  if (opts.repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(opts.repeat[0], opts.repeat[1]);
  }
  t.needsUpdate = true;
  return t;
}

export function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function shade(hex, amt) {
  const [r, g, b] = hexToRgb(hex);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v + (amt > 0 ? (255 - v) * amt : v * amt))));
  return `#${[f(r), f(g), f(b)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/** Simple value-noise for procedural textures (deterministic). */
export function noise2(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
