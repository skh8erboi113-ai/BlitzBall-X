import { Vec3 } from '../core/vec3.js';
import { MOVE } from '../data/constants.js';

/** Runtime player entity created from roster data. */
export function createPlayer(data, team, slot) {
  return {
    id: data.id,
    data,
    team, // 0 home, 1 away
    slot, // 0..2 index within team
    pos: new Vec3(),
    vel: new Vec3(),
    facing: 0, // radians, 0 = +z
    y: 0, // height above floor (jump)
    vy: 0,
    airborne: false,
    state: 'idle',
    stateTime: 0,
    stateDur: 0,
    hasBall: false,
    turbo: MOVE.turboMax,
    turboActive: false,
    turboRegenTimer: 0,
    cd: { steal: 0, shove: 0, trick: 0, jump: 0, catch: 0 },
    shot: null, // { charge, released, timing, type }
    trick: null, // { type, dir, turbo }
    combo: 0,
    comboTimer: 0,
    stun: 0,
    guarding: null, // defensive assignment (player)
    ai: { timer: 0, decision: null, spot: null, spotTimer: 0, cutTimer: 0, mode: 'idle' },
    input: emptyInput(),
    controlled: false,
    stats: emptyStats(),
    lastDunkType: 0,
    lastTrickType: 0,
    lastPassTime: -99,
    anim: { t: 0, phase: 0 },
    // Renderer read-only helpers:
    speedNorm: 0,
  };
}

export function emptyStats() {
  return {
    pts: 0,
    fgm: 0,
    fga: 0,
    twos: 0,
    dunks: 0,
    ast: 0,
    stl: 0,
    blk: 0,
    reb: 0,
    tricks: 0,
    ankles: 0,
    style: 0,
    to: 0,
    gb: 0,
  };
}

export function emptyInput() {
  return {
    moveX: 0,
    moveZ: 0,
    turbo: false,
    shoot: false, // held
    shootPressed: false,
    shootReleased: false,
    pass: false,
    trick: false,
    shove: false,
    jump: false,
    switchPlayer: false,
    gamebreaker: false,
  };
}

export function createBall() {
  return {
    pos: new Vec3(0, 1, 0),
    vel: new Vec3(),
    holder: null,
    flight: null, // { type, shooter, target, willMake, points, t, gb, arcTarget }
    lastTeam: 0,
    spin: new Vec3(),
    rimCooldown: 0,
    grounded: false,
    onFire: false,
  };
}
