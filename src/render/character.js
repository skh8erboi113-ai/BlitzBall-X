import * as THREE from 'three';
import { toon, withOutline, makeCanvas, canvasTexture, shade } from './materials.js';

const SKIN = ['#f1c27d', '#c68642', '#8d5524', '#5c3a21'];
const HAIR = ['#111111', '#3b2314', '#f2d16b', '#d8d8d8', '#c0392b', '#111111'];

/**
 * Procedural stylized baller: exaggerated proportions (big hands/shoes, long limbs),
 * cel-shaded with an inverted-hull outline, jersey number decal, team colors.
 * Animated procedurally from sim state (run cycle, dribble, jump, shoot, dunk, tricks, fall).
 */
export class CharacterView {
  constructor(playerData, team) {
    this.data = playerData;
    this.team = team;
    this.root = new THREE.Group();
    this.root.name = `player_${playerData.id}`;
    this.build();
    this.t = 0;
  }

  build() {
    const d = this.data;
    const skinMat = toon(SKIN[d.skin % SKIN.length]);
    const jerseyMat = toon(this.team.primary);
    const shortsMat = toon(this.team.secondary);
    const trimMat = toon(this.team.accent);
    const shoeMat = toon(shade(this.team.accent, -0.1));
    const hairMat = toon(HAIR[d.hair % HAIR.length]);

    const body = new THREE.Group();
    body.name = 'body';
    this.body = body;
    this.root.add(body);

    // Hips / pelvis
    this.hips = new THREE.Group();
    this.hips.position.y = 1.0;
    body.add(this.hips);

    // Torso
    this.torso = new THREE.Group();
    this.hips.add(this.torso);
    const torsoMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.42, 4, 10), jerseyMat);
    torsoMesh.position.y = 0.42;
    torsoMesh.scale.set(1.15, 1, 0.8);
    torsoMesh.castShadow = true;
    this.torso.add(withOutline(torsoMesh, 0.04));

    // Jersey number decals (front/back)
    const numTex = this.numberTexture();
    const decalMat = new THREE.MeshBasicMaterial({ map: numTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    const front = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), decalMat);
    front.position.set(0, 0.42, 0.215);
    this.torso.add(front);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), decalMat);
    back.position.set(0, 0.46, -0.215);
    back.rotation.y = Math.PI;
    this.torso.add(back);

    // Shoulders trim
    for (const s of [-1, 1]) {
      const pad = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), trimMat);
      pad.position.set(s * 0.29, 0.68, 0);
      this.torso.add(pad);
    }

    // Head
    this.neck = new THREE.Group();
    this.neck.position.y = 0.82;
    this.torso.add(this.neck);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 14, 12), skinMat);
    head.position.y = 0.16;
    head.scale.set(0.95, 1.08, 0.95);
    head.castShadow = true;
    this.neck.add(withOutline(head, 0.035));
    // Hair / headband
    const hairStyle = d.hair % 6;
    if (hairStyle === 0) {
      const h = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), hairMat);
      h.position.y = 0.19;
      this.neck.add(h);
    } else if (hairStyle === 1) {
      const h = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), hairMat);
      h.position.y = 0.2;
      this.neck.add(h);
    } else if (hairStyle === 2) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.035, 8, 16), trimMat);
      band.rotation.x = Math.PI / 2;
      band.position.y = 0.22;
      this.neck.add(band);
    } else if (hairStyle === 3) {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.205, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), shortsMat);
      cap.position.y = 0.18;
      this.neck.add(cap);
      const brim = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.03, 0.18), shortsMat);
      brim.position.set(0, 0.2, 0.25);
      this.neck.add(brim);
    } else if (hairStyle === 4) {
      const h = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.18, 0.3), hairMat);
      h.position.y = 0.3;
      this.neck.add(h);
    } else {
      // braids
      for (let i = 0; i < 6; i++) {
        const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.025, 0.25, 3, 6), hairMat);
        const a = (i / 6) * Math.PI * 2;
        b.position.set(Math.cos(a) * 0.14, 0.12, Math.sin(a) * 0.14 - 0.05);
        b.rotation.z = Math.cos(a) * 0.5;
        b.rotation.x = -Math.sin(a) * 0.5;
        this.neck.add(b);
      }
      const top = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.45), hairMat);
      top.position.y = 0.19;
      this.neck.add(top);
    }
    // Eyes (cartoon)
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
    for (const s of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), eyeMat);
      e.position.set(s * 0.07, 0.17, 0.165);
      e.scale.set(1, 1.3, 0.5);
      this.neck.add(e);
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.016, 6, 6), pupilMat);
      p.position.set(s * 0.07, 0.17, 0.182);
      this.neck.add(p);
    }
    // Brow (angry)
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.02, 0.03), hairMat);
    brow.position.set(0, 0.215, 0.17);
    this.neck.add(brow);

    // Arms
    this.arms = [];
    for (const s of [-1, 1]) {
      const shoulder = new THREE.Group();
      shoulder.position.set(s * 0.32, 0.66, 0);
      this.torso.add(shoulder);
      const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.3, 4, 8), skinMat);
      upper.position.y = -0.2;
      upper.castShadow = true;
      shoulder.add(withOutline(upper, 0.03));
      const elbow = new THREE.Group();
      elbow.position.y = -0.38;
      shoulder.add(elbow);
      const fore = new THREE.Mesh(new THREE.CapsuleGeometry(0.065, 0.3, 4, 8), skinMat);
      fore.position.y = -0.2;
      fore.castShadow = true;
      elbow.add(withOutline(fore, 0.03));
      // Sweatband
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.06, 10), trimMat);
      band.position.y = -0.33;
      elbow.add(band);
      // Big cartoon hand
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.095, 10, 8), skinMat);
      hand.position.y = -0.42;
      hand.scale.set(1, 1.15, 0.7);
      elbow.add(withOutline(hand, 0.03));
      hand.name = 'hand';
      this.arms.push({ shoulder, elbow, hand, side: s });
    }

    // Legs
    this.legs = [];
    for (const s of [-1, 1]) {
      const hip = new THREE.Group();
      hip.position.set(s * 0.14, 0.02, 0);
      this.hips.add(hip);
      const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.34, 4, 8), shortsMat);
      thigh.position.y = -0.22;
      thigh.castShadow = true;
      hip.add(withOutline(thigh, 0.035));
      const knee = new THREE.Group();
      knee.position.y = -0.46;
      hip.add(knee);
      const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.34, 4, 8), skinMat);
      shin.position.y = -0.2;
      shin.castShadow = true;
      knee.add(withOutline(shin, 0.03));
      // Sock
      const sock = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.14, 10), toon('#f5f5f5'));
      sock.position.y = -0.34;
      knee.add(sock);
      // Big shoe
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.13, 0.34), shoeMat);
      shoe.position.set(0, -0.46, 0.06);
      shoe.castShadow = true;
      knee.add(withOutline(shoe, 0.03));
      const sole = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.04, 0.36), toon('#f5f5f5'));
      sole.position.set(0, -0.53, 0.06);
      knee.add(sole);
      this.legs.push({ hip, knee, side: s });
    }

    // Shorts (belt) trim
    const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.31, 0.16, 12), shortsMat);
    belt.position.y = 0.0;
    belt.scale.set(1.1, 1, 0.8);
    this.hips.add(withOutline(belt, 0.03));
    const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.315, 0.05, 12), trimMat);
    stripe.position.y = 0.06;
    stripe.scale.set(1.1, 1, 0.8);
    this.hips.add(stripe);

    // Blob shadow
    const shadowTex = blobShadowTexture();
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.55 }));
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.01;
    this.shadow.renderOrder = 1;
    this.root.add(this.shadow);

    // Selection ring (user-controlled indicator)
    const ringGeo = new THREE.RingGeometry(0.5, 0.62, 32);
    this.ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }));
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.02;
    this.ring.visible = false;
    this.ring.renderOrder = 2;
    this.root.add(this.ring);

    // Turbo glow (under feet)
    this.turboGlow = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.75, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(this.team.accent), transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    this.turboGlow.rotation.x = -Math.PI / 2;
    this.turboGlow.position.y = 0.03;
    this.turboGlow.renderOrder = 2;
    this.root.add(this.turboGlow);
  }

  numberTexture() {
    const c = makeCanvas(128, 128);
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, 128, 128);
    ctx.font = '900 92px "Barlow Condensed", Impact, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 12;
    ctx.strokeStyle = this.team.secondary;
    ctx.strokeText(String(this.data.number), 64, 70);
    ctx.fillStyle = this.team.accent;
    ctx.fillText(String(this.data.number), 64, 70);
    return canvasTexture(c);
  }

  /**
   * Drive the rig from sim state. All poses are computed analytically.
   */
  update(p, sim, dt, ballHeldByMe) {
    this.t += dt;
    const root = this.root;
    root.position.set(p.pos.x, p.y, p.pos.z);
    root.rotation.y = p.facing;

    const speed = p.speedNorm; // 0..1
    const st = p.state;
    const time = p.anim.t;
    const A = this.arms;
    const L = this.legs;
    const resetJoint = (g) => g.rotation.set(0, 0, 0);
    for (const a of A) {
      resetJoint(a.shoulder);
      resetJoint(a.elbow);
    }
    for (const l of L) {
      resetJoint(l.hip);
      resetJoint(l.knee);
    }
    this.torso.rotation.set(0, 0, 0);
    this.hips.rotation.set(0, 0, 0);
    this.neck.rotation.set(0, 0, 0);
    this.body.rotation.set(0, 0, 0);
    this.body.position.set(0, 0, 0);
    let hipY = 1.0;

    const runCycle = (amp, freq) => {
      const ph = time * freq;
      const s = Math.sin(ph);
      const c = Math.cos(ph);
      L[0].hip.rotation.x = s * amp;
      L[1].hip.rotation.x = -s * amp;
      L[0].knee.rotation.x = Math.max(0, -c) * amp * 1.6 + 0.1;
      L[1].knee.rotation.x = Math.max(0, c) * amp * 1.6 + 0.1;
      A[0].shoulder.rotation.x = -s * amp * 0.9;
      A[1].shoulder.rotation.x = s * amp * 0.9;
      A[0].elbow.rotation.x = -0.8 - Math.max(0, -s) * 0.6;
      A[1].elbow.rotation.x = -0.8 - Math.max(0, s) * 0.6;
      hipY = 1.0 + Math.abs(s) * 0.05 * amp;
      this.torso.rotation.x = 0.12 * amp + speed * 0.18;
      this.hips.rotation.y = s * 0.12 * amp;
    };

    const dribblePose = () => {
      // Right hand dribbles, ball bounces (ball drawn separately). Left arm shields.
      const freq = speed > 0.2 ? 11 : 7;
      const b = Math.abs(Math.sin(time * freq));
      const right = A[1];
      right.shoulder.rotation.x = -0.35 - (1 - b) * 0.35;
      right.shoulder.rotation.z = 0.35;
      right.elbow.rotation.x = -0.4 - b * 0.4;
      const left = A[0];
      left.shoulder.rotation.x = -0.6;
      left.shoulder.rotation.z = -0.55;
      left.elbow.rotation.x = -1.4;
    };

    switch (st) {
      case 'idle':
      case 'run':
      case 'catch':
      case 'gbwind': {
        const amp = 0.25 + speed * 0.85;
        if (speed > 0.06) runCycle(amp, 7 + speed * 9);
        else {
          // idle breathing + ready stance
          const br = Math.sin(time * 2.5) * 0.02;
          hipY = 0.95 + br;
          L[0].hip.rotation.x = 0.25;
          L[1].hip.rotation.x = 0.25;
          L[0].knee.rotation.x = 0.5;
          L[1].knee.rotation.x = 0.5;
          L[0].hip.rotation.z = 0.1;
          L[1].hip.rotation.z = -0.1;
          this.torso.rotation.x = 0.2;
          A[0].shoulder.rotation.x = -0.6;
          A[1].shoulder.rotation.x = -0.6;
          A[0].elbow.rotation.x = -1.0;
          A[1].elbow.rotation.x = -1.0;
          A[0].shoulder.rotation.z = -0.25;
          A[1].shoulder.rotation.z = 0.25;
        }
        if (ballHeldByMe) dribblePose();
        if (st === 'gbwind') {
          const u = Math.min(1, p.stateTime / 0.45);
          hipY = 0.85 - u * 0.15;
          this.torso.rotation.x = 0.5;
          A[0].shoulder.rotation.x = -2.6 * u;
          A[1].shoulder.rotation.x = -2.6 * u;
          A[0].shoulder.rotation.z = -0.5;
          A[1].shoulder.rotation.z = 0.5;
        }
        break;
      }
      case 'trick': {
        const u = Math.min(1, p.stateTime / Math.max(0.01, p.stateDur));
        const type = p.trick ? p.trick.type : 0;
        const s = Math.sin(u * Math.PI * 2);
        hipY = 0.86 + Math.sin(u * Math.PI) * 0.05;
        L[0].hip.rotation.x = 0.5 + s * 0.4;
        L[1].hip.rotation.x = 0.5 - s * 0.4;
        L[0].knee.rotation.x = 0.9;
        L[1].knee.rotation.x = 0.9;
        this.torso.rotation.x = 0.45;
        switch (type) {
          case 0: // crossover
            this.hips.rotation.y = s * 0.7;
            A[0].shoulder.rotation.x = -0.8 - s * 0.6;
            A[1].shoulder.rotation.x = -0.8 + s * 0.6;
            A[0].shoulder.rotation.z = -0.5;
            A[1].shoulder.rotation.z = 0.5;
            break;
          case 1: // behind the back
            this.hips.rotation.y = -s * 0.5;
            A[1].shoulder.rotation.x = 0.8 * Math.sin(u * Math.PI);
            A[1].shoulder.rotation.z = 0.6;
            A[0].shoulder.rotation.x = -0.9;
            break;
          case 2: // spin
            this.body.rotation.y = u * Math.PI * 2;
            A[0].shoulder.rotation.z = -1.4;
            A[1].shoulder.rotation.z = 1.4;
            break;
          case 3: // between the legs
            L[0].hip.rotation.x = -0.7 * Math.sin(u * Math.PI);
            L[1].hip.rotation.x = 0.6;
            A[1].shoulder.rotation.x = -0.4 - Math.sin(u * Math.PI) * 0.5;
            A[0].shoulder.rotation.x = -0.3 - Math.sin(u * Math.PI) * 0.7;
            break;
          case 4: // hesitation
            hipY = 0.92 + (u < 0.4 ? u * 0.25 : (1 - u) * 0.15);
            this.torso.rotation.x = u < 0.4 ? 0.1 : 0.55;
            A[1].shoulder.rotation.x = -0.6;
            A[0].shoulder.rotation.x = -0.3;
            break;
          default: // off the dome
            this.neck.rotation.x = -0.4;
            hipY = 0.95;
            A[0].shoulder.rotation.x = -2.4;
            A[1].shoulder.rotation.x = -2.4;
            A[0].shoulder.rotation.z = -0.4;
            A[1].shoulder.rotation.z = 0.4;
            this.torso.rotation.x = -0.1;
        }
        break;
      }
      case 'shoot': {
        const u = Math.min(1, p.stateTime / 0.7);
        const released = p.shot && p.shot.released;
        this.torso.rotation.x = -0.05;
        L[0].hip.rotation.x = -0.2 - u * 0.2;
        L[1].hip.rotation.x = -0.4 + u * 0.2;
        L[0].knee.rotation.x = 0.7;
        L[1].knee.rotation.x = 0.45;
        // Shooting arm (right) goes up; guide hand (left)
        const lift = Math.min(1, u * 2.2);
        A[1].shoulder.rotation.x = -2.2 - lift * 0.9;
        A[1].shoulder.rotation.z = 0.15;
        A[1].elbow.rotation.x = released ? -0.1 : -1.6 + lift * 0.4;
        A[0].shoulder.rotation.x = -1.9 - lift * 0.6;
        A[0].shoulder.rotation.z = -0.6;
        A[0].elbow.rotation.x = released ? -0.6 : -1.7;
        if (released) {
          // Follow-through wrist flick
          A[1].elbow.rotation.x = -0.1;
          this.neck.rotation.x = -0.25;
        }
        break;
      }
      case 'jump': {
        const u = Math.min(1, p.stateTime / 0.9);
        A[0].shoulder.rotation.x = -2.9;
        A[1].shoulder.rotation.x = -2.9;
        A[0].shoulder.rotation.z = -0.35;
        A[1].shoulder.rotation.z = 0.35;
        A[0].elbow.rotation.x = -0.15;
        A[1].elbow.rotation.x = -0.15;
        L[0].hip.rotation.x = -0.35;
        L[1].hip.rotation.x = -0.35;
        L[0].knee.rotation.x = 0.8;
        L[1].knee.rotation.x = 0.8;
        this.torso.rotation.x = -0.15;
        break;
      }
      case 'layup': {
        const u = Math.min(1, p.stateTime / 0.6);
        A[1].shoulder.rotation.x = -2.6 - u * 0.5;
        A[1].elbow.rotation.x = -0.3;
        A[0].shoulder.rotation.x = -1.0;
        L[0].hip.rotation.x = -1.4 * Math.sin(u * Math.PI);
        L[0].knee.rotation.x = 1.6 * Math.sin(u * Math.PI);
        L[1].hip.rotation.x = 0.3;
        this.torso.rotation.x = 0.1;
        break;
      }
      case 'dunk':
      case 'oop': {
        const u = Math.min(1, p.stateTime / 0.65);
        const type = p.lastDunkType || 0;
        const slammed = p.shot && p.shot.released;
        L[0].hip.rotation.x = -0.8 * Math.sin(u * Math.PI);
        L[0].knee.rotation.x = 1.5 * Math.sin(u * Math.PI);
        L[1].hip.rotation.x = 0.4;
        L[1].knee.rotation.x = 0.7;
        this.torso.rotation.x = -0.2 + (slammed ? 0.7 : 0);
        switch (type) {
          case 1: // tomahawk: ball behind head, then slam
            A[1].shoulder.rotation.x = slammed ? -1.6 : -3.4;
            A[1].elbow.rotation.x = slammed ? -0.1 : -1.6;
            A[0].shoulder.rotation.x = -1.2;
            break;
          case 2: // windmill
            A[1].shoulder.rotation.x = slammed ? -1.7 : -Math.PI * 2 * u * 1.2;
            A[1].shoulder.rotation.z = 0.5;
            A[1].elbow.rotation.x = -0.2;
            A[0].shoulder.rotation.x = -1.4;
            break;
          case 3: // reverse
            this.hips.rotation.y = Math.PI * u;
            A[0].shoulder.rotation.x = -3.0;
            A[1].shoulder.rotation.x = -3.0;
            A[0].elbow.rotation.x = -0.3;
            A[1].elbow.rotation.x = -0.3;
            break;
          case 4: // 360
            this.body.rotation.y = Math.PI * 2 * Math.min(1, u * 1.1);
            A[1].shoulder.rotation.x = slammed ? -1.6 : -3.2;
            A[1].elbow.rotation.x = -0.4;
            A[0].shoulder.rotation.x = -1.8;
            A[0].shoulder.rotation.z = -1.0;
            break;
          default: // one hand
            A[1].shoulder.rotation.x = slammed ? -1.5 : -3.1;
            A[1].elbow.rotation.x = -0.2;
            A[0].shoulder.rotation.x = -1.0;
            A[0].shoulder.rotation.z = -0.8;
        }
        break;
      }
      case 'pass': {
        const u = Math.min(1, p.stateTime / 0.22);
        A[0].shoulder.rotation.x = -1.5 - u * 0.2;
        A[1].shoulder.rotation.x = -1.5 - u * 0.2;
        A[0].elbow.rotation.x = -1.2 + u * 1.2;
        A[1].elbow.rotation.x = -1.2 + u * 1.2;
        this.torso.rotation.x = 0.2 + u * 0.15;
        L[0].hip.rotation.x = 0.4;
        L[1].hip.rotation.x = -0.3;
        L[0].knee.rotation.x = 0.7;
        break;
      }
      case 'steal': {
        const u = Math.min(1, p.stateTime / 0.38);
        const lunge = Math.sin(u * Math.PI);
        this.torso.rotation.x = 0.5 + lunge * 0.4;
        hipY = 0.9 - lunge * 0.1;
        A[1].shoulder.rotation.x = -1.6 - lunge * 0.6;
        A[1].elbow.rotation.x = -0.1;
        A[0].shoulder.rotation.x = 0.4;
        L[0].hip.rotation.x = -0.6 * lunge;
        L[1].hip.rotation.x = 0.8 * lunge;
        L[1].knee.rotation.x = 1.0 * lunge;
        break;
      }
      case 'shove': {
        const u = Math.min(1, p.stateTime / 0.42);
        const push = Math.sin(u * Math.PI);
        A[0].shoulder.rotation.x = -1.6 * push;
        A[1].shoulder.rotation.x = -1.6 * push;
        A[0].elbow.rotation.x = -1.2 + push * 1.2;
        A[1].elbow.rotation.x = -1.2 + push * 1.2;
        this.torso.rotation.x = 0.3 * push;
        L[0].hip.rotation.x = 0.5 * push;
        L[1].hip.rotation.x = -0.4 * push;
        L[0].knee.rotation.x = 0.8 * push;
        break;
      }
      case 'stumble': {
        const u = Math.min(1, p.stateTime / 0.4);
        this.torso.rotation.x = 0.6 * Math.sin(u * Math.PI);
        this.torso.rotation.z = 0.3 * Math.sin(u * Math.PI * 2);
        A[0].shoulder.rotation.z = -1.5;
        A[1].shoulder.rotation.z = 1.5;
        L[0].knee.rotation.x = 0.6;
        L[1].knee.rotation.x = 0.4;
        break;
      }
      case 'fallen': {
        const dur = Math.max(0.01, p.stateDur);
        const u = Math.min(1, p.stateTime / dur);
        const fall = Math.min(1, u * 3.5);
        const getUp = u > 0.65 ? (u - 0.65) / 0.35 : 0;
        const lay = fall * (1 - getUp);
        // Rotate whole body back onto the floor
        this.body.rotation.x = -lay * (Math.PI / 2 - 0.15);
        this.body.position.y = -lay * 0.75;
        this.body.position.z = lay * 0.35;
        hipY = 1.0;
        A[0].shoulder.rotation.z = -1.2 * lay;
        A[1].shoulder.rotation.z = 1.2 * lay;
        A[0].shoulder.rotation.x = -0.5;
        A[1].shoulder.rotation.x = -0.5;
        L[0].hip.rotation.x = -0.2 * lay;
        L[1].hip.rotation.x = 0.35 * lay;
        L[1].knee.rotation.x = 0.8 * lay;
        L[0].knee.rotation.x = 0.3 * lay;
        this.neck.rotation.x = 0.3 * lay;
        if (getUp > 0) {
          this.torso.rotation.x = 0.5 * (1 - getUp);
          L[0].knee.rotation.x = 1.2 * (1 - getUp);
          L[0].hip.rotation.x = -1.0 * (1 - getUp);
        }
        break;
      }
      case 'celebrate': {
        const u = p.stateTime;
        const bounce = Math.abs(Math.sin(u * 7));
        hipY = 1.0 + bounce * 0.12;
        A[0].shoulder.rotation.x = -2.8 + Math.sin(u * 9) * 0.3;
        A[1].shoulder.rotation.x = -2.8 - Math.sin(u * 9) * 0.3;
        A[0].shoulder.rotation.z = -0.5;
        A[1].shoulder.rotation.z = 0.5;
        A[0].elbow.rotation.x = -0.6;
        A[1].elbow.rotation.x = -0.6;
        L[0].knee.rotation.x = 0.4 * (1 - bounce);
        L[1].knee.rotation.x = 0.4 * (1 - bounce);
        this.neck.rotation.x = -0.35;
        this.torso.rotation.x = -0.1;
        break;
      }
      default:
        break;
    }

    this.hips.position.y = hipY;
    // Lean into turns (bank)
    if ((st === 'run' || st === 'idle') && speed > 0.2) {
      this.torso.rotation.z = -Math.sin(p.facing - (p.prevFacing ?? p.facing)) * 0.5;
    }
    p.prevFacing = p.facing;

    // Shadow scale by height
    const h = p.y;
    const sc = Math.max(0.35, 1 - h * 0.18);
    this.shadow.scale.setScalar(sc);
    this.shadow.position.y = 0.012 - h; // stays on the floor
    this.shadow.material.opacity = 0.55 * sc;
    this.ring.position.y = 0.02 - h;
    this.turboGlow.position.y = 0.03 - h;

    // Control ring
    this.ring.visible = !!p.controlled && !!(sim.userTeam !== null && sim.userTeam === p.team);
    if (this.ring.visible) {
      const pulse = 0.85 + Math.sin(this.t * 6) * 0.15;
      this.ring.scale.setScalar(pulse);
      this.ring.material.opacity = 0.75;
    }
    // Turbo glow
    const tg = this.turboGlow.material;
    tg.opacity += ((p.turboActive ? 0.85 : 0) - tg.opacity) * Math.min(1, dt * 10);
    this.turboGlow.rotation.z += dt * 4;
    this.turboGlow.scale.setScalar(1 + Math.sin(this.t * 14) * 0.08);

    // Heating up: emissive jersey tint
    const hot = sim.momentum[p.team] >= 3;
    if (hot !== this._hot) {
      this._hot = hot;
    }
  }

  /** World position of the right hand (for ball attachment while holding). */
  handWorld(target) {
    this.arms[1].hand.getWorldPosition(target);
    return target;
  }

  leftHandWorld(target) {
    this.arms[0].hand.getWorldPosition(target);
    return target;
  }
}

let _blob = null;
function blobShadowTexture() {
  if (_blob) return _blob;
  const c = makeCanvas(128, 128);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 10, 64, 64, 60);
  g.addColorStop(0, 'rgba(0,0,0,0.9)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  _blob = canvasTexture(c);
  return _blob;
}
