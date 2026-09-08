import * as THREE from 'three';
import { COURT, FENCE } from '../data/constants.js';
import { toon, makeCanvas, canvasTexture, withOutline, noise2 } from './materials.js';

/**
 * Builds the street court: painted asphalt, chain-link fence, rim, backboard,
 * graffiti wall, floodlights, bleachers + crowd, and skyline.
 */
export function buildCourt(scene, theme) {
  const group = new THREE.Group();
  group.name = 'court';

  group.add(buildFloor(theme));
  group.add(buildFence(theme));
  group.add(buildHoop());
  group.add(buildSurroundings(theme));
  scene.add(group);
  return group;
}

const THEMES = {
  harbor: { asphalt: '#3a4650', line: '#f5f0e6', key: '#12b5b0', sky: ['#0a1d33', '#0d5f78', '#f5a86b'], wall: '#1b2a3a', accent: '#12b5b0', fog: '#0d2a3a' },
  rooftop: { asphalt: '#3c3838', line: '#f2c230', key: '#1a1a1a', sky: ['#120d2a', '#5c2a6b', '#ff7e5f'], wall: '#2a2426', accent: '#f2c230', fog: '#2a1a2a' },
  foundry: { asphalt: '#3b3330', line: '#ffd9c2', key: '#ff5a1f', sky: ['#1a0f0a', '#5a2a12', '#ff8c42'], wall: '#2b2320', accent: '#ff5a1f', fog: '#2a1a12' },
  neon: { asphalt: '#1c1530', line: '#5cf2ff', key: '#c026ff', sky: ['#05030f', '#2a0a55', '#ff2ea6'], wall: '#150d2a', accent: '#c026ff', fog: '#150a2a' },
  projects: { asphalt: '#3d3d3f', line: '#f5d76e', key: '#e8232a', sky: ['#0d1526', '#3e4f7a', '#f7b267'], wall: '#2c2c30', accent: '#e8232a', fog: '#1a2030' },
  underpass: { asphalt: '#2c2d31', line: '#c8ff3d', key: '#8a8f99', sky: ['#07080c', '#1c1f2b', '#4a5568'], wall: '#1a1b20', accent: '#c8ff3d', fog: '#101218' },
  beach: { asphalt: '#4a5a6a', line: '#ffe07a', key: '#ff8a3d', sky: ['#1b2a5a', '#ff7b54', '#ffd56b'], wall: '#2f3a4a', accent: '#ff8a3d', fog: '#3a2a3a' },
  plaza: { asphalt: '#454a55', line: '#ffd700', key: '#3b5bff', sky: ['#0c1330', '#3149a0', '#ffc38b'], wall: '#2b2f3c', accent: '#3b5bff', fog: '#1a2040' },
};

export function themeFor(team) {
  return THEMES[team?.court] || THEMES.projects;
}

function buildFloor(theme) {
  const g = new THREE.Group();
  const w = FENCE.maxX - FENCE.minX;
  const d = FENCE.maxZ - FENCE.minZ;
  const px = 96; // pixels per meter
  const canvas = makeCanvas(Math.round(w * px), Math.round(d * px));
  const ctx = canvas.getContext('2d');

  // Asphalt base with noise + cracks
  ctx.fillStyle = theme.asphalt;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = img.data;
  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const i = (y * canvas.width + x) * 4;
      const n = (noise2(x * 0.7, y * 0.7) - 0.5) * 22 + (noise2(x * 0.05, y * 0.05) - 0.5) * 30;
      data[i] += n;
      data[i + 1] += n;
      data[i + 2] += n;
    }
  }
  ctx.putImageData(img, 0, 0);

  const toPx = (wx, wz) => [(wx - FENCE.minX) * px, (wz - FENCE.minZ) * px];

  // Cracks
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 26; i++) {
    let x = noise2(i, 1) * canvas.width;
    let y = noise2(i, 2) * canvas.height;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let s = 0; s < 14; s++) {
      x += (noise2(i, s * 3) - 0.5) * 60;
      y += (noise2(i, s * 5) - 0.5) * 60;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // Painted key (worn)
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = theme.key;
  const [kx0, kz0] = toPx(-COURT.keyHalfWidth, COURT.baselineZ);
  const [kx1, kz1] = toPx(COURT.keyHalfWidth, COURT.keyTopZ);
  ctx.fillRect(kx0, kz0, kx1 - kx0, kz1 - kz0);
  ctx.globalAlpha = 1;

  // Lines
  ctx.strokeStyle = theme.line;
  ctx.lineWidth = px * 0.06;
  ctx.lineCap = 'round';
  // Sidelines & baseline & halfcourt
  const [sx0, sz0] = toPx(-COURT.halfWidth, COURT.baselineZ);
  const [sx1, sz1] = toPx(COURT.halfWidth, COURT.halfcourtZ);
  ctx.strokeRect(sx0, sz0, sx1 - sx0, sz1 - sz0);
  // Key
  ctx.strokeRect(kx0, kz0, kx1 - kx0, kz1 - kz0);
  // Free-throw circle
  const [fcx, fcz] = toPx(0, COURT.keyTopZ);
  ctx.beginPath();
  ctx.arc(fcx, fcz, 1.8 * px, 0, Math.PI * 2);
  ctx.stroke();
  // Arc
  const [rx, rz] = toPx(COURT.rimX, COURT.rimZ);
  ctx.beginPath();
  ctx.arc(rx, rz, COURT.arcRadius * px, 0.1, Math.PI - 0.1);
  ctx.stroke();
  // Straight arc extensions down to the baseline
  const cornerX = Math.sqrt(Math.max(0, COURT.arcRadius ** 2 - (Math.cos(0.1) * COURT.arcRadius) ** 2));
  // Restricted area
  ctx.beginPath();
  ctx.arc(rx, rz, 1.25 * px, 0, Math.PI);
  ctx.stroke();
  // Center logo — big "X"
  ctx.save();
  const [cx, cz] = toPx(0, 2.2);
  ctx.translate(cx, cz);
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = theme.line;
  ctx.font = `900 ${px * 3.2}px "Barlow Condensed", Impact, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('X', 0, 0);
  ctx.globalAlpha = 0.35;
  ctx.font = `700 ${px * 0.6}px "Barlow Condensed", Impact, sans-serif`;
  ctx.fillText('BLITZBALL', 0, -px * 1.9);
  ctx.restore();

  // Wear: scuff the paint
  ctx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 1600; i++) {
    const x = noise2(i, 7) * canvas.width;
    const y = noise2(i, 9) * canvas.height;
    ctx.globalAlpha = noise2(i, 11) * 0.4;
    ctx.beginPath();
    ctx.arc(x, y, 1 + noise2(i, 13) * 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  // Re-fill the transparent scuffs with darker asphalt so the wear reads as paint loss
  ctx.globalCompositeOperation = 'destination-over';
  ctx.fillStyle = '#26292e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.globalCompositeOperation = 'source-over';

  const tex = canvasTexture(canvas, { anisotropy: 8 });
  const mat = new THREE.MeshToonMaterial({ map: tex, gradientMap: toonGradientOf() });
  const geo = new THREE.PlaneGeometry(w, d);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set((FENCE.minX + FENCE.maxX) / 2, 0, (FENCE.minZ + FENCE.maxZ) / 2);
  mesh.receiveShadow = true;
  g.add(mesh);

  // Sidewalk apron around the fence
  const apron = new THREE.Mesh(new THREE.PlaneGeometry(w + 30, d + 30), toon('#5a5a5e'));
  apron.rotation.x = -Math.PI / 2;
  apron.position.set(0, -0.01, 0);
  apron.receiveShadow = true;
  g.add(apron);
  return g;
}

function toonGradientOf() {
  return toon('#ffffff').gradientMap;
}

function buildFence(theme) {
  const g = new THREE.Group();
  const h = 4.2;
  // Chain-link texture
  const c = makeCanvas(128, 128);
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 128, 128);
  ctx.strokeStyle = 'rgba(200,205,215,0.9)';
  ctx.lineWidth = 3;
  for (let i = -128; i < 256; i += 32) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 128, 128);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(i + 128, 0);
    ctx.lineTo(i, 128);
    ctx.stroke();
  }
  const tex = canvasTexture(c, { repeat: [1, 1] });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, depthWrite: false, opacity: 0.85 });

  const nearGroup = new THREE.Group();
  nearGroup.name = 'fenceNear';
  const sides = [
    { from: [FENCE.minX, FENCE.minZ], to: [FENCE.maxX, FENCE.minZ] },
    { from: [FENCE.maxX, FENCE.minZ], to: [FENCE.maxX, FENCE.maxZ] },
    { from: [FENCE.maxX, FENCE.maxZ], to: [FENCE.minX, FENCE.maxZ] },
    { from: [FENCE.minX, FENCE.maxZ], to: [FENCE.minX, FENCE.minZ] },
  ];
  const postMat = toon('#6b7280');
  const railGeo = new THREE.CylinderGeometry(0.035, 0.035, 1, 8);
  sides.forEach((s, si) => {
    // The camera-side (near) fence lives in its own group so the renderer can hide it
    // whenever the camera is outside the cage - otherwise it sits between us and the game.
    const target = si === 2 ? nearGroup : g;
    const dx = s.to[0] - s.from[0];
    const dz = s.to[1] - s.from[1];
    const len = Math.sqrt(dx * dx + dz * dz);
    const m = mat.clone();
    m.map = tex.clone();
    m.map.repeat.set(len / 0.9, h / 0.9);
    m.map.needsUpdate = true;
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(len, h), m);
    plane.position.set((s.from[0] + s.to[0]) / 2, h / 2, (s.from[1] + s.to[1]) / 2);
    plane.rotation.y = Math.atan2(dx, dz) + Math.PI / 2;
    target.add(plane);
    // posts
    const n = Math.max(2, Math.round(len / 3));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, h, 8), postMat);
      post.position.set(s.from[0] + dx * t, h / 2, s.from[1] + dz * t);
      post.castShadow = true;
      // Corner posts always stay with the main group so the cage silhouette reads.
      (i === 0 || i === n ? g : target).add(post);
    }
    // top rail
    const rail = new THREE.Mesh(railGeo, postMat);
    rail.scale.y = len;
    rail.position.set((s.from[0] + s.to[0]) / 2, h, (s.from[1] + s.to[1]) / 2);
    rail.rotation.z = Math.PI / 2;
    rail.rotation.y = -Math.atan2(dz, dx);
    target.add(rail);
  });
  g.add(nearGroup);
  return g;
}

function buildHoop() {
  const g = new THREE.Group();
  const steel = toon('#c9ced6');
  const dark = toon('#2b2f36');
  const orange = toon('#ff6a1f');

  // Pole (behind the baseline, offset)
  const poleH = COURT.rimHeight + 0.9;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, poleH, 12), dark);
  pole.position.set(COURT.rimX, poleH / 2, COURT.backboardZ - 1.2);
  pole.castShadow = true;
  g.add(withOutline(pole, 0.03));
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 1.2), dark);
  arm.position.set(COURT.rimX, COURT.rimHeight + 0.6, COURT.backboardZ - 0.6);
  g.add(arm);
  const brace = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 1.35), dark);
  brace.position.set(COURT.rimX, COURT.rimHeight + 0.15, COURT.backboardZ - 0.6);
  brace.rotation.x = -0.6;
  g.add(brace);

  // Backboard (clear acrylic with white border + square)
  const bbGeo = new THREE.BoxGeometry(COURT.backboardWidth, COURT.backboardHeight, 0.05);
  const bbMat = new THREE.MeshPhysicalMaterial({ color: 0xdfe9f5, transparent: true, opacity: 0.38, roughness: 0.15, metalness: 0, transmission: 0 });
  const bb = new THREE.Mesh(bbGeo, bbMat);
  bb.position.set(COURT.rimX, COURT.backboardBottom + COURT.backboardHeight / 2, COURT.backboardZ - 0.03);
  g.add(bb);
  const bc = makeCanvas(360, 210);
  const bctx = bc.getContext('2d');
  bctx.clearRect(0, 0, 360, 210);
  bctx.strokeStyle = '#ffffff';
  bctx.lineWidth = 10;
  bctx.strokeRect(5, 5, 350, 200);
  bctx.lineWidth = 7;
  bctx.strokeRect(120, 95, 120, 90);
  const bTex = canvasTexture(bc);
  const bLines = new THREE.Mesh(new THREE.PlaneGeometry(COURT.backboardWidth, COURT.backboardHeight), new THREE.MeshBasicMaterial({ map: bTex, transparent: true }));
  bLines.position.set(COURT.rimX, COURT.backboardBottom + COURT.backboardHeight / 2, COURT.backboardZ + 0.001);
  g.add(bLines);

  // Rim
  const rim = new THREE.Mesh(new THREE.TorusGeometry(COURT.rimRadius, 0.018, 10, 32), orange);
  rim.rotation.x = Math.PI / 2;
  rim.position.set(COURT.rimX, COURT.rimHeight, COURT.rimZ);
  g.add(rim);
  const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, COURT.rimZ - COURT.backboardZ), orange);
  bracket.position.set(COURT.rimX, COURT.rimHeight - 0.03, (COURT.rimZ + COURT.backboardZ) / 2);
  g.add(bracket);

  // Net (procedural lines)
  const netGroup = new THREE.Group();
  const netMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
  const rings = 6;
  const segs = 12;
  const pts = [];
  for (let r = 0; r <= rings; r++) {
    const t = r / rings;
    const rad = COURT.rimRadius * (1 - t * 0.5);
    const y = COURT.rimHeight - t * 0.42;
    for (let s = 0; s < segs; s++) {
      const a0 = (s / segs) * Math.PI * 2 + (r % 2) * (Math.PI / segs);
      const a1 = ((s + 1) / segs) * Math.PI * 2 + (r % 2) * (Math.PI / segs);
      pts.push(new THREE.Vector3(Math.cos(a0) * rad, y, Math.sin(a0) * rad), new THREE.Vector3(Math.cos(a1) * rad, y, Math.sin(a1) * rad));
      if (r < rings) {
        const rad2 = COURT.rimRadius * (1 - ((r + 1) / rings) * 0.5);
        const y2 = COURT.rimHeight - ((r + 1) / rings) * 0.42;
        const b0 = a0 + Math.PI / segs;
        pts.push(new THREE.Vector3(Math.cos(a0) * rad, y, Math.sin(a0) * rad), new THREE.Vector3(Math.cos(b0) * rad2, y2, Math.sin(b0) * rad2));
        pts.push(new THREE.Vector3(Math.cos(a1) * rad, y, Math.sin(a1) * rad), new THREE.Vector3(Math.cos(b0) * rad2, y2, Math.sin(b0) * rad2));
      }
    }
  }
  const netGeo = new THREE.BufferGeometry().setFromPoints(pts);
  const net = new THREE.LineSegments(netGeo, netMat);
  net.position.set(COURT.rimX, 0, COURT.rimZ);
  netGroup.add(net);
  netGroup.name = 'net';
  g.add(netGroup);
  g.userData.net = netGroup;
  return g;
}

function buildSurroundings(theme) {
  const g = new THREE.Group();

  // Graffiti wall behind the hoop
  const wallW = FENCE.maxX - FENCE.minX + 14;
  const wallH = 7.5;
  const c = makeCanvas(1024, 384);
  const ctx = c.getContext('2d');
  ctx.fillStyle = theme.wall;
  ctx.fillRect(0, 0, c.width, c.height);
  // bricks
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 2;
  for (let y = 0; y < c.height; y += 24) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(c.width, y);
    ctx.stroke();
    const off = (y / 24) % 2 ? 24 : 0;
    for (let x = off; x < c.width; x += 48) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + 24);
      ctx.stroke();
    }
  }
  // graffiti pieces
  const tags = ['BLITZBALL', 'X', 'NO LOVE', 'KINGS OF THE YARD', 'RUN IT BACK', 'GAMEBREAKER', '21'];
  const palette = [theme.accent, '#ff2ea6', '#5cf2ff', '#ffd23f', '#7bff6b', '#ff6a1f', '#ffffff'];
  for (let i = 0; i < 9; i++) {
    ctx.save();
    const x = 60 + noise2(i, 21) * (c.width - 120);
    const y = 60 + noise2(i, 22) * (c.height - 120);
    ctx.translate(x, y);
    ctx.rotate((noise2(i, 23) - 0.5) * 0.5);
    const size = 46 + noise2(i, 24) * 70;
    ctx.font = `900 ${size}px "Bangers", "Permanent Marker", Impact, sans-serif`;
    ctx.textAlign = 'center';
    ctx.lineWidth = size * 0.12;
    ctx.strokeStyle = '#0b0b12';
    ctx.lineJoin = 'round';
    const text = tags[i % tags.length];
    ctx.strokeText(text, 0, 0);
    ctx.fillStyle = palette[i % palette.length];
    ctx.fillText(text, 0, 0);
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, -size * 0.04, -size * 0.04);
    ctx.restore();
  }
  // drips / grime
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  for (let i = 0; i < 40; i++) ctx.fillRect(noise2(i, 31) * c.width, c.height - 60 - noise2(i, 32) * 40, 4, 80);
  const tex = canvasTexture(c);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(wallW, wallH), new THREE.MeshToonMaterial({ map: tex, gradientMap: toonGradientOf() }));
  wall.position.set(0, wallH / 2, FENCE.minZ - 5.5);
  wall.receiveShadow = true;
  g.add(wall);
  const wallTop = new THREE.Mesh(new THREE.BoxGeometry(wallW, 0.4, 0.8), toon('#3a3a42'));
  wallTop.position.set(0, wallH + 0.2, FENCE.minZ - 5.5);
  g.add(wallTop);

  // Bleachers along the sides with crowd
  const crowd = new THREE.Group();
  crowd.name = 'crowd';
  const rows = 4;
  const crowdColors = ['#ff2ea6', '#5cf2ff', '#ffd23f', '#f5f0e6', '#7bff6b', '#ff6a1f', theme.accent, '#c026ff', '#2c2c30', '#8a8f99'];
  const skin = ['#f1c27d', '#c68642', '#8d5524', '#5c3a21'];
  const bodyGeo = new THREE.CapsuleGeometry(0.22, 0.5, 3, 6);
  const headGeo = new THREE.SphereGeometry(0.16, 7, 6);
  const sideZs = [];
  for (let side = -1; side <= 1; side += 2) {
    for (let r = 0; r < rows; r++) {
      const x = side * (FENCE.maxX + 1.6 + r * 1.1);
      const y = 0.35 + r * 0.55;
      const step = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.5 + r * 0.55, FENCE.maxZ - FENCE.minZ), toon('#4b5563'));
      step.position.set(x, (0.5 + r * 0.55) / 2, (FENCE.minZ + FENCE.maxZ) / 2);
      step.receiveShadow = true;
      g.add(step);
      for (let z = FENCE.minZ + 0.6; z < FENCE.maxZ - 0.4; z += 0.85) {
        if (noise2(z * 3.1, r + side * 10) < 0.18) continue;
        const person = new THREE.Group();
        const bm = toon(crowdColors[Math.floor(noise2(z, r * 7 + side) * crowdColors.length)]);
        const body = new THREE.Mesh(bodyGeo, bm);
        body.position.y = 0.45;
        const head = new THREE.Mesh(headGeo, toon(skin[Math.floor(noise2(z * 2, r + side) * skin.length)]));
        head.position.y = 0.98;
        person.add(body, head);
        person.position.set(x + (noise2(z, r) - 0.5) * 0.3, y + 0.1, z);
        person.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
        person.userData.baseY = person.position.y;
        person.userData.phase = noise2(z, r * 3) * Math.PI * 2;
        crowd.add(person);
      }
    }
  }
  g.add(crowd);
  g.userData.crowd = crowd;

  // Floodlights
  const lightMat = toon('#3a3a42');
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xfff1c9 });
  const corners = [
    [FENCE.minX - 0.8, FENCE.minZ - 0.8],
    [FENCE.maxX + 0.8, FENCE.minZ - 0.8],
    [FENCE.minX - 0.8, FENCE.maxZ + 0.8],
    [FENCE.maxX + 0.8, FENCE.maxZ + 0.8],
  ];
  for (const [x, z] of corners) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 9, 8), lightMat);
    pole.position.set(x, 4.5, z);
    g.add(pole);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.35), lightMat);
    head.position.set(x, 9, z);
    head.lookAt(0, 3, 0);
    g.add(head);
    const bulb = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.3), bulbMat);
    bulb.position.copy(head.position);
    bulb.lookAt(0, 3, 0);
    bulb.translateZ(0.19);
    g.add(bulb);
  }

  // Skyline silhouettes
  const skyline = new THREE.Group();
  const bMat = toon('#0f1118');
  const winMat = new THREE.MeshBasicMaterial({ color: 0xffd98a });
  let bx = -60;
  let i = 0;
  while (bx < 60) {
    const w = 4 + noise2(i, 41) * 8;
    const h = 8 + noise2(i, 42) * 26;
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 6), bMat);
    b.position.set(bx + w / 2, h / 2, FENCE.minZ - 24 - noise2(i, 43) * 20);
    skyline.add(b);
    // windows
    for (let k = 0; k < 6; k++) {
      if (noise2(i, k * 5) < 0.4) continue;
      const win = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.7), winMat);
      win.position.set(b.position.x + (noise2(i, k) - 0.5) * (w - 1), 2 + noise2(k, i) * (h - 3), b.position.z + 3.01);
      skyline.add(win);
    }
    bx += w + 1.5 + noise2(i, 44) * 3;
    i++;
  }
  // side buildings
  for (let side = -1; side <= 1; side += 2) {
    for (let k = 0; k < 6; k++) {
      const w = 6 + noise2(k, 51 + side) * 6;
      const h = 10 + noise2(k, 52 + side) * 18;
      const b = new THREE.Mesh(new THREE.BoxGeometry(6, h, w), bMat);
      b.position.set(side * (28 + noise2(k, 53) * 12), h / 2, -20 + k * 9);
      skyline.add(b);
    }
  }
  g.add(skyline);

  // Street props: dumpster, cones, hydrant
  const dumpster = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.3, 1.2), toon('#2f6f3e'));
  dumpster.position.set(FENCE.minX - 3, 0.65, FENCE.maxZ + 3);
  dumpster.castShadow = true;
  g.add(withOutline(dumpster, 0.03));
  const hydrant = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.8, 8), toon('#e8232a'));
  hydrant.position.set(FENCE.maxX + 2.5, 0.4, FENCE.maxZ + 2.5);
  g.add(withOutline(hydrant, 0.02));
  const bench = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.12, 0.5), toon('#7a5230'));
  bench.position.set(0, 0.5, FENCE.maxZ + 1.0);
  g.add(bench);
  for (const dx of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.5), toon('#2b2f36'));
    leg.position.set(dx * 1.0, 0.25, FENCE.maxZ + 1.0);
    g.add(leg);
  }

  return g;
}
