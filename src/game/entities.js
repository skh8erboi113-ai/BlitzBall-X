import { Vec3 } from '../core/vec3.js';

/**
 * Runtime entities for the Blitzball simulation. Plain objects so they serialise for tests.
 */

export function createPlayer(data, team, slot) {
  return {
    id: data.id,
    data,
    team,
    slot, // 0..2 outfield, 3 keeper
    isKeeper: data.role === 'GK',
    pos: new Vec3(0, 0, 0),
    vel: new Vec3(0, 0, 0),
    y: 0, // vertical offset from the playing plane (breaches)
    vy: 0,
    facing: team === 0 ? Math.PI / 2 : -Math.PI / 2, // yaw; +x = PI/2
    state: 'idle',
    stateTime: 0,
    stateDur: 0,
    airborne: false,
    turbo: 100,
    turboActive: false,
    stun: 0,
    hasBall: false,
    controlled: false,
    combo: 0,
    comboTimer: 0,
    cd: { tackle: 0, hit: 0, trick: 0, breach: 0, catch: 0, shot: 0 },
    shot: null,
    trick: null,
    input: emptyInput(),
    ai: {},
    stats: emptyStats(),
    lastPassTime: -99,
    anim: { t: 0, phase: 0 },
    speedNorm: 0,
    knockDir: new Vec3(1, 0, 0),
  };
}

export function emptyStats() {
  return {
    goals: 0,
    shots: 0,
    sog: 0, // shots on goal
    ast: 0,
    tkl: 0, // successful tackles / picks
    hits: 0, // big hits landed
    saves: 0,
    blk: 0,
    washed: 0, // defenders left in the wash (Blitzball's ankle-breaker)
    style: 0,
    gb: 0,
    to: 0,
    volleys: 0,
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
    hit: false,
    breach: false,
    switchPlayer: false,
    gamebreaker: false,
  };
}

export function createBall() {
  return {
    pos: new Vec3(0, 0, 0),
    vel: new Vec3(0, 0, 0),
    holder: null,
    flight: null, // { kind: 'shot' | 'pass' | 'lob' | 'loose', ... }
    lastTeam: 0,
    lastTouch: null,
    spin: 0,
    releaseCooldown: null,
    wallCooldown: 0,
  };
}
