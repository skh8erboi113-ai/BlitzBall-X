import * as THREE from 'three';
import { COURT } from '../data/constants.js';

/**
 * Broadcast-style gameplay camera: sits on the sideline side (+z, looking toward the rim),
 * frames the ball + action, dollies with the play, punches in for dunks / gamebreakers,
 * and shakes on impacts.
 */
export class GameCamera {
  constructor(camera) {
    this.cam = camera;
    this.pos = new THREE.Vector3(0, 7.5, 16);
    this.look = new THREE.Vector3(0, 1.2, -1);
    this.targetPos = this.pos.clone();
    this.targetLook = this.look.clone();
    this.shake = 0;
    this.shakeVec = new THREE.Vector3();
    this.mode = 'play';
    this.modeTimer = 0;
    this.fov = 42;
    this.targetFov = 42;
    this.zoomPunch = 0;
    this.cam.position.copy(this.pos);
    this.cam.lookAt(this.look);
    this.cam.fov = this.fov;
    this.cam.updateProjectionMatrix();
    this.focus = null;
  }

  punch(amount = 0.4) {
    this.shake = Math.min(1.2, this.shake + amount);
  }

  setMode(mode, duration = 1.5, focus = null) {
    this.mode = mode;
    this.modeTimer = duration;
    this.focus = focus;
  }

  update(sim, dt) {
    const ball = sim.ball.pos;
    const players = sim.players;

    // Center of interest: weighted toward the ball, blended with the player centroid.
    let cx = 0;
    let cz = 0;
    for (const p of players) {
      cx += p.pos.x;
      cz += p.pos.z;
    }
    cx /= players.length;
    cz /= players.length;
    const focusX = ball.x * 0.65 + cx * 0.35;
    const focusZ = ball.z * 0.6 + cz * 0.4;

    let desiredPos;
    let desiredLook;
    let desiredFov = 40;

    if (this.modeTimer > 0) this.modeTimer -= dt;
    else if (this.mode !== 'play') this.mode = 'play';

    switch (this.mode) {
      case 'dunk': {
        // Low, close, dramatic angle on the rim from the side.
        const f = this.focus;
        const side = f && f.pos.x < 0 ? -1 : 1;
        desiredPos = new THREE.Vector3(COURT.rimX + side * 5.5, 2.2, COURT.rimZ + 6.5);
        desiredLook = new THREE.Vector3(COURT.rimX, COURT.rimHeight - 0.4, COURT.rimZ + 0.5);
        desiredFov = 36;
        break;
      }
      case 'gamebreaker': {
        const f = this.focus;
        const px = f ? f.pos.x : 0;
        const pz = f ? f.pos.z : 0;
        const side = px < 0 ? -1 : 1;
        desiredPos = new THREE.Vector3(px + side * 4.5, 1.6 + (f ? f.y : 0) * 0.5, pz + 5);
        desiredLook = new THREE.Vector3(px, 1.4 + (f ? f.y : 0), pz - 0.5);
        desiredFov = 34;
        break;
      }
      case 'score': {
        // Hold on the rim briefly after a bucket.
        desiredPos = new THREE.Vector3(focusX * 0.5, 4.5, COURT.rimZ + 11);
        desiredLook = new THREE.Vector3(COURT.rimX, 2.4, COURT.rimZ);
        desiredFov = 38;
        break;
      }
      default: {
        // Broadcast: behind the offense, elevated. Slides sideways with the ball.
        const depth = THREE.MathUtils.clamp(focusZ, -6, 7);
        const lateral = THREE.MathUtils.clamp(focusX * 0.55, -4.5, 4.5);
        desiredPos = new THREE.Vector3(lateral, 6.8 + Math.max(0, depth) * 0.12, depth + 12.5);
        desiredLook = new THREE.Vector3(focusX * 0.75, 1.3 + ball.y * 0.2, focusZ - 2.5);
        // Widen when the play is spread out.
        let spread = 0;
        for (const p of players) spread = Math.max(spread, Math.abs(p.pos.x - focusX), Math.abs(p.pos.z - focusZ));
        desiredFov = 38 + THREE.MathUtils.clamp((spread - 4) * 1.4, 0, 10);
      }
    }

    const k = 1 - Math.exp(-dt * (this.mode === 'play' ? 3.2 : 5.5));
    this.pos.lerp(desiredPos, k);
    this.look.lerp(desiredLook, k * 1.3);
    this.fov += (desiredFov - this.fov) * k;

    // Shake
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 2.4);
      const s = this.shake * this.shake * 0.35;
      this.shakeVec.set((Math.random() - 0.5) * s, (Math.random() - 0.5) * s, (Math.random() - 0.5) * s * 0.5);
    } else this.shakeVec.set(0, 0, 0);

    this.cam.position.copy(this.pos).add(this.shakeVec);
    this.cam.lookAt(this.look);
    if (Math.abs(this.cam.fov - this.fov) > 0.05) {
      this.cam.fov = this.fov;
      this.cam.updateProjectionMatrix();
    }
  }
}
