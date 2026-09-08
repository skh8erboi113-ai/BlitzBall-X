import { Vec3, clamp, lerp } from '../core/vec3.js';
import { RNG } from '../core/rng.js';
import { EventBus } from '../core/events.js';
import { COURT, FENCE, RULES, PHYS, MOVE, ACTION, STYLE, DIFFICULTY } from '../data/constants.js';
import { createPlayer, createBall, emptyInput } from './entities.js';
import { updateAI } from './ai.js';

export const RIM = new Vec3(COURT.rimX, COURT.rimHeight, COURT.rimZ);
export const RIM_XZ = new Vec3(COURT.rimX, 0, COURT.rimZ);

export const TRICKS = ['CROSSOVER', 'BEHIND THE BACK', 'SPIN', 'BETWEEN THE LEGS', 'HESITATION', 'OFF THE DOME'];
export const DUNKS = ['ONE-HAND JAM', 'TOMAHAWK', 'WINDMILL', 'REVERSE', '360'];

const DRIBBLE_HEIGHT = 0.95;

/**
 * Headless, deterministic 3-on-3 street ball simulation.
 * No rendering / DOM dependencies — see src/render for presentation.
 */
export class MatchSim {
  constructor({ home, away, difficulty = 'pro', seed = 1337, userTeam = 0, homeLineup, awayLineup, rules = {} }) {
    this.rng = new RNG(seed);
    this.events = new EventBus();
    this.rules = { ...RULES, ...rules };
    this.difficulty = DIFFICULTY[difficulty] || DIFFICULTY.pro;
    this.difficultyKey = difficulty;
    this.teams = [home, away];
    this.userTeam = userTeam; // 0 | 1 | null (AI vs AI)
    this.players = [];
    const lineups = [homeLineup || [0, 1, 2], awayLineup || [0, 1, 2]];
    for (let t = 0; t < 2; t++) {
      const roster = this.teams[t].roster;
      lineups[t].slice(0, 3).forEach((idx, slot) => {
        const data = roster[idx] || roster[slot];
        this.players.push(createPlayer(data, t, slot));
      });
    }
    this.ball = createBall();
    this.score = [0, 0];
    this.gb = [0, 0];
    this.gbReady = [false, false];
    this.possession = 0;
    this.mustClear = false;
    this.shotClock = this.rules.shotClock;
    this.state = 'reset';
    this.stateTimer = 0;
    this.time = 0;
    this.timeScale = 1;
    this.slowmo = 0; // seconds of slow motion remaining
    this.controlled = null;
    this.gbSeq = null;
    this.lastScorer = null;
    this.deadReason = null;
    this.pendingPossession = 0;
    this.winner = null;
    this.momentum = [0, 0]; // consecutive scores for "heating up"
    this.log = [];
    this.userInput = emptyInput();
    this.possessions = 0;
    this.stats = { possessions: 0, shots: 0, dunks: 0, tricks: 0 };
    this.resetPossession(0, 'tipoff');
  }

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  teammatesOf(p) {
    return this.players.filter((q) => q.team === p.team && q !== p);
  }

  opponentsOf(p) {
    return this.players.filter((q) => q.team !== p.team);
  }

  teamPlayers(team) {
    return this.players.filter((q) => q.team === team);
  }

  distToRim(pos) {
    return pos.distanceToXZ(RIM_XZ);
  }

  isOutside(pos) {
    return this.distToRim(pos) > COURT.arcRadius;
  }

  nearestOpponent(p, filterFn) {
    let best = null;
    let bd = Infinity;
    for (const q of this.opponentsOf(p)) {
      if (filterFn && !filterFn(q)) continue;
      const d = q.pos.distanceToXZ(p.pos);
      if (d < bd) {
        bd = d;
        best = q;
      }
    }
    return { player: best, dist: bd };
  }

  nearestPlayerTo(pos, team = null, filterFn = null) {
    let best = null;
    let bd = Infinity;
    for (const q of this.players) {
      if (team !== null && q.team !== team) continue;
      if (filterFn && !filterFn(q)) continue;
      const d = q.pos.distanceToXZ(pos);
      if (d < bd) {
        bd = d;
        best = q;
      }
    }
    return { player: best, dist: bd };
  }

  carrier() {
    return this.ball.holder;
  }

  canAct(p) {
    return p.state === 'idle' || p.state === 'run' || (p.state === 'trick' && p.stateTime > p.stateDur * 0.7);
  }

  isUser(p) {
    return this.userTeam !== null && p.team === this.userTeam && p === this.controlled;
  }

  forwardOf(p) {
    return new Vec3(Math.sin(p.facing), 0, Math.cos(p.facing));
  }

  // ---------------------------------------------------------------------------
  // Flow control
  // ---------------------------------------------------------------------------

  resetPossession(team, reason = 'score') {
    this.possession = team;
    this.mustClear = false;
    this.shotClock = this.rules.shotClock;
    this.state = 'reset';
    this.stateTimer = reason === 'tipoff' ? 0.6 : this.rules.resetDuration;
    this.stats.possessions++;
    const off = this.teamPlayers(team);
    const def = this.teamPlayers(1 - team);
    // Best handler checks the ball in.
    off.sort((a, b) => b.data.hnd - a.data.hnd);
    const spots = [
      new Vec3(0, 0, COURT.checkBallZ),
      new Vec3(-4.8, 0, 1.4),
      new Vec3(4.8, 0, 1.4),
    ];
    off.forEach((p, i) => {
      this.placePlayer(p, spots[i]);
      p.facing = Math.PI; // face the rim (-z)
    });
    def.forEach((p, i) => {
      const s = spots[i];
      const toRim = Vec3.dirXZ(s, RIM_XZ);
      const d = new Vec3(s.x + toRim.x * 1.6, 0, s.z + toRim.z * 1.6);
      this.placePlayer(p, d);
      p.facing = Math.atan2(-toRim.x, -toRim.z);
      p.guarding = off[i];
    });
    off.forEach((p, i) => (p.guarding = def[i]));
    this.giveBall(off[0], false);
    this.ball.pos.set(off[0].pos.x, DRIBBLE_HEIGHT, off[0].pos.z);
    this.setControlledForPossession();
    this.events.emit('reset', { possession: team, reason });
  }

  placePlayer(p, spot) {
    p.pos.copy(spot);
    p.vel.set(0, 0, 0);
    p.y = 0;
    p.vy = 0;
    p.airborne = false;
    p.state = 'idle';
    p.stateTime = 0;
    p.stateDur = 0;
    p.stun = 0;
    p.trick = null;
    p.shot = null;
    p.ai.cutting = false;
    p.ai.spot = null;
    p.ai.timer = 0;
  }

  setControlledForPossession() {
    if (this.userTeam === null) {
      this.controlled = null;
      return;
    }
    const mine = this.teamPlayers(this.userTeam);
    mine.forEach((p) => (p.controlled = false));
    let pick;
    if (this.ball.holder && this.ball.holder.team === this.userTeam) pick = this.ball.holder;
    else if (this.ball.holder) pick = this.nearestPlayerTo(this.ball.holder.pos, this.userTeam).player;
    else pick = this.nearestPlayerTo(this.ball.pos, this.userTeam).player;
    this.controlled = pick;
    pick.controlled = true;
  }

  switchControlled() {
    if (this.userTeam === null) return;
    if (this.ball.holder && this.ball.holder.team === this.userTeam) return; // offense: always the handler
    const mine = this.teamPlayers(this.userTeam).filter((p) => p !== this.controlled);
    const ref = this.ball.holder ? this.ball.holder.pos : this.ball.pos;
    mine.sort((a, b) => a.pos.distanceToXZ(ref) - b.pos.distanceToXZ(ref));
    if (mine.length) {
      this.controlled.controlled = false;
      this.controlled = mine[0];
      this.controlled.controlled = true;
      this.events.emit('switch', { player: this.controlled });
    }
  }

  setUserInput(input) {
    this.userInput = input;
  }

  // ---------------------------------------------------------------------------
  // Ball possession helpers
  // ---------------------------------------------------------------------------

  giveBall(p, announce = true) {
    const prevTeam = this.ball.holder ? this.ball.holder.team : this.ball.lastTeam;
    if (this.ball.holder) this.ball.holder.hasBall = false;
    this.ball.holder = p;
    this.ball.flight = null;
    this.ball.vel.set(0, 0, 0);
    p.hasBall = true;
    p.cd.catch = 0.15;
    if (p.state === 'jump' || p.state === 'oop') {
      // caught in the air — keep flying but mark as holding
    } else if (p.state !== 'trick') {
      this.setState(p, 'idle');
    }
    if (p.team !== this.possession || p.team !== prevTeam) {
      this.onPossessionChange(p.team, announce);
    }
    this.ball.lastTeam = p.team;
    if (this.userTeam !== null && p.team === this.userTeam) {
      if (this.controlled !== p) {
        if (this.controlled) this.controlled.controlled = false;
        this.controlled = p;
        p.controlled = true;
      }
    }
  }

  onPossessionChange(team, announce) {
    const changed = team !== this.possession;
    this.possession = team;
    this.shotClock = this.rules.shotClock;
    if (changed) {
      this.mustClear = this.rules.clearRequired;
      this.possessions++;
      this.stats.possessions++;
      // Re-assign guards.
      const off = this.teamPlayers(team);
      const def = this.teamPlayers(1 - team);
      off.forEach((p, i) => {
        p.guarding = def[i];
        def[i].guarding = p;
        p.ai.cutting = false;
        p.ai.spot = null;
        def[i].ai.spot = null;
      });
      if (this.userTeam !== null && team !== this.userTeam) this.setControlledForPossession();
      if (announce) this.events.emit('possession', { team });
    }
  }

  dropBall(p, impulse) {
    if (this.ball.holder !== p) return;
    p.hasBall = false;
    this.ball.holder = null;
    this.ball.flight = null;
    this.ball.pos.set(p.pos.x, DRIBBLE_HEIGHT + p.y, p.pos.z);
    this.ball.vel.copy(impulse || new Vec3(this.rng.range(-2, 2), 2.5, this.rng.range(-2, 2)));
    this.ball.releaseCooldown = { player: p, t: 0.35 };
    this.ball.lastTeam = p.team;
    if (this.userTeam !== null) this.autoSwitchToLoose();
  }

  autoSwitchToLoose() {
    if (this.userTeam === null) return;
    const { player } = this.nearestPlayerTo(this.ball.pos, this.userTeam, (q) => q.state !== 'fallen');
    if (player && player !== this.controlled) {
      if (this.controlled) this.controlled.controlled = false;
      this.controlled = player;
      player.controlled = true;
    }
  }

  // ---------------------------------------------------------------------------
  // Style / Gamebreaker
  // ---------------------------------------------------------------------------

  addStyle(p, points, label, opts = {}) {
    if (this.state === 'over') return;
    const pts = Math.round(points);
    if (pts === 0) return;
    const team = p.team;
    p.stats.style += pts;
    const mult = 1 + (p.data.gb - 50) / 100; // 0.5 .. 1.49
    const gbGain = pts * mult;
    this.gb[team] = clamp(this.gb[team] + gbGain, 0, this.rules.gamebreakerMeterMax);
    if (!this.gbReady[team] && this.gb[team] >= this.rules.gamebreakerMeterMax) {
      this.gbReady[team] = true;
      this.events.emit('gbready', { team });
    }
    this.events.emit('style', { player: p, team, points: pts, label, pos: p.pos.clone(), combo: opts.combo || 0, big: !!opts.big });
  }

  loseStyle(team, amount) {
    if (this.gbReady[team]) return; // a full meter is safe
    this.gb[team] = clamp(this.gb[team] - amount, 0, this.rules.gamebreakerMeterMax);
  }

  // ---------------------------------------------------------------------------
  // Main step
  // ---------------------------------------------------------------------------

  step(rawDt) {
    if (this.state === 'over') return;
    let dt = rawDt;
    if (this.slowmo > 0) {
      this.slowmo -= rawDt;
      dt = rawDt * this.timeScale;
    } else {
      this.timeScale = 1;
    }
    this.time += dt;
    for (const p of this.players) this.tickCooldowns(p, dt);
    if (this.ball.releaseCooldown) {
      this.ball.releaseCooldown.t -= dt;
      if (this.ball.releaseCooldown.t <= 0) this.ball.releaseCooldown = null;
    }
    if (this.ball.rimCooldown > 0) this.ball.rimCooldown -= dt;

    switch (this.state) {
      case 'reset':
        this.stateTimer -= dt;
        for (const p of this.players) this.integrateAnimationOnly(p, dt);
        if (this.stateTimer <= 0) {
          this.state = 'live';
          this.events.emit('live', { possession: this.possession });
        }
        break;
      case 'live':
        this.stepLive(dt);
        break;
      case 'dead':
        this.stateTimer -= dt;
        for (const p of this.players) this.updatePlayerPhysics(p, dt, true);
        this.updateBall(dt, true);
        if (this.stateTimer <= 0) {
          if (this.checkGameOver()) return;
          this.resetPossession(this.pendingPossession, this.deadReason);
        }
        break;
      case 'gamebreaker':
        this.stepGamebreaker(dt);
        break;
      default:
        break;
    }
  }

  tickCooldowns(p, dt) {
    for (const k in p.cd) if (p.cd[k] > 0) p.cd[k] -= dt;
    if (p.comboTimer > 0) {
      p.comboTimer -= dt;
      if (p.comboTimer <= 0) p.combo = 0;
    }
    p.anim.t += dt;
  }

  integrateAnimationOnly(p, dt) {
    p.stateTime += dt;
    p.anim.t += dt;
  }

  stepLive(dt) {
    // 1. Inputs
    for (const p of this.players) {
      if (this.userTeam !== null && p === this.controlled) {
        p.input = this.userInput;
      } else {
        updateAI(this, p, dt);
      }
    }
    // 2. Actions from input
    for (const p of this.players) this.processInput(p, dt);
    // 3. Physics
    for (const p of this.players) this.updatePlayerPhysics(p, dt, false);
    this.separatePlayers();
    this.updateBall(dt, false);
    // 4. Rules
    this.updateRules(dt);
    // Consume one-shot user input flags.
    const u = this.userInput;
    u.shootPressed = false;
    u.shootReleased = false;
    u.pass = false;
    u.trick = false;
    u.shove = false;
    u.switchPlayer = false;
    u.gamebreaker = false;
    u.jump = false;
  }

  // ---------------------------------------------------------------------------
  // Input → actions
  // ---------------------------------------------------------------------------

  processInput(p, dt) {
    const inp = p.input;
    if (inp.switchPlayer && this.isUser(p)) this.switchControlled();

    if (p.state === 'fallen' || p.state === 'stumble' || p.stun > 0) return;

    const isCarrier = this.ball.holder === p;
    if (isCarrier) {
      if (inp.gamebreaker && this.gbReady[p.team] && !this.mustClear) {
        if (this.tryGamebreaker(p)) return;
      }
      if (inp.shootPressed && this.canAct(p)) this.tryShoot(p);
      if (inp.shootReleased && p.state === 'shoot' && p.shot && !p.shot.released) this.releaseShot(p);
      if (inp.pass && this.canAct(p)) this.tryPass(p, null, inp.turbo);
      if (inp.trick && this.canAct(p) && p.cd.trick <= 0) {
        const dir = new Vec3(inp.moveX, 0, inp.moveZ);
        this.tryTrick(p, dir.length() > 0.2 ? dir.normalize() : null, inp.turbo);
      }
      if (inp.shove && this.canAct(p) && p.cd.shove <= 0) this.tryShove(p);
    } else {
      // Defense / off-ball
      if ((inp.shootPressed || inp.jump) && this.canAct(p) && p.cd.jump <= 0) this.tryJump(p);
      if (inp.trick && this.canAct(p) && p.cd.steal <= 0) this.trySteal(p);
      if (inp.shove && this.canAct(p) && p.cd.shove <= 0) this.tryShove(p);
      if (inp.pass && this.canAct(p) && p.team === this.possession && this.ball.holder && this.ball.holder.team === p.team) {
        // Off-ball "call for it": start a cut so the AI handler can hit you.
        p.ai.cutting = true;
        p.ai.cutTimer = 1.4;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Player physics & states
  // ---------------------------------------------------------------------------

  setState(p, state, dur = 0) {
    p.state = state;
    p.stateTime = 0;
    p.stateDur = dur;
  }

  speedOf(p) {
    let spd = MOVE.baseSpeed + (p.data.spd - 50) * MOVE.speedPerStat;
    if (p.hasBall) spd *= MOVE.ballCarrierSlow;
    return spd;
  }

  updatePlayerPhysics(p, dt, dead) {
    p.stateTime += dt;
    if (p.stun > 0) p.stun -= dt;

    const inp = p.input;
    const move = new Vec3(inp.moveX || 0, 0, inp.moveZ || 0);
    if (move.length() > 1) move.normalize();
    let wantTurbo = !!inp.turbo && move.length() > 0.1 && p.turbo > 0.5;

    // State machine transitions
    switch (p.state) {
      case 'fallen':
      case 'stumble':
      case 'celebrate':
      case 'pass':
      case 'steal':
      case 'shove':
      case 'catch':
        move.set(0, 0, 0);
        wantTurbo = false;
        if (p.state === 'steal' && p.stateTime < 0.18) {
          // lunge
          const f = this.forwardOf(p);
          move.copy(f).scale(1.2);
        }
        if (p.stateTime >= p.stateDur) this.setState(p, 'idle');
        break;
      case 'trick': {
        if (p.trick) {
          const u = p.stateTime / p.stateDur;
          if (u < 0.65) {
            move.copy(p.trick.dir).scale(p.trick.turbo ? 1.25 : 1.0);
          } else {
            move.scale(0.6);
          }
        }
        if (p.stateTime >= p.stateDur) {
          this.setState(p, 'idle');
          p.trick = null;
        }
        break;
      }
      case 'shoot':
      case 'layup':
      case 'dunk':
      case 'oop':
      case 'jump': {
        // Airborne actions: horizontal velocity was locked at takeoff.
        move.set(0, 0, 0);
        wantTurbo = false;
        if (p.state === 'shoot' && p.shot && !p.shot.released) {
          // Auto release at landing / for AI at scheduled time
          if (p.shot.autoRelease !== null && p.stateTime >= p.shot.autoRelease) this.releaseShot(p);
          else if (!p.airborne && p.stateTime > 0.1) this.releaseShot(p);
        }
        if ((p.state === 'dunk' || p.state === 'oop') && p.shot && !p.shot.released && p.stateTime >= p.shot.slamTime) {
          this.finishDunk(p);
        }
        if (p.state === 'layup' && p.shot && !p.shot.released && p.stateTime >= p.shot.slamTime) {
          this.finishLayup(p);
        }
        if (!p.airborne && p.stateTime > 0.05 && p.stateTime >= (p.stateDur || 0)) {
          if (p.shot && !p.shot.released) {
            // Edge case: never released (should not happen) → drop the ball.
            if (this.ball.holder === p) this.dropBall(p);
            p.shot = null;
          }
          this.setState(p, 'idle');
        }
        break;
      }
      default:
        break;
    }

    if (dead) {
      move.set(0, 0, 0);
      wantTurbo = false;
    }

    // Turbo meter
    if (wantTurbo && this.canMove(p)) {
      p.turbo = Math.max(0, p.turbo - MOVE.turboDrain * dt);
      p.turboActive = p.turbo > 0;
      p.turboRegenTimer = MOVE.turboRegenDelay;
    } else {
      p.turboActive = false;
      if (p.turboRegenTimer > 0) p.turboRegenTimer -= dt;
      else p.turbo = Math.min(MOVE.turboMax, p.turbo + MOVE.turboRegen * dt);
    }

    // Horizontal motion
    if (!p.airborne && this.canMove(p)) {
      let speed = this.speedOf(p);
      if (p.turboActive) speed *= MOVE.turboMult;
      const target = move.clone().scale(speed);
      const k = 1 - Math.exp(-MOVE.accel * dt / Math.max(1, speed * 0.6));
      p.vel.lerp(target, clamp(k * 3.2, 0, 1));
    } else if (!p.airborne) {
      p.vel.lerp(new Vec3(), clamp(dt * 12, 0, 1));
    }

    p.pos.addScaled(p.vel, dt);

    // Vertical (jumps)
    if (p.airborne) {
      p.y += p.vy * dt;
      p.vy -= PHYS.gravity * dt;
      if (p.y <= 0) {
        p.y = 0;
        p.vy = 0;
        p.airborne = false;
        p.vel.scale(0.3);
        if (p.state === 'jump') this.setState(p, 'idle');
        if (p.state === 'shoot' || p.state === 'layup' || p.state === 'dunk' || p.state === 'oop') {
          if (p.shot && p.shot.released) {
            p.stateDur = p.stateTime + 0.18; // brief landing recovery
          }
        }
      }
    }

    // Fence
    const r = PHYS.playerRadius;
    if (p.pos.x < FENCE.minX + r) {
      p.pos.x = FENCE.minX + r;
      p.vel.x = Math.abs(p.vel.x) * 0.2;
    }
    if (p.pos.x > FENCE.maxX - r) {
      p.pos.x = FENCE.maxX - r;
      p.vel.x = -Math.abs(p.vel.x) * 0.2;
    }
    if (p.pos.z < FENCE.minZ + r) {
      p.pos.z = FENCE.minZ + r;
      p.vel.z = Math.abs(p.vel.z) * 0.2;
    }
    if (p.pos.z > FENCE.maxZ - r) {
      p.pos.z = FENCE.maxZ - r;
      p.vel.z = -Math.abs(p.vel.z) * 0.2;
    }

    // Facing
    const sp = p.vel.lengthXZ();
    p.speedNorm = clamp(sp / (this.speedOf(p) * MOVE.turboMult), 0, 1);
    let faceDir = null;
    if (p.state === 'shoot' || p.state === 'layup' || p.state === 'dunk' || p.state === 'oop') {
      faceDir = Vec3.dirXZ(p.pos, RIM_XZ);
    } else if (p.state === 'trick' && p.trick) {
      faceDir = p.hasBall ? Vec3.dirXZ(p.pos, RIM_XZ) : p.trick.dir;
    } else if (sp > 0.6) {
      faceDir = p.vel.clone().normalize();
    } else if (p.hasBall) {
      faceDir = Vec3.dirXZ(p.pos, RIM_XZ);
    } else if (this.ball.holder && this.ball.holder.team !== p.team) {
      faceDir = Vec3.dirXZ(p.pos, this.ball.holder.pos);
    } else if (!this.ball.holder) {
      faceDir = Vec3.dirXZ(p.pos, this.ball.pos);
    }
    if (faceDir && faceDir.lengthXZ() > 0.01) {
      const target = Math.atan2(faceDir.x, faceDir.z);
      let diff = target - p.facing;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      p.facing += diff * clamp(dt * 14, 0, 1);
    }
    if (!p.state) p.state = 'idle';
    if (p.state === 'idle' && sp > 0.8) p.state = 'run';
    if (p.state === 'run' && sp <= 0.8) p.state = 'idle';
  }

  canMove(p) {
    return (
      p.state === 'idle' || p.state === 'run' || p.state === 'trick' || p.state === 'steal'
    ) && p.stun <= 0;
  }

  separatePlayers() {
    const n = this.players.length;
    const minD = PHYS.playerRadius * 2 * 0.9;
    for (let i = 0; i < n; i++) {
      const a = this.players[i];
      for (let j = i + 1; j < n; j++) {
        const b = this.players[j];
        if (a.state === 'fallen' || b.state === 'fallen') continue;
        if (a.airborne !== b.airborne && (a.y > 1.0 || b.y > 1.0)) continue;
        const dx = b.pos.x - a.pos.x;
        const dz = b.pos.z - a.pos.z;
        let d = Math.sqrt(dx * dx + dz * dz);
        if (d < minD) {
          if (d < 1e-4) {
            d = 1e-4;
          }
          const push = (minD - d) * 0.5;
          const nx = dx / d;
          const nz = dz / d;
          // Heavier players push more.
          const wa = a.data.pow / (a.data.pow + b.data.pow);
          const wb = 1 - wa;
          a.pos.x -= nx * push * 2 * wb;
          a.pos.z -= nz * push * 2 * wb;
          b.pos.x += nx * push * 2 * wa;
          b.pos.z += nz * push * 2 * wa;
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Actions: shooting
  // ---------------------------------------------------------------------------

  handPos(p) {
    const f = this.forwardOf(p);
    return new Vec3(p.pos.x + f.x * 0.3, 2.05 + p.y, p.pos.z + f.z * 0.3);
  }

  tryShoot(p, aiTiming = null) {
    if (this.ball.holder !== p) return false;
    if (this.mustClear) {
      if (this.isUser(p)) {
        this.events.emit('violation', { team: p.team, reason: 'NO CLEAR' });
        this.turnover(p.team, 'NO CLEAR');
      }
      return false;
    }
    const d = this.distToRim(p.pos);
    const toRim = Vec3.dirXZ(p.pos, RIM_XZ);
    const movingIn = p.vel.dot(toRim) > 1.2;
    const points = this.isOutside(p.pos) ? this.rules.outsidePoints : this.rules.insidePoints;
    p.stats.fga++;
    this.stats.shots++;

    if (d < ACTION.slamRange && (movingIn || p.turboActive || p.data.dnk >= 70 || d < 1.4)) {
      const wantDunk = p.data.dnk >= 55 || p.turboActive;
      if (wantDunk) return this.startDunk(p, points, toRim, d);
      return this.startLayup(p, points, toRim, d);
    }
    if (d < ACTION.layupRange + 0.6 && !movingIn && p.data.dnk < 55) {
      return this.startLayup(p, points, toRim, d);
    }
    // Jump shot
    const vy = 3.3;
    p.airborne = true;
    p.vy = vy;
    p.y = 0.001;
    p.vel.scale(0.25); // fadeaway drift kept small
    const apex = vy / PHYS.gravity;
    p.shot = { type: 'jumper', released: false, points, apex, autoRelease: null, fade: movingIn ? 0 : p.vel.lengthXZ() };
    if (aiTiming !== null) p.shot.autoRelease = apex + aiTiming;
    else if (!this.isUser(p)) p.shot.autoRelease = apex + this.rng.range(-0.05, 0.09) * (1.2 - this.difficulty.shotAccuracy);
    this.setState(p, 'shoot', 0.9);
    p.cd.jump = 0.5;
    this.events.emit('shotstart', { player: p, type: 'jumper' });
    return true;
  }

  startDunk(p, points, toRim, d) {
    const dunkType = p.data.dnk >= 88 ? this.rng.int(0, DUNKS.length - 1) : this.rng.int(0, 1);
    const flight = 0.62;
    // Horizontal velocity to reach a spot just in front of the rim.
    const landing = new Vec3(RIM_XZ.x - toRim.x * 0.35, 0, RIM_XZ.z - toRim.z * 0.35);
    const dx = landing.x - p.pos.x;
    const dz = landing.z - p.pos.z;
    p.vel.set(dx / flight, 0, dz / flight);
    p.airborne = true;
    p.vy = PHYS.gravity * flight * 0.5 + 0.9;
    p.y = 0.001;
    p.shot = { type: 'dunk', released: false, points, slamTime: flight * 0.55, dunkType };
    p.lastDunkType = dunkType;
    this.setState(p, 'dunk', 1.3);
    p.cd.jump = 0.6;
    this.events.emit('shotstart', { player: p, type: 'dunk', dunkType });
    return true;
  }

  startLayup(p, points, toRim, d) {
    const flight = 0.55;
    const landing = new Vec3(RIM_XZ.x - toRim.x * 0.9, 0, RIM_XZ.z - toRim.z * 0.9);
    const dx = landing.x - p.pos.x;
    const dz = landing.z - p.pos.z;
    p.vel.set(dx / flight, 0, dz / flight);
    p.airborne = true;
    p.vy = PHYS.gravity * flight * 0.5 + 0.4;
    p.y = 0.001;
    p.shot = { type: 'layup', released: false, points, slamTime: flight * 0.5 };
    this.setState(p, 'layup', 1.2);
    p.cd.jump = 0.6;
    this.events.emit('shotstart', { player: p, type: 'layup' });
    return true;
  }

  contestFactor(p) {
    // How contested is the shooter? Returns [0..1] penalty and whether a jumper is in range.
    let penalty = 0;
    let blocker = null;
    for (const q of this.opponentsOf(p)) {
      if (q.state === 'fallen') continue;
      const d = q.pos.distanceToXZ(p.pos);
      if (d < ACTION.blockRange) {
        const front = Vec3.dirXZ(p.pos, RIM_XZ).dot(Vec3.dirXZ(p.pos, q.pos)) > 0.2;
        if (!front) continue;
        const closeness = 1 - d / ACTION.blockRange;
        let c = 0.18 * closeness;
        if (q.airborne) c += 0.3 * closeness * (0.6 + q.data.blk / 250);
        penalty += c;
        if (q.airborne && !blocker) blocker = q;
      }
    }
    return { penalty: clamp(penalty, 0, 0.7), blocker };
  }

  releaseShot(p) {
    const shot = p.shot;
    if (!shot || shot.released) return;
    shot.released = true;
    if (this.ball.holder !== p) return;

    const timingErr = Math.abs(p.stateTime - shot.apex);
    let timingMult;
    let timingLabel;
    if (timingErr < 0.055) {
      timingMult = 1.28;
      timingLabel = 'PERFECT';
    } else if (timingErr < 0.13) {
      timingMult = 1.0;
      timingLabel = 'GOOD';
    } else if (timingErr < 0.22) {
      timingMult = 0.7;
      timingLabel = p.stateTime < shot.apex ? 'EARLY' : 'LATE';
    } else {
      timingMult = 0.4;
      timingLabel = p.stateTime < shot.apex ? 'WAY EARLY' : 'WAY LATE';
    }
    const d = this.distToRim(p.pos);
    let base;
    if (d < 3) base = 0.72;
    else if (d < COURT.arcRadius) base = lerp(0.62, 0.5, (d - 3) / (COURT.arcRadius - 3));
    else if (d < 9.5) base = lerp(0.44, 0.3, (d - COURT.arcRadius) / (9.5 - COURT.arcRadius));
    else base = 0.16;
    const statMult = 0.6 + (p.data.shot / 99) * 0.6;
    const { penalty, blocker } = this.contestFactor(p);
    let prob = base * statMult * timingMult * (1 - penalty);
    if (shot.fade > 2.5) prob *= 0.85;
    if (this.momentum[p.team] >= 3) prob *= 1.12; // heating up
    if (!this.isUser(p)) prob *= this.difficulty.shotAccuracy;
    prob = clamp(prob, 0.03, 0.96);
    const willMake = this.rng.chance(prob);
    p.stats.style += 0;
    this.launchShot(p, willMake, shot.points, 'jumper', { timingLabel, prob, blocker, contested: penalty > 0.2 });
    if (shot.fade > 2.5 && willMake) this.addStyle(p, STYLE.fadeawayPoints, 'FADEAWAY');
    if (timingLabel === 'PERFECT' && this.isUser(p)) this.events.emit('timing', { player: p, label: timingLabel, good: true });
    else if (this.isUser(p)) this.events.emit('timing', { player: p, label: timingLabel, good: timingLabel === 'GOOD' });
  }

  launchShot(p, willMake, points, kind, meta = {}) {
    const from = this.handPos(p);
    const shooterDir = Vec3.dirXZ(RIM_XZ, p.pos); // from rim toward shooter
    let to;
    if (willMake) {
      to = new Vec3(RIM.x, RIM.y + 0.05, RIM.z);
    } else {
      to = this.pickMissPoint(shooterDir, meta.timingLabel);
    }
    const dist = from.distanceTo(to);
    const dur = clamp(0.5 + dist * 0.065, 0.55, 1.25);
    const arc = Math.max(0.9, dist * 0.24);
    p.hasBall = false;
    this.ball.holder = null;
    this.ball.pos.copy(from);
    this.ball.flight = {
      kind: 'shot',
      from,
      to,
      t: 0,
      dur,
      arc,
      shooter: p,
      willMake,
      points,
      shotType: kind,
      blockable: true,
      gb: !!meta.gb,
      missKind: to.missKind || null,
      checked: new Set(),
    };
    this.ball.releaseCooldown = { player: p, t: 0.6 };
    this.ball.lastTeam = p.team;
    this.events.emit('shot', { player: p, type: kind, points, from: from.clone(), prob: meta.prob });
  }

  pickMissPoint(shooterDir, timingLabel) {
    const r = this.rng.next();
    const rimR = COURT.rimRadius;
    let to;
    if (timingLabel === 'WAY EARLY' || timingLabel === 'WAY LATE') {
      if (r < 0.5) {
        // Short / long airball-ish that still catches iron or board
        to = new Vec3(RIM.x + shooterDir.x * (rimR + 0.45) + this.rng.range(-0.25, 0.25), RIM.y - 0.1, RIM.z + shooterDir.z * (rimR + 0.45));
        to.missKind = 'short';
        return to;
      }
    }
    if (r < 0.35) {
      to = new Vec3(RIM.x + shooterDir.x * rimR, RIM.y + 0.02, RIM.z + shooterDir.z * rimR);
      to.missKind = 'front';
    } else if (r < 0.6) {
      to = new Vec3(RIM.x - shooterDir.x * rimR, RIM.y + 0.02, RIM.z - shooterDir.z * rimR);
      to.missKind = 'back';
    } else if (r < 0.82) {
      const side = this.rng.chance(0.5) ? 1 : -1;
      to = new Vec3(RIM.x + shooterDir.z * rimR * side, RIM.y + 0.02, RIM.z - shooterDir.x * rimR * side);
      to.missKind = 'side';
    } else {
      to = new Vec3(RIM.x + this.rng.range(-0.4, 0.4), RIM.y + this.rng.range(0.25, 0.55), COURT.backboardZ + PHYS.ballRadius + 0.02);
      to.missKind = 'board';
    }
    return to;
  }

  finishDunk(p) {
    const shot = p.shot;
    shot.released = true;
    if (this.ball.holder !== p) return; // was stripped/blocked
    // Dunks are (almost) automatic unless a big body is there.
    const { penalty, blocker } = this.contestFactor(p);
    let prob = 0.97 - penalty * 0.9;
    if (blocker && blocker.data.blk > 80) prob -= 0.1;
    prob = clamp(prob, 0.35, 0.985);
    const made = this.rng.chance(prob);
    p.hasBall = false;
    this.ball.holder = null;
    this.ball.pos.set(RIM.x, RIM.y + 0.15, RIM.z);
    this.ball.lastTeam = p.team;
    this.ball.releaseCooldown = { player: p, t: 0.6 };
    if (made) {
      p.stats.dunks++;
      this.stats.dunks++;
      const label = DUNKS[shot.dunkType] || 'SLAM';
      this.addStyle(p, STYLE.slamPoints * (shot.dunkType >= 2 ? 1.35 : 1), label, { big: true });
      this.events.emit('dunk', { player: p, dunkType: shot.dunkType, label });
      this.scoreBasket(p, shot.points, shot.gb ? 'gamebreaker' : 'dunk', { gb: shot.gb });
      this.ball.flight = null;
      this.ball.vel.set(this.rng.range(-0.5, 0.5), -3.5, this.rng.range(-0.5, 0.5));
      this.ball.netting = 0.35;
    } else {
      this.events.emit('rim', { hard: true });
      this.ball.flight = null;
      const out = Vec3.dirXZ(RIM_XZ, p.pos);
      this.ball.vel.set(out.x * 3 + this.rng.range(-1.5, 1.5), 3.2, out.z * 3 + this.rng.range(-1.5, 1.5));
      this.events.emit('miss', { player: p, type: 'dunk' });
      this.loseStyle(p.team, STYLE.lossOnBlocked);
    }
  }

  finishLayup(p) {
    const shot = p.shot;
    shot.released = true;
    if (this.ball.holder !== p) return;
    const { penalty } = this.contestFactor(p);
    let prob = (0.78 + (p.data.dnk / 99) * 0.15) * (1 - penalty);
    if (!this.isUser(p)) prob *= this.difficulty.shotAccuracy;
    prob = clamp(prob, 0.2, 0.95);
    const willMake = this.rng.chance(prob);
    // Short, soft arc off the glass.
    const from = this.handPos(p);
    const to = willMake ? new Vec3(RIM.x, RIM.y + 0.05, RIM.z) : this.pickMissPoint(Vec3.dirXZ(RIM_XZ, p.pos), 'GOOD');
    p.hasBall = false;
    this.ball.holder = null;
    this.ball.pos.copy(from);
    this.ball.flight = {
      kind: 'shot',
      from,
      to,
      t: 0,
      dur: 0.42,
      arc: 0.55,
      shooter: p,
      willMake,
      points: shot.points,
      shotType: 'layup',
      blockable: true,
      gb: false,
      missKind: to.missKind || null,
      checked: new Set(),
    };
    this.ball.releaseCooldown = { player: p, t: 0.5 };
    this.ball.lastTeam = p.team;
    this.events.emit('shot', { player: p, type: 'layup', points: shot.points, from: from.clone(), prob });
  }

  // ---------------------------------------------------------------------------
  // Actions: passing
  // ---------------------------------------------------------------------------

  choosePassTarget(p, dir) {
    const mates = this.teammatesOf(p).filter((q) => q.state !== 'fallen');
    if (!mates.length) return null;
    if (dir && dir.length() > 0.3) {
      // Best aligned with the stick.
      let best = null;
      let bs = -Infinity;
      for (const q of mates) {
        const toQ = Vec3.dirXZ(p.pos, q.pos);
        const s = toQ.dot(dir);
        if (s > bs) {
          bs = s;
          best = q;
        }
      }
      if (bs > -0.2) return best;
    }
    // Most open.
    let best = null;
    let bScore = -Infinity;
    for (const q of mates) {
      const { dist } = this.nearestOpponent(q);
      const s = dist - q.pos.distanceToXZ(p.pos) * 0.15;
      if (s > bScore) {
        bScore = s;
        best = q;
      }
    }
    return best;
  }

  tryPass(p, target = null, alley = false) {
    if (this.ball.holder !== p) return false;
    const inp = p.input;
    const dir = new Vec3(inp.moveX || 0, 0, inp.moveZ || 0);
    if (!target) {
      if (alley) {
        // Nearest teammate to the rim who is not the passer.
        const mates = this.teammatesOf(p).filter((q) => q.state !== 'fallen');
        mates.sort((a, b) => this.distToRim(a.pos) - this.distToRim(b.pos));
        target = mates[0] || null;
      } else target = this.choosePassTarget(p, dir);
    }
    if (!target) return false;
    p.lastPassTime = this.time;
    const from = this.handPos(p);
    from.y = 1.4 + p.y;
    p.hasBall = false;
    this.ball.holder = null;
    this.ball.pos.copy(from);
    this.ball.lastTeam = p.team;
    this.ball.releaseCooldown = { player: p, t: 0.3 };
    this.setState(p, 'pass', 0.22);

    const canOop = alley && !this.mustClear && this.distToRim(target.pos) < 6.5 && target.data.dnk >= 45 && !target.airborne;
    if (canOop) {
      const approach = Vec3.dirXZ(RIM_XZ, target.pos);
      const to = new Vec3(RIM.x + approach.x * 0.55, RIM.y + 0.6, RIM.z + approach.z * 0.55);
      const dist = from.distanceTo(to);
      const dur = clamp(0.55 + dist * 0.07 + this.distToRim(target.pos) * 0.05, 0.75, 1.35);
      this.ball.flight = { kind: 'lob', from, to, t: 0, dur, arc: 1.4, passer: p, target, checked: new Set(), blockable: false };
      target.ai.cutting = true;
      target.ai.cutTimer = dur + 0.3;
      target.ai.oop = { t: 0, dur, to };
      this.events.emit('pass', { from: p, to: target, alley: true });
    } else {
      const lead = target.vel.clone().scale(0.25);
      const to = new Vec3(target.pos.x + lead.x, 1.35, target.pos.z + lead.z);
      const dist = from.distanceTo(to);
      const dur = clamp(dist / ACTION.passSpeed, 0.14, 0.9);
      const bounce = this.rng.chance(0.25);
      this.ball.flight = { kind: 'pass', from, to, t: 0, dur, arc: bounce ? -0.9 : 0.15, passer: p, target, checked: new Set(), blockable: false };
      this.events.emit('pass', { from: p, to: target, alley: false });
    }
    if (this.userTeam !== null && p.team === this.userTeam) {
      if (this.controlled) this.controlled.controlled = false;
      this.controlled = target;
      target.controlled = true;
    }
    return true;
  }

  // ---------------------------------------------------------------------------
  // Actions: tricks / steals / shoves / jumps
  // ---------------------------------------------------------------------------

  tryTrick(p, dir, turbo) {
    if (this.ball.holder !== p) return false;
    if (!dir) {
      // No stick input → break toward the more open side.
      const f = this.forwardOf(p);
      const side = this.rng.chance(0.5) ? 1 : -1;
      dir = new Vec3(f.z * side, 0, -f.x * side).normalize();
    }
    const useTurbo = !!turbo && p.turbo > 8;
    if (useTurbo) p.turbo = Math.max(0, p.turbo - 8);
    let type = this.rng.int(0, 4);
    if (useTurbo && this.rng.chance(0.45)) type = 5;
    p.trick = { type, dir: dir.clone(), turbo: useTurbo };
    p.lastTrickType = type;
    p.cd.trick = ACTION.trickDuration + 0.1;
    this.setState(p, 'trick', ACTION.trickDuration);
    p.stats.tricks++;
    this.stats.tricks++;

    // Combo bookkeeping
    p.combo = p.comboTimer > 0 ? Math.min(p.combo + 1, STYLE.comboMaxMult) : 1;
    p.comboTimer = STYLE.comboWindow;

    // Contest: is a defender in front?
    const { player: def, dist } = this.nearestOpponent(p, (q) => q.state !== 'fallen' && q.state !== 'stumble');
    let label = TRICKS[type];
    let points = STYLE.trickBase * (useTurbo ? STYLE.trickTurboMult : 1);
    let broke = false;
    if (def && dist < 2.0) {
      const facingDef = Vec3.dirXZ(p.pos, def.pos).dot(dir) > -0.6;
      const hnd = p.data.hnd;
      const stl = def.data.stl;
      let pBreak = 0.1 + ((hnd - stl) / 99) * 0.3 + (useTurbo ? 0.12 : 0) + (p.combo - 1) * 0.05;
      if (def.state === 'steal') pBreak += 0.3; // caught lunging
      if (!facingDef) pBreak *= 0.6;
      if (!this.isUser(p)) pBreak *= 0.55 + this.difficulty.trickRate * 0.45;
      else pBreak *= 1.6 - this.difficulty.contestQuality * 0.6;
      pBreak = clamp(pBreak, 0.05, 0.85);
      if (this.rng.chance(pBreak)) {
        broke = true;
        this.knockDown(def, p, 'ankle');
        p.stats.ankles++;
        points += STYLE.ankleBreakerBonus;
        label = 'ANKLE BREAKER';
        this.events.emit('ankle', { breaker: p, victim: def });
        if (this.isUser(p) || (this.userTeam !== null && def.team === this.userTeam)) {
          this.slowmo = 0.45;
          this.timeScale = 0.35;
        }
      } else {
        points *= 1.2; // still contested
      }
    } else {
      // Nobody around — diminishing returns.
      points *= 0.5;
      p.ai.freeTricks = (p.ai.freeTricks || 0) + 1;
      if (p.ai.freeTricks > 2) points *= 0.4;
    }
    if (def && dist < 2.0) p.ai.freeTricks = 0;
    const comboMult = 1 + (p.combo - 1) * 0.5;
    this.addStyle(p, points * comboMult, label, { combo: p.combo, big: broke });
    this.events.emit('trick', { player: p, type, turbo: useTurbo, broke, combo: p.combo });
    return true;
  }

  knockDown(victim, by, reason) {
    if (victim.state === 'fallen') return;
    if (victim.airborne) return;
    if (this.ball.holder === victim) {
      const away = Vec3.dirXZ(by.pos, victim.pos);
      this.dropBall(victim, new Vec3(away.x * 2.5 + this.rng.range(-1, 1), 2.6, away.z * 2.5 + this.rng.range(-1, 1)));
      victim.stats.to++;
      this.loseStyle(victim.team, STYLE.lossOnTurnover);
    }
    victim.shot = null;
    victim.trick = null;
    this.setState(victim, 'fallen', ACTION.knockdownDuration);
    victim.vel.set(0, 0, 0);
    victim.fallDir = Vec3.dirXZ(by.pos, victim.pos);
    this.events.emit('knockdown', { victim, by, reason });
  }

  trySteal(p) {
    const carrier = this.ball.holder;
    p.cd.steal = ACTION.stealCooldown;
    this.setState(p, 'steal', 0.38);
    this.events.emit('stealattempt', { player: p });
    if (!carrier || carrier.team === p.team) {
      // Loose ball dive: handled by pickup radius bonus.
      p.ai.diving = 0.3;
      return false;
    }
    const d = p.pos.distanceToXZ(carrier.pos);
    if (d > ACTION.stealRange) return false;
    if (carrier.airborne || carrier.state === 'shoot') return false;
    const facing = this.forwardOf(p).dot(Vec3.dirXZ(p.pos, carrier.pos)) > 0.1;
    if (!facing) return false;
    let prob = 0.2 + ((p.data.stl - carrier.data.hnd) / 99) * 0.32;
    if (carrier.state === 'trick') prob *= carrier.trick && carrier.trick.turbo ? 0.35 : 0.6;
    if (carrier.state === 'idle' && carrier.stateTime > 1.2) prob += 0.12; // standing dribble
    if (carrier.state === 'pass') prob += 0.1;
    if (!this.isUser(p)) prob *= this.difficulty.stealRate;
    else prob *= 1.15;
    if (this.momentum[carrier.team] >= 3) prob *= 0.85;
    prob = clamp(prob, 0.04, 0.72);
    if (this.rng.chance(prob)) {
      carrier.stats.to++;
      p.stats.stl++;
      this.loseStyle(carrier.team, STYLE.lossOnTurnover);
      carrier.trick = null;
      carrier.shot = null;
      if (carrier.state === 'trick') this.setState(carrier, 'stumble', 0.4);
      this.giveBall(p);
      this.setState(p, 'catch', 0.12);
      this.addStyle(p, STYLE.stealPoints, 'STEAL', { big: true });
      this.events.emit('steal', { stealer: p, victim: carrier });
      return true;
    }
    // Whiff — the handler can punish.
    p.stun = ACTION.stealWhiffRecovery;
    return false;
  }

  tryShove(p) {
    p.cd.shove = ACTION.shoveCooldown;
    this.setState(p, 'shove', 0.42);
    const { player: target, dist } = this.nearestOpponent(p, (q) => q.state !== 'fallen');
    this.events.emit('shoveattempt', { player: p });
    if (!target || dist > ACTION.shoveRange) return false;
    if (target.airborne && target.y > 0.5) return false;
    const powA = p.data.pow + this.rng.range(0, 40);
    const powB = target.data.pow + this.rng.range(0, 40);
    if (powA > powB * 0.92) {
      this.knockDown(target, p, 'shove');
      this.addStyle(p, STYLE.shovePoints, 'SHOVE');
      this.events.emit('shove', { shover: p, victim: target });
      return true;
    }
    // Bounced off — small stumble for the shover.
    this.setState(target, 'stumble', 0.3);
    return false;
  }

  tryJump(p) {
    p.airborne = true;
    p.y = 0.001;
    p.vy = p.data.blk > 80 ? MOVE.bigJumpVelocity : MOVE.jumpVelocity;
    p.cd.jump = 0.9;
    this.setState(p, 'jump', 1.0);
    // Keep horizontal momentum (running jump).
    p.vel.scale(0.8);
    this.events.emit('jump', { player: p });
    return true;
  }

  tryGamebreaker(p) {
    if (!this.gbReady[p.team] || this.ball.holder !== p || this.mustClear) return false;
    this.gbReady[p.team] = false;
    this.gb[p.team] = 0;
    p.stats.gb++;
    this.state = 'gamebreaker';
    this.gbSeq = { player: p, t: 0, phase: 0, start: p.pos.clone() };
    p.input = emptyInput();
    p.trick = null;
    p.shot = null;
    p.vel.set(0, 0, 0);
    this.setState(p, 'gbwind', 0.7);
    this.slowmo = 3.5;
    this.timeScale = 0.55;
    this.events.emit('gamebreaker', { team: p.team, player: p });
    return true;
  }

  stepGamebreaker(dt) {
    const seq = this.gbSeq;
    const p = seq.player;
    seq.t += dt;
    for (const q of this.players) {
      q.stateTime += dt;
      if (q !== p && q.state === 'fallen' && q.stateTime >= q.stateDur) this.setState(q, 'idle');
    }
    if (seq.phase === 0) {
      // Wind-up: everyone near gets blown back.
      if (seq.t > 0.45) {
        for (const q of this.opponentsOf(p)) {
          if (q.pos.distanceToXZ(p.pos) < 4.0) this.knockDown(q, p, 'gamebreaker');
        }
        seq.phase = 1;
        seq.t = 0;
        this.setState(p, 'run', 0);
        this.events.emit('gbdrive', { player: p });
      }
      this.ball.pos.set(p.pos.x, DRIBBLE_HEIGHT, p.pos.z);
    } else if (seq.phase === 1) {
      // Scripted drive toward the takeoff point.
      const toRim = Vec3.dirXZ(p.pos, RIM_XZ);
      const takeoff = new Vec3(RIM_XZ.x + toRim.x * -2.2, 0, RIM_XZ.z + toRim.z * -2.2);
      const d = p.pos.distanceToXZ(takeoff);
      if (d < 0.25 || seq.t > 1.6) {
        p.pos.copy(takeoff);
        seq.phase = 2;
        seq.t = 0;
        const points = this.rules.insidePoints + this.rules.gamebreakerBonus;
        this.startDunk(p, points, Vec3.dirXZ(p.pos, RIM_XZ), 2.2);
        p.shot.gb = true;
        p.shot.dunkType = DUNKS.length - 1; // 360 for the show
        p.lastDunkType = p.shot.dunkType;
        this.events.emit('gbslam', { player: p });
      } else {
        const speed = 9.5;
        p.vel.set(toRim.x * speed, 0, toRim.z * speed);
        p.pos.addScaled(p.vel, dt);
        p.facing = Math.atan2(toRim.x, toRim.z);
        p.state = 'run';
        p.speedNorm = 1;
        for (const q of this.opponentsOf(p)) {
          if (q.state !== 'fallen' && q.pos.distanceToXZ(p.pos) < 1.4) this.knockDown(q, p, 'gamebreaker');
        }
      }
      this.ball.pos.set(p.pos.x, DRIBBLE_HEIGHT, p.pos.z);
    } else if (seq.phase === 2) {
      this.updatePlayerPhysics(p, dt, false);
      if (this.ball.holder === p) this.ball.pos.copy(this.handPos(p));
      else this.updateBall(dt, true);
      if (p.shot && p.shot.released && !p.airborne) {
        seq.phase = 3;
        seq.t = 0;
      }
      if (p.shot && p.shot.released && p.state !== 'dunk') {
        seq.phase = 3;
        seq.t = 0;
      }
    } else {
      // Landing beat, then reset via the dead-ball path.
      this.updateBall(dt, true);
      if (seq.t > 0.5) {
        this.gbSeq = null;
        this.slowmo = 0;
        this.timeScale = 1;
        if (this.state === 'gamebreaker') {
          // scoreBasket already switched us to dead; if not (miss), turnover.
          this.turnover(p.team, 'GB MISS');
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Ball
  // ---------------------------------------------------------------------------

  updateBall(dt, dead) {
    const b = this.ball;
    if (b.netting > 0) b.netting -= dt;
    if (b.holder) {
      const p = b.holder;
      if (p.state === 'shoot' || p.state === 'dunk' || p.state === 'layup' || p.state === 'oop' || p.state === 'jump') {
        b.pos.copy(this.handPos(p));
        if (p.state === 'dunk' || p.state === 'oop') b.pos.y = 2.35 + p.y;
      } else if (p.state === 'trick' && p.trick) {
        const u = p.stateTime / Math.max(0.01, p.stateDur);
        const f = this.forwardOf(p);
        const side = new Vec3(f.z, 0, -f.x);
        const s = Math.sin(u * Math.PI * 2) * 0.5;
        const h = p.trick.type === 5 ? 1.9 + Math.sin(u * Math.PI) * 0.6 : 0.25 + Math.abs(Math.cos(u * Math.PI * 2)) * 0.7;
        b.pos.set(p.pos.x + side.x * s + f.x * 0.2, h + p.y, p.pos.z + side.z * s + f.z * 0.2);
      } else {
        const f = this.forwardOf(p);
        const side = new Vec3(f.z, 0, -f.x);
        const bounce = Math.abs(Math.sin(p.anim.t * (p.speedNorm > 0.2 ? 11 : 7)));
        b.pos.set(p.pos.x + f.x * 0.25 + side.x * 0.35, 0.13 + bounce * (0.75 + p.speedNorm * 0.2) + p.y, p.pos.z + f.z * 0.25 + side.z * 0.35);
      }
      return;
    }

    if (b.flight) {
      this.updateFlight(dt, dead);
      return;
    }

    // Free physics
    b.vel.y -= PHYS.gravity * dt;
    b.vel.scale(PHYS.ballAirDrag);
    b.pos.addScaled(b.vel, dt);
    const r = PHYS.ballRadius;
    if (b.pos.y < r) {
      b.pos.y = r;
      if (Math.abs(b.vel.y) > 1.0) {
        b.vel.y = -b.vel.y * PHYS.ballRestitution;
        this.events.emit('bounce', { pos: b.pos.clone(), speed: Math.abs(b.vel.y) });
      } else {
        b.vel.y = 0;
      }
      b.vel.x *= PHYS.ballFloorFriction;
      b.vel.z *= PHYS.ballFloorFriction;
      b.grounded = Math.abs(b.vel.y) < 0.05;
    } else b.grounded = false;
    // Fence
    if (b.pos.x < FENCE.minX + r) {
      b.pos.x = FENCE.minX + r;
      b.vel.x = Math.abs(b.vel.x) * 0.7;
      this.events.emit('fence', {});
    }
    if (b.pos.x > FENCE.maxX - r) {
      b.pos.x = FENCE.maxX - r;
      b.vel.x = -Math.abs(b.vel.x) * 0.7;
      this.events.emit('fence', {});
    }
    if (b.pos.z < FENCE.minZ + r) {
      b.pos.z = FENCE.minZ + r;
      b.vel.z = Math.abs(b.vel.z) * 0.7;
      this.events.emit('fence', {});
    }
    if (b.pos.z > FENCE.maxZ - r) {
      b.pos.z = FENCE.maxZ - r;
      b.vel.z = -Math.abs(b.vel.z) * 0.7;
      this.events.emit('fence', {});
    }
    // Backboard
    if (
      b.pos.z < COURT.backboardZ + r &&
      b.pos.z > COURT.backboardZ - 0.3 &&
      Math.abs(b.pos.x - RIM.x) < COURT.backboardWidth / 2 &&
      b.pos.y > COURT.backboardBottom &&
      b.pos.y < COURT.backboardBottom + COURT.backboardHeight &&
      b.vel.z < 0
    ) {
      b.pos.z = COURT.backboardZ + r;
      b.vel.z = -b.vel.z * 0.75;
      this.events.emit('board', {});
    }
    // Rim ring
    if (!(b.netting > 0) && b.rimCooldown <= 0) {
      const dy = b.pos.y - RIM.y;
      if (Math.abs(dy) < r + 0.03) {
        const dx = b.pos.x - RIM.x;
        const dz = b.pos.z - RIM.z;
        const dr = Math.sqrt(dx * dx + dz * dz);
        if (Math.abs(dr - COURT.rimRadius) < r + 0.02 && dr > 1e-4) {
          const nx = dx / dr;
          const nz = dz / dr;
          const sign = dr > COURT.rimRadius ? 1 : -1;
          const vn = b.vel.x * nx + b.vel.z * nz;
          if (vn * sign < 0) {
            b.vel.x -= (1 + 0.6) * vn * nx;
            b.vel.z -= (1 + 0.6) * vn * nz;
          }
          b.vel.y = Math.abs(b.vel.y) * 0.5 + 1.0;
          b.rimCooldown = 0.08;
          this.events.emit('rim', { hard: false });
        }
      }
    }
    if (!b.pos.isFinite()) {
      b.pos.set(0, 1, 0);
      b.vel.set(0, 0, 0);
    }
    if (!dead) this.checkPickup();
  }

  updateFlight(dt, dead) {
    const b = this.ball;
    const f = b.flight;
    f.t += dt;
    if (f.kind === 'pass') {
      // Home in on a moving receiver.
      if (f.target && f.target.state !== 'fallen') {
        f.to.x = f.target.pos.x;
        f.to.z = f.target.pos.z;
        f.to.y = 1.35 + f.target.y;
      }
    }
    const u = clamp(f.t / f.dur, 0, 1);
    const arcY = f.arc >= 0 ? f.arc * 4 * u * (1 - u) : 0;
    b.pos.x = lerp(f.from.x, f.to.x, u);
    b.pos.z = lerp(f.from.z, f.to.z, u);
    if (f.arc < 0) {
      // Bounce pass: dip to the floor at the midpoint.
      const dip = Math.abs(f.arc);
      if (u < 0.5) b.pos.y = lerp(f.from.y, PHYS.ballRadius, u / 0.5);
      else b.pos.y = lerp(PHYS.ballRadius, f.to.y, (u - 0.5) / 0.5);
      if (u > 0.48 && u < 0.52 && !f.bounced) {
        f.bounced = true;
        this.events.emit('bounce', { pos: b.pos.clone(), speed: dip * 3 });
      }
    } else {
      b.pos.y = lerp(f.from.y, f.to.y, u) + arcY;
    }
    // Approximate velocity for the renderer / trails.
    b.vel.set((f.to.x - f.from.x) / f.dur, (f.to.y - f.from.y) / f.dur + f.arc * 4 * (1 - 2 * u) / f.dur, (f.to.z - f.from.z) / f.dur);

    if (!dead) {
      if (f.kind === 'shot' && f.blockable && f.t < 0.42) this.checkBlocks();
      if ((f.kind === 'pass' || f.kind === 'lob') && f.t > 0.05) this.checkInterceptions();
      if (!b.flight) return; // blocked / intercepted
    }

    if (u >= 1) this.arrive(dead);
  }

  arrive(dead) {
    const b = this.ball;
    const f = b.flight;
    b.flight = null;
    if (f.kind === 'shot') {
      if (f.willMake) {
        this.events.emit('swish', { player: f.shooter, points: f.points });
        this.scoreBasket(f.shooter, f.points, f.shotType, { gb: f.gb });
        b.vel.set(this.rng.range(-0.3, 0.3), -2.2, this.rng.range(-0.3, 0.3));
        b.netting = 0.4;
        b.pos.set(RIM.x, RIM.y - 0.05, RIM.z);
        if (f.shotType === 'jumper' && f.points === 2) this.addStyle(f.shooter, STYLE.swishBonus, 'DEEP');
      } else {
        this.missBounce(f);
        this.events.emit('miss', { player: f.shooter, type: f.shotType });
        this.momentum[f.shooter.team] = 0;
        this.shotClock = this.rules.shotClock; // rim reset
      }
    } else if (f.kind === 'pass') {
      const t = f.target;
      if (t && t.state !== 'fallen' && t.pos.distanceToXZ(b.pos) < ACTION.catchRadius + 0.6) {
        this.giveBall(t);
        if (t.state === 'idle' || t.state === 'run') this.setState(t, 'catch', 0.1);
        t.ai.lastCatch = this.time;
        this.events.emit('catch', { player: t, from: f.passer });
      } else {
        b.vel.set(this.rng.range(-1, 1), 0.5, this.rng.range(-1, 1));
        b.releaseCooldown = null;
      }
    } else if (f.kind === 'lob') {
      const t = f.target;
      if (t) t.ai.oop = null;
      const near = t && t.airborne && t.pos.distanceToXZ(RIM_XZ) < 2.4 && t.y > 0.35;
      if (near && t.state !== 'fallen') {
        // Catch and slam.
        b.holder = t;
        t.hasBall = true;
        const points = this.rules.insidePoints;
        t.shot = { type: 'dunk', released: false, points, slamTime: t.stateTime + 0.08, dunkType: t.data.dnk > 85 ? this.rng.int(1, 4) : 0, oop: true, passer: f.passer };
        t.lastDunkType = t.shot.dunkType;
        t.state = 'oop';
        t.stateDur = 1.2;
        t.stats.fga++;
        this.stats.shots++;
        this.events.emit('oopcatch', { player: t });
      } else {
        // Lob goes off the rim.
        b.vel.set(this.rng.range(-2, 2), 1.5, this.rng.range(1, 3));
        this.events.emit('rim', { hard: false });
        this.events.emit('miss', { player: f.passer, type: 'lob' });
      }
    }
  }

  missBounce(f) {
    const b = this.ball;
    const shooter = f.shooter;
    const out = Vec3.dirXZ(RIM_XZ, shooter.pos);
    const side = new Vec3(out.z, 0, -out.x);
    const lat = this.rng.range(-1.6, 1.6);
    switch (f.missKind) {
      case 'board':
        b.vel.set(lat * 0.8, this.rng.range(0.8, 2.2), this.rng.range(2.0, 3.8));
        this.events.emit('board', {});
        break;
      case 'back':
        b.vel.set(out.x * this.rng.range(0.5, 2.0) + side.x * lat, this.rng.range(2.0, 3.6), out.z * this.rng.range(0.5, 2.0) + side.z * lat);
        this.events.emit('rim', { hard: true });
        break;
      case 'side':
        b.vel.set(side.x * this.rng.range(1.5, 3.2) * (this.rng.chance(0.5) ? 1 : -1) + out.x, this.rng.range(1.5, 3.0), side.z * lat + out.z * 1.2);
        this.events.emit('rim', { hard: true });
        break;
      case 'short':
        b.vel.set(out.x * this.rng.range(0.2, 1.0) + side.x * lat * 0.5, this.rng.range(0.5, 1.5), out.z * this.rng.range(0.2, 1.0) + side.z * lat * 0.5);
        this.events.emit('rim', { hard: false });
        break;
      default: // front
        b.vel.set(out.x * this.rng.range(1.6, 3.4) + side.x * lat, this.rng.range(1.8, 3.4), out.z * this.rng.range(1.6, 3.4) + side.z * lat);
        this.events.emit('rim', { hard: true });
    }
    b.rimCooldown = 0.15;
    if (f.shooter) this.loseStyle(f.shooter.team, 20);
  }

  checkBlocks() {
    const b = this.ball;
    const f = b.flight;
    for (const q of this.players) {
      if (q.team === f.shooter.team) continue;
      if (!q.airborne || q.state !== 'jump') continue;
      const reach = 2.25 + q.y + (q.data.blk / 99) * 0.25;
      const horiz = q.pos.distanceToXZ(b.pos);
      const inFront = Vec3.dirXZ(f.shooter.pos, RIM_XZ).dot(Vec3.dirXZ(f.shooter.pos, q.pos)) > 0.35 || horiz < 0.5;
      if (horiz < 1.05 && inFront && b.pos.y < reach && b.pos.y > 1.2 + q.y) {
        // Timing/skill roll — early in the flight is easier.
        let prob = 0.14 + (q.data.blk / 99) * 0.3 - f.t * 0.5;
        if (this.isUser(q)) prob += 0.15;
        else prob *= this.difficulty.contestQuality;
        if (f.shotType === 'dunk' || f.shotType === 'layup') prob *= 0.6;
        if (this.rng.chance(clamp(prob, 0.05, 0.92))) {
          // BLOCKED
          b.flight = null;
          const away = Vec3.dirXZ(f.shooter.pos, q.pos);
          b.vel.set(away.x * this.rng.range(3, 6) + this.rng.range(-2, 2), this.rng.range(1, 3), away.z * this.rng.range(3, 6) + this.rng.range(-2, 2));
          b.releaseCooldown = { player: f.shooter, t: 0.5 };
          q.stats.blk++;
          this.addStyle(q, STYLE.blockPoints, 'REJECTED', { big: true });
          this.loseStyle(f.shooter.team, STYLE.lossOnBlocked);
          this.momentum[f.shooter.team] = 0;
          this.events.emit('block', { blocker: q, shooter: f.shooter });
          if (this.userTeam !== null) {
            this.slowmo = 0.4;
            this.timeScale = 0.4;
          }
          return;
        }
        f.blockable = false; // one roll per shot
        return;
      }
    }
  }

  checkInterceptions() {
    const b = this.ball;
    const f = b.flight;
    const passerTeam = f.passer.team;
    for (const q of this.players) {
      if (q.team === passerTeam || f.checked.has(q.id)) continue;
      if (q.state === 'fallen') continue;
      const horiz = q.pos.distanceToXZ(b.pos);
      const reach = 2.2 + q.y;
      if (horiz < 0.75 && b.pos.y < reach) {
        f.checked.add(q.id);
        // Passive deflections are rare; a defender who actively lunges (steal/jump) is the real threat.
        const active = q.state === 'steal' || q.state === 'jump';
        let prob = active ? 0.42 + ((q.data.stl - 50) / 99) * 0.35 : 0.05 + ((q.data.stl - 50) / 99) * 0.06;
        if (f.kind === 'lob') prob *= 0.5;
        if (f.kind === 'pass' && f.t !== undefined && f.t < 0.12) prob *= 0.4; // just left the hand
        if (!this.isUser(q)) prob *= this.difficulty.stealRate * 0.8;
        if (this.rng.chance(clamp(prob, 0.02, 0.85))) {
          b.flight = null;
          f.passer.stats.to++;
          q.stats.stl++;
          this.loseStyle(passerTeam, STYLE.lossOnTurnover);
          this.giveBall(q);
          this.setState(q, 'catch', 0.15);
          this.addStyle(q, STYLE.stealPoints, 'PICKED OFF', { big: true });
          this.events.emit('steal', { stealer: q, victim: f.passer, pass: true });
          return;
        }
      }
    }
  }

  checkPickup() {
    const b = this.ball;
    if (b.netting > 0) return;
    let best = null;
    let bd = Infinity;
    for (const q of this.players) {
      if (q.state === 'fallen' || q.state === 'stumble') continue;
      if (b.releaseCooldown && b.releaseCooldown.player === q) continue;
      if (q.cd.catch > 0) continue;
      const horiz = q.pos.distanceToXZ(b.pos);
      const reach = q.airborne ? 2.4 + q.y : 2.15;
      let radius = ACTION.looseBallPickupRadius + (q.ai.diving > 0 ? 0.35 : 0);
      if (q.state === 'steal') radius += 0.3;
      if (horiz < radius && b.pos.y < reach) {
        // Rebound battle: bigger BLK wins ties.
        const score = horiz - (q.data.blk / 99) * 0.3 - (q.airborne ? 0.2 : 0);
        if (score < bd) {
          bd = score;
          best = q;
        }
      }
    }
    if (best) {
      const wasShot = b.lastTeam !== undefined;
      const prevTeam = b.lastTeam;
      this.giveBall(best);
      if (best.state !== 'jump') this.setState(best, 'catch', 0.12);
      if (wasShot && prevTeam !== best.team) {
        best.stats.reb++;
        this.events.emit('rebound', { player: best, defensive: true });
      } else if (wasShot) {
        best.stats.reb++;
        this.events.emit('rebound', { player: best, defensive: false });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Rules
  // ---------------------------------------------------------------------------

  updateRules(dt) {
    // Clear check
    if (this.mustClear) {
      const holder = this.ball.holder;
      const ref = holder ? holder.pos : this.ball.flight ? this.ball.pos : null;
      if (ref && this.distToRim(ref) > COURT.arcRadius + 0.15 && (holder || this.ball.flight)) {
        if (!holder || holder.team === this.possession) {
          this.mustClear = false;
          this.events.emit('cleared', { team: this.possession });
        }
      }
    }
    // Shot clock
    if (this.ball.holder || (this.ball.flight && this.ball.flight.kind !== 'shot')) {
      this.shotClock -= dt;
      if (this.shotClock <= 0) {
        this.events.emit('shotclock', { team: this.possession });
        this.turnover(this.possession, 'SHOT CLOCK');
      }
    }
  }

  turnover(team, reason) {
    if (this.state === 'over') return;
    this.loseStyle(team, STYLE.lossOnTurnover);
    this.momentum[team] = 0;
    this.events.emit('turnover', { team, reason });
    this.deadReason = reason;
    this.pendingPossession = 1 - team;
    this.state = 'dead';
    this.stateTimer = 0.9;
    if (this.ball.holder) {
      this.ball.holder.hasBall = false;
      this.ball.holder = null;
    }
    this.ball.flight = null;
    this.ball.vel.set(0, 0, 0);
    for (const p of this.players) {
      p.shot = null;
      p.trick = null;
    }
  }

  scoreBasket(p, points, type, opts = {}) {
    if (this.state === 'over') return;
    const team = p.team;
    this.score[team] += points;
    p.stats.pts += points;
    p.stats.fgm++;
    if (points >= 2) p.stats.twos++;
    this.momentum[team] += 1;
    this.momentum[1 - team] = 0;
    let stolen = 0;
    if (opts.gb) {
      stolen = Math.min(this.score[1 - team], this.rules.gamebreakerSteal);
      this.score[1 - team] -= stolen;
    }
    // Assist credit
    if (opts.assist || (p.shot && p.shot.passer)) {
      const a = opts.assist || p.shot.passer;
      a.stats.ast++;
      this.addStyle(a, STYLE.alleyOopPoints, 'ALLEY-OOP', { big: true });
      this.events.emit('alleyoop', { passer: a, finisher: p });
    } else {
      // Recent pass → assist
      for (const q of this.teammatesOf(p)) {
        if (this.time - q.lastPassTime < 2.2 && q.lastPassTime > 0) {
          q.stats.ast++;
          break;
        }
      }
    }
    this.lastScorer = p;
    this.events.emit('score', { team, player: p, points, type, gb: !!opts.gb, stolen, score: [...this.score], momentum: this.momentum[team] });
    if (this.momentum[team] === 3) this.events.emit('heating', { team, player: p });
    this.deadReason = 'score';
    this.pendingPossession = 1 - team;
    this.state = 'dead';
    this.stateTimer = opts.gb ? 2.0 : this.rules.resetDuration + 0.6;
    this.setState(p, p.airborne ? p.state : 'celebrate', p.airborne ? p.stateDur : 1.2);
    this.checkGameOver(true);
  }

  checkGameOver(deferReset = false) {
    const [a, b] = this.score;
    const { targetScore, winBy, scoreCap } = this.rules;
    let winner = null;
    if ((a >= targetScore && a - b >= winBy) || a >= scoreCap) winner = 0;
    else if ((b >= targetScore && b - a >= winBy) || b >= scoreCap) winner = 1;
    if (winner === null) return false;
    if (deferReset && this.state === 'dead') {
      // Finalize when the dead-ball timer runs out so the bucket/celebration plays out.
      this.pendingGameOver = winner;
      this.stateTimer = Math.max(this.stateTimer, 1.6);
      return false;
    }
    this.finishGame(winner);
    return true;
  }

  finishGame(winner) {
    if (this.state === 'over') return;
    this.state = 'over';
    this.winner = winner;
    this.events.emit('gameover', { winner, score: [...this.score], players: this.players });
  }

  // Serialisable snapshot for debugging / tests.
  snapshot() {
    return {
      t: +this.time.toFixed(2),
      state: this.state,
      score: [...this.score],
      gb: this.gb.map((v) => Math.round(v)),
      poss: this.possession,
      clear: this.mustClear,
      clock: +this.shotClock.toFixed(1),
      holder: this.ball.holder ? this.ball.holder.id : null,
      flight: this.ball.flight ? this.ball.flight.kind : null,
      ball: [+this.ball.pos.x.toFixed(2), +this.ball.pos.y.toFixed(2), +this.ball.pos.z.toFixed(2)],
    };
  }
}
