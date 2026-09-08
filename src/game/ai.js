import { Vec3, clamp } from '../core/vec3.js';
import { COURT, ACTION } from '../data/constants.js';

/**
 * Per-player AI. Writes into p.input every frame exactly like a human would,
 * so the same action code path handles both. Decisions are re-evaluated on
 * a reaction timer that scales with difficulty.
 */

const RIM_XZ = new Vec3(COURT.rimX, 0, COURT.rimZ);

const OFFENSE_SPOTS = [
  new Vec3(-5.6, 0, -3.2), // left corner-ish
  new Vec3(5.6, 0, -3.2), // right corner
  new Vec3(-4.6, 0, 1.6), // left wing
  new Vec3(4.6, 0, 1.6), // right wing
  new Vec3(0, 0, 3.2), // top
  new Vec3(-2.2, 0, -3.6), // left block
  new Vec3(2.2, 0, -3.6), // right block
];

function steerTo(p, target, speedScale = 1) {
  const dx = target.x - p.pos.x;
  const dz = target.z - p.pos.z;
  const d = Math.sqrt(dx * dx + dz * dz);
  if (d < 0.15) {
    p.input.moveX = 0;
    p.input.moveZ = 0;
    return d;
  }
  const s = Math.min(1, d / 1.2) * speedScale;
  p.input.moveX = (dx / d) * s;
  p.input.moveZ = (dz / d) * s;
  return d;
}

function clearInput(p) {
  const i = p.input;
  i.moveX = 0;
  i.moveZ = 0;
  i.turbo = false;
  i.shootPressed = false;
  i.shootReleased = false;
  i.pass = false;
  i.trick = false;
  i.shove = false;
  i.jump = false;
  i.gamebreaker = false;
  i.switchPlayer = false;
}

export function updateAI(sim, p, dt) {
  clearInput(p);
  if (p.state === 'fallen' || p.state === 'stumble') return;
  const ai = p.ai;
  ai.timer -= dt;
  if (ai.cutTimer > 0) ai.cutTimer -= dt;
  else ai.cutting = false;
  if (ai.diving > 0) ai.diving -= dt;
  const diff = sim.difficulty;
  const isUserTeam = sim.userTeam !== null && p.team === sim.userTeam;
  // Teammates of the human play at "pro" quality so they never feel like dead weight,
  // but never above the chosen difficulty for shot-making.
  const react = isUserTeam ? 0.22 : diff.reaction;

  const ball = sim.ball;
  const holder = ball.holder;

  if (ai.oop) return alleyOopReceiver(sim, p, dt);
  if (holder === p) return offenseWithBall(sim, p, dt, react);
  if (holder && holder.team === p.team) return offenseOffBall(sim, p, dt, react);
  if (holder && holder.team !== p.team) return defense(sim, p, dt, react);
  return looseBall(sim, p, dt, react);
}

// ---------------------------------------------------------------------------
// Offense — ball handler
// ---------------------------------------------------------------------------

function offenseWithBall(sim, p, dt, react) {
  const ai = p.ai;
  const rng = sim.rng;
  const diff = sim.difficulty;
  const dRim = sim.distToRim(p.pos);
  const { player: def, dist: dDef } = sim.nearestOpponent(p, (q) => q.state !== 'fallen');
  const inp = p.input;

  // In an airborne shot? Nothing to decide.
  if (p.state === 'shoot' || p.state === 'dunk' || p.state === 'layup' || p.state === 'oop') return;

  // Must clear: head to the arc.
  if (sim.mustClear) {
    const out = Vec3.dirXZ(RIM_XZ, p.pos);
    const target = new Vec3(RIM_XZ.x + out.x * (COURT.arcRadius + 1.2), 0, RIM_XZ.z + out.z * (COURT.arcRadius + 1.2));
    if (Math.abs(target.x) > COURT.halfWidth - 0.5) target.x = Math.sign(target.x) * (COURT.halfWidth - 0.5);
    if (target.z > COURT.halcourtZ) target.z = COURT.halfcourtZ - 0.5;
    steerTo(p, target);
    inp.turbo = p.turbo > 30;
    return;
  }

  if (ai.timer > 0 && ai.decision) return executeDecision(sim, p, dt, def, dDef, dRim);

  // ---- Decide ----
  ai.timer = react * rng.range(0.7, 1.3);
  const open = dDef > 2.6;
  const clock = sim.shotClock;
  const gbReady = sim.gbReady[p.team];
  const outside = dRim > COURT.arcRadius;

  // Gamebreaker: use it when available and reasonably close.
  if (gbReady && rng.chance(diff.gbUse) && dRim < 9 && p.state !== 'trick') {
    ai.decision = { type: 'gamebreaker' };
    return executeDecision(sim, p, dt, def, dDef, dRim);
  }

  // Emergency: shot clock.
  if (clock < 2.2) {
    ai.decision = { type: 'shoot' };
    return executeDecision(sim, p, dt, def, dDef, dRim);
  }

  // Score chances
  const shotStat = p.data.shot / 99;
  const dnkStat = p.data.dnk / 99;
  let shootDesire = 0;
  if (dRim < 2.6) shootDesire = 0.75 + dnkStat * 0.25;
  else if (dRim < 4.5) shootDesire = (open ? 0.5 : 0.25) + shotStat * 0.25;
  else if (outside && dRim < 9) shootDesire = (open ? 0.42 : 0.12) * (0.4 + shotStat);
  else if (dRim < COURT.arcRadius) shootDesire = (open ? 0.38 : 0.15) * (0.5 + shotStat * 0.6);
  else shootDesire = 0.02;
  if (clock < 6) shootDesire += 0.25;
  if (sim.momentum[p.team] >= 3) shootDesire += 0.1;

  // Open cutter?
  const mates = sim.teammatesOf(p).filter((q) => q.state !== 'fallen');
  let bestMate = null;
  let bestMateScore = -Infinity;
  for (const q of mates) {
    const { dist: qd } = sim.nearestOpponent(q);
    const qRim = sim.distToRim(q.pos);
    let s = qd * 0.5 - qRim * 0.08 + (q.ai.cutting ? 1.2 : 0);
    if (q.ai.lastCatch !== undefined && sim.time - q.ai.lastCatch < 1.0) s -= 2; // don't ping-pong
    if (s > bestMateScore) {
      bestMateScore = s;
      bestMate = q;
    }
  }
  const oopChance = bestMate && bestMate.ai.cutting && sim.distToRim(bestMate.pos) < 5.5 && bestMate.data.dnk > 60 && bestMateScore > 0.8;
  let passDesire = bestMate ? clamp(bestMateScore * 0.22, 0, 0.7) : 0;
  if (p.stateTime > 3.0 && p.state === 'idle') passDesire += 0.3;
  if (!open && dRim > 4) passDesire += 0.15;
  if (oopChance) passDesire += 0.3;

  // Tricks: when a defender is on you and you have handles.
  let trickDesire = 0;
  if (def && dDef < 2.2 && p.cd.trick <= 0) {
    trickDesire = (0.25 + (p.data.hnd / 99) * 0.5) * diff.trickRate;
    if (def.state === 'steal') trickDesire += 0.3;
    if (dRim < 3) trickDesire *= 0.4;
  }

  const roll = rng.next();
  const total = shootDesire + passDesire + trickDesire + 0.35; // 0.35 = drive/move weight
  if (roll < shootDesire / total) ai.decision = { type: 'shoot' };
  else if (roll < (shootDesire + passDesire) / total) ai.decision = { type: 'pass', target: bestMate, alley: !!oopChance };
  else if (roll < (shootDesire + passDesire + trickDesire) / total) ai.decision = { type: 'trick' };
  else ai.decision = { type: 'drive', t: rng.range(0.4, 1.1), side: rng.chance(0.5) ? 1 : -1, turbo: rng.chance(diff.turboUse) };
  return executeDecision(sim, p, dt, def, dDef, dRim);
}

function executeDecision(sim, p, dt, def, dDef, dRim) {
  const ai = p.ai;
  const d = ai.decision;
  const inp = p.input;
  if (!d) return;
  switch (d.type) {
    case 'gamebreaker':
      inp.gamebreaker = true;
      ai.decision = null;
      break;
    case 'shoot': {
      if (!sim.canAct(p)) return;
      inp.shootPressed = true;
      ai.decision = null;
      break;
    }
    case 'pass': {
      if (!sim.canAct(p)) return;
      if (d.target) {
        if (d.alley) {
          inp.turbo = true;
        } else {
          const to = Vec3.dirXZ(p.pos, d.target.pos);
          inp.moveX = to.x;
          inp.moveZ = to.z;
        }
        sim.tryPass(p, d.target, d.alley);
      }
      ai.decision = null;
      break;
    }
    case 'trick': {
      if (!sim.canAct(p) || p.cd.trick > 0) {
        ai.decision = null;
        return;
      }
      // Break toward the open side, biased toward the rim.
      const toRim = Vec3.dirXZ(p.pos, RIM_XZ);
      const side = new Vec3(toRim.z, 0, -toRim.x);
      let sgn = 1;
      if (def) {
        const toDef = Vec3.dirXZ(p.pos, def.pos);
        sgn = toDef.dot(side) > 0 ? -1 : 1;
      }
      const dir = new Vec3(toRim.x * 0.6 + side.x * sgn, 0, toRim.z * 0.6 + side.z * sgn).normalize();
      inp.moveX = dir.x;
      inp.moveZ = dir.z;
      inp.trick = true;
      inp.turbo = p.turbo > 25 && sim.rng.chance(0.6);
      ai.decision = null;
      break;
    }
    case 'drive': {
      d.t -= dt;
      const toRim = Vec3.dirXZ(p.pos, RIM_XZ);
      const side = new Vec3(toRim.z, 0, -toRim.x);
      // Steer around the defender.
      let dir = toRim.clone();
      if (def && dDef < 2.4) {
        const toDef = Vec3.dirXZ(p.pos, def.pos);
        const blocking = toDef.dot(toRim) > 0.5;
        if (blocking) {
          const sgn = toDef.dot(side) > 0 ? -1 : 1;
          dir = new Vec3(toRim.x * 0.4 + side.x * sgn * 1.0, 0, toRim.z * 0.4 + side.z * sgn * 1.0).normalize();
        }
      }
      if (dRim < 2.2) {
        // Don't run under the rim; finish.
        inp.shootPressed = true;
        ai.decision = null;
        return;
      }
      // Keep spacing from the sidelines.
      if (Math.abs(p.pos.x) > COURT.halfWidth - 1.2) dir.x -= Math.sign(p.pos.x) * 0.8;
      if (p.pos.z < COURT.baselineZ + 1.4) dir.z += 0.8;
      dir.normalize();
      inp.moveX = dir.x;
      inp.moveZ = dir.z;
      inp.turbo = d.turbo && p.turbo > 20;
      if (d.t <= 0) ai.decision = null;
      break;
    }
    default:
      ai.decision = null;
  }
}

// ---------------------------------------------------------------------------
// Offense — off ball
// ---------------------------------------------------------------------------

function alleyOopReceiver(sim, p, dt) {
  const ai = p.ai;
  const inp = p.input;
  ai.oop.t += dt;
  const f = sim.ball.flight;
  const remaining = f && f.kind === 'lob' ? f.dur - f.t : ai.oop.dur - ai.oop.t;
  const dRim = sim.distToRim(p.pos);
  // Run at a spot just in front of the rim, then time the jump for the catch.
  const approach = Vec3.dirXZ(RIM_XZ, p.pos);
  const spot = new Vec3(RIM_XZ.x + approach.x * 0.9, 0, RIM_XZ.z + approach.z * 0.9);
  if (!p.airborne) steerTo(p, spot, 1);
  inp.turbo = dRim > 1.5;
  if (remaining < 0.36 && !p.airborne && dRim < 2.3 && p.cd.jump <= 0) inp.jump = true;
  if (!f || f.kind !== 'lob' || ai.oop.t > ai.oop.dur + 0.6) {
    if (!(f && f.kind === 'lob')) ai.oop = null;
  }
}

function offenseOffBall(sim, p, dt, react) {
  const ai = p.ai;
  const rng = sim.rng;
  const holder = sim.ball.holder;
  const inp = p.input;

  if (sim.mustClear) {
    // Spread out beyond the arc.
    const spot = OFFENSE_SPOTS[p.slot === 0 ? 2 : p.slot === 1 ? 3 : 4];
    steerTo(p, spot);
    return;
  }

  if (ai.timer <= 0) {
    ai.timer = react * rng.range(1.5, 2.5);
    // Pick a spot: keep away from the handler and the other teammate.
    const others = sim.teammatesOf(p).filter((q) => q !== holder);
    const holderSideRight = holder.pos.x > 0;
    let best = null;
    let bs = -Infinity;
    for (const s of OFFENSE_SPOTS) {
      let score = rng.range(0, 1.2);
      score += s.distanceToXZ(holder.pos) * 0.3;
      for (const o of others) score += Math.min(4, s.distanceToXZ(o.ai.spot || o.pos)) * 0.4;
      // Prefer the weak side occasionally to create driving lanes.
      if ((s.x > 0) !== holderSideRight) score += 0.6;
      // Bigs live near the block.
      if (p.data.dnk > 80 && s.z < -2.5) score += 1.0;
      if (p.data.shot > 85 && sim.distToRim(s) > COURT.arcRadius - 0.5) score += 1.0;
      if (score > bs) {
        bs = score;
        best = s;
      }
    }
    ai.spot = best;
    // Random cut to the rim.
    if (!ai.cutting && rng.chance(0.28) && sim.distToRim(holder.pos) > 3.5) {
      ai.cutting = true;
      ai.cutTimer = rng.range(1.0, 1.8);
    }
  }

  if (ai.cutting) {
    const toRim = Vec3.dirXZ(p.pos, RIM_XZ);
    const target = new Vec3(RIM_XZ.x - toRim.x * 1.4 + (p.pos.x > 0 ? 0.8 : -0.8), 0, RIM_XZ.z + 1.4);
    steerTo(p, target);
    inp.turbo = p.turbo > 40;
    return;
  }
  if (ai.spot) {
    const d = steerTo(p, ai.spot, 0.9);
    // Fight through a defender who is glued to you.
    if (d < 0.4) {
      const { player: def, dist } = sim.nearestOpponent(p);
      if (def && dist < 1.0 && p.cd.shove <= 0 && rng.chance(0.01)) inp.shove = true;
    }
  }
}

// ---------------------------------------------------------------------------
// Defense
// ---------------------------------------------------------------------------

function defense(sim, p, dt, react) {
  const ai = p.ai;
  const rng = sim.rng;
  const diff = sim.difficulty;
  const holder = sim.ball.holder;
  const inp = p.input;
  const isUserTeam = sim.userTeam !== null && p.team === sim.userTeam;
  const quality = isUserTeam ? 0.9 : diff.contestQuality;
  const mark = p.guarding && p.guarding.team !== p.team ? p.guarding : holder;
  const onBall = mark === holder || (holder && holder.pos.distanceToXZ(p.pos) < 2.2 && sim.nearestPlayerTo(holder.pos, p.team).player === p);

  if (ai.timer <= 0) {
    ai.timer = react * rng.range(0.8, 1.4);
    ai.defRoll = rng.next();
  }

  if (onBall && holder) {
    // Stay between the handler and the rim, at a cushion that depends on their range.
    const toRim = Vec3.dirXZ(holder.pos, RIM_XZ);
    const cushion = holder.data.shot > 82 ? 0.85 : 1.15;
    const target = new Vec3(holder.pos.x + toRim.x * cushion, 0, holder.pos.z + toRim.z * cushion);
    const d = steerTo(p, target, 1);
    inp.turbo = holder.turboActive && p.turbo > 20 && d > 0.8;
    const dHolder = p.pos.distanceToXZ(holder.pos);

    // Contest jump shots (one roll per shot)
    if ((holder.state === 'shoot' || holder.state === 'layup' || holder.state === 'dunk') && holder.stateTime < 0.22 && !p.airborne && p.cd.jump <= 0 && dHolder < 1.9) {
      if (ai.contestedShot !== holder.shot) {
        ai.contestedShot = holder.shot;
        if (rng.chance(0.28 + quality * 0.3 + (p.data.blk > 80 ? 0.15 : 0))) inp.jump = true;
      }
      return;
    }
    // Steal / shove attempts — rolled on a fixed cadence (every 0.3s), not per frame.
    ai.rollTimer = (ai.rollTimer || 0) - dt;
    if (ai.rollTimer <= 0) {
      ai.rollTimer = 0.3;
      if (dHolder < ACTION.stealRange + 0.1 && p.cd.steal <= 0 && !holder.airborne) {
        let pSteal = 0.02 + diff.stealRate * 0.025;
        if (holder.state === 'idle' && holder.stateTime > 1.0) pSteal *= 2.2;
        if (holder.state === 'trick') pSteal *= 0.4;
        if (p.data.stl > 80) pSteal *= 1.5;
        if (rng.chance(clamp(pSteal, 0, 0.2))) inp.trick = true;
      }
      if (!inp.trick && dHolder < ACTION.shoveRange && p.cd.shove <= 0 && (holder.state === 'run' || holder.state === 'idle') && p.data.pow > 72) {
        if (rng.chance(0.05 + (p.data.pow - 72) / 400)) inp.shove = true;
      }
    }
    return;
  }

  // Off-ball defense: deny/help.
  if (mark) {
    const ballNear = holder && holder.pos.distanceToXZ(RIM_XZ) < 3.6;
    const helpSide = ballNear && p.data.blk > 70 && p.pos.distanceToXZ(RIM_XZ) < 6;
    let target;
    if (helpSide && ai.defRoll < 0.6 * quality) {
      // Rotate to protect the rim.
      const toRim = Vec3.dirXZ(holder.pos, RIM_XZ);
      target = new Vec3(RIM_XZ.x - toRim.x * 1.2, 0, RIM_XZ.z - toRim.z * 1.2 + 0.4);
      const d = steerTo(p, target, 1);
      if (holder && (holder.state === 'dunk' || holder.state === 'layup') && holder.stateTime < 0.2 && !p.airborne && p.cd.jump <= 0 && holder.pos.distanceToXZ(p.pos) < 2.3) {
        if (rng.chance(0.4 + quality * 0.4)) inp.jump = true;
      }
      inp.turbo = d > 2 && p.turbo > 30;
      return;
    }
    // Sag between the mark and the ball/rim (deny lobs by being closer to the rim).
    const toRim = Vec3.dirXZ(mark.pos, RIM_XZ);
    const sag = mark.ai.cutting ? 0.5 : 1.0;
    target = new Vec3(mark.pos.x + toRim.x * sag, 0, mark.pos.z + toRim.z * sag);
    // Shade toward the ball a little
    if (holder) {
      const toBall = Vec3.dirXZ(target, holder.pos);
      target.x += toBall.x * 0.5;
      target.z += toBall.z * 0.5;
    }
    const d = steerTo(p, target, 1);
    inp.turbo = d > 2.5 && p.turbo > 40 && mark.ai.cutting;
    // Jump to contest a lob if one is in the air near us.
    const f = sim.ball.flight;
    if (f && f.kind === 'lob' && f.target === mark && f.t > f.dur * 0.55 && !p.airborne && p.cd.jump <= 0 && p.pos.distanceToXZ(RIM_XZ) < 2.6) {
      if (rng.chance(0.5 * quality)) inp.jump = true;
    }
    if (f && f.kind === 'pass' && f.target === mark && sim.ball.pos.distanceToXZ(p.pos) < 1.2 && p.cd.steal <= 0 && !ai.lungedFor) {
      ai.lungedFor = f;
      if (rng.chance(0.35 * diff.stealRate)) inp.trick = true; // lunge for the pick
    }
  }
}

// ---------------------------------------------------------------------------
// Loose ball
// ---------------------------------------------------------------------------

function looseBall(sim, p, dt, react) {
  const b = sim.ball;
  const inp = p.input;
  const f = b.flight;
  if (f && (f.kind === 'pass' || f.kind === 'lob')) {
    if (f.target === p) {
      // Receiver: move to the arrival point.
      if (f.kind === 'pass') {
        // stay put / small adjust toward the ball line
        steerTo(p, new Vec3(f.to.x, 0, f.to.z), 0.6);
      }
      return;
    }
    if (f.passer && f.passer.team === p.team) {
      // Teammate: keep spacing.
      return offenseSpacingDuringPass(sim, p);
    }
    // Defender: try to jump the passing lane if close.
    const d = p.pos.distanceToXZ(b.pos);
    if (d < 2.5) {
      steerTo(p, new Vec3(b.pos.x + b.vel.x * 0.15, 0, b.pos.z + b.vel.z * 0.15));
      if (d < 1.0 && p.cd.steal <= 0 && p.ai.lungedFor !== f) {
        p.ai.lungedFor = f;
        if (sim.rng.chance(0.3 * sim.difficulty.stealRate)) inp.trick = true;
      }
    } else if (p.guarding) {
      const toRim = Vec3.dirXZ(p.guarding.pos, RIM_XZ);
      steerTo(p, new Vec3(p.guarding.pos.x + toRim.x, 0, p.guarding.pos.z + toRim.z));
    }
    return;
  }
  if (f && f.kind === 'shot') {
    // Box out / crash the glass.
    const out = Vec3.dirXZ(RIM_XZ, p.pos);
    const spot = new Vec3(RIM_XZ.x + out.x * 1.8, 0, RIM_XZ.z + out.z * 1.8);
    if (spot.z < COURT.baselineZ + 0.8) spot.z = COURT.baselineZ + 0.8;
    steerTo(p, spot, 0.9);
    return;
  }
  // Truly loose: chase, predicted.
  const lead = 0.25;
  const target = new Vec3(b.pos.x + b.vel.x * lead, 0, b.pos.z + b.vel.z * lead);
  const d = steerTo(p, target, 1);
  inp.turbo = d > 1.5 && p.turbo > 15;
  // Jump for a high ball
  if (d < 0.9 && b.pos.y > 2.1 && b.pos.y < 3.2 && !p.airborne && p.cd.jump <= 0) inp.jump = true;
}

function offenseSpacingDuringPass(sim, p) {
  if (p.ai.spot) steerTo(p, p.ai.spot, 0.7);
}
