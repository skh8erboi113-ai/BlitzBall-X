import { Vec3, clamp } from '../core/vec3.js';
import { ARENA, ACTION, MOVE } from '../data/constants.js';

/**
 * CPU brains for Blitzball. Called once per sim step for every non-user-controlled player.
 * Writes into p.input (same struct the human uses) so AI and human go through identical rules.
 *
 * Randomised decisions are rolled on a cadence (every 0.25 s) rather than per frame so that
 * probabilities are meaningful and reproducible.
 */

export function updateAI(sim, p, dt) {
  const inp = p.input;
  inp.moveX = 0;
  inp.moveZ = 0;
  inp.turbo = false;
  inp.shootPressed = false;
  inp.shootReleased = false;
  inp.pass = false;
  inp.trick = false;
  inp.hit = false;
  inp.breach = false;
  inp.switchPlayer = false;
  inp.gamebreaker = false;
  const ai = p.ai;
  ai.rollTimer = (ai.rollTimer || 0) - dt;
  const roll = ai.rollTimer <= 0;
  if (roll) ai.rollTimer = 0.25;
  if (p.state === 'fallen' || p.state === 'stumble' || sim.state !== 'live' && sim.state !== 'gamebreaker') return;

  if (p.isKeeper) return keeperAI(sim, p, dt, roll);
  const ball = sim.ball;
  const holder = ball.holder;
  if (holder === p) return carrierAI(sim, p, dt, roll);
  if (holder && holder.team === p.team) return offBallOffenseAI(sim, p, dt, roll);
  if (holder) return defenseAI(sim, p, dt, roll);
  return looseBallAI(sim, p, dt, roll);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function moveToward(p, target, speedScale = 1, turbo = false) {
  const dx = target.x - p.pos.x;
  const dz = target.z - p.pos.z;
  const d = Math.hypot(dx, dz);
  if (d < 0.15) return d;
  const s = Math.min(1, d / 1.2) * speedScale;
  p.input.moveX = (dx / d) * s;
  p.input.moveZ = (dz / d) * s;
  p.input.turbo = turbo && p.turbo > 20;
  return d;
}

function nearestOpponentDist(sim, p, pos = p.pos) {
  let bd = Infinity;
  let best = null;
  for (const q of sim.opponentsOf(p)) {
    if (q.isKeeper || q.state === 'fallen') continue;
    const d = q.pos.distanceToXZ(pos);
    if (d < bd) {
      bd = d;
      best = q;
    }
  }
  return { d: bd, q: best };
}

function shotLaneOpen(sim, p) {
  const g = sim.goalPos(p.team);
  const dir = Vec3.dirXZ(p.pos, g);
  const dist = p.pos.distanceToXZ(g);
  for (const q of sim.opponentsOf(p)) {
    if (q.isKeeper || q.state === 'fallen') continue;
    const rel = Vec3.sub(q.pos, p.pos);
    const along = rel.x * dir.x + rel.z * dir.z;
    if (along < 0.3 || along > dist) continue;
    const perp = Math.abs(rel.x * dir.z - rel.z * dir.x);
    if (perp < 0.9) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Ball carrier
// ---------------------------------------------------------------------------

function carrierAI(sim, p, dt, roll) {
  const ai = p.ai;
  const diff = sim.difficulty;
  const rng = sim.rng;
  const g = sim.goalPos(p.team);
  const dist = p.pos.distanceToXZ(g);
  const near = nearestOpponentDist(sim, p);
  const pressure = near.d < 1.9;
  const clockLow = sim.possessionClock < 4.5;
  const laneOpen = shotLaneOpen(sim, p);

  // Gamebreaker
  if (roll && sim.gbReady[p.team] && sim.state === 'live' && dist < 11 && rng.chance(0.5 * diff.aiGbRate)) {
    p.input.gamebreaker = true;
    return;
  }

  // Shooting: keep the shot logic on the timing window like a human would.
  if (p.state === 'shoot' && p.shot && !p.shot.released) {
    const u = p.stateTime / p.shot.wind;
    const target = ai.releaseAt || 0.77;
    if (u >= target) p.input.shootReleased = true;
    return;
  }

  const inRange = dist < ACTION.shotMaxRange - 3;
  const goodRange = dist < 6.5;
  let shootDesire = 0;
  if (inRange) {
    shootDesire = goodRange ? 0.14 : 0.04;
    if (laneOpen) shootDesire += goodRange ? 0.14 : 0.05;
    if (pressure) shootDesire += 0.1;
    if (clockLow) shootDesire += 0.6;
    if (sim.momentum[p.team] >= 2) shootDesire += 0.12;
    shootDesire *= 0.6 + (p.data.sht / 99) * 0.6;
  } else if (clockLow && dist < ACTION.shotMaxRange) shootDesire = 0.9;

  if (roll && rng.chance(clamp(shootDesire, 0, 0.95))) {
    p.input.shootPressed = true;
    // timing skill: better shooters release closer to perfect
    const skill = (p.data.sht / 99) * diff.shotAccuracy;
    ai.releaseAt = 0.77 + (rng.next() - 0.5) * (0.5 - skill * 0.36);
    return;
  }

  // Passing
  let passDesire = 0;
  const mates = sim.teammatesOf(p).filter((q) => !q.isKeeper && q.state !== 'fallen');
  let bestMate = null;
  let bestScore = -Infinity;
  for (const q of mates) {
    const qd = q.pos.distanceToXZ(g);
    const open = nearestOpponentDist(sim, q).d;
    let s = (dist - qd) * 0.9 + Math.min(open, 4) * 1.2;
    if (q.ai.cutting) s += 3;
    if (qd < 6 && open > 2) s += 3;
    if (s > bestScore) {
      bestScore = s;
      bestMate = q;
    }
  }
  if (bestMate) {
    passDesire = 0.08 + clamp(bestScore / 12, 0, 0.6) * (0.5 + (p.data.pas / 99) * 0.6);
    if (pressure) passDesire += 0.25;
    if (p.isKeeper) passDesire = 0.9;
    if (near.d < 1.2 && near.q && near.q.state === 'tackle') passDesire += 0.3;
  }
  if (roll && bestMate && rng.chance(clamp(passDesire, 0, 0.85))) {
    // Lob into the strike zone when the target is near the goal and not marked closely.
    const lob = bestMate.pos.distanceToXZ(g) < 7 && (nearestOpponentDist(sim, bestMate).d > 1.2 || bestMate.ai.cutting) && rng.chance(0.6);
    p.input.pass = true;
    p.input.turbo = lob;
    // steer the pass selection toward that mate
    const d = Vec3.dirXZ(p.pos, bestMate.pos);
    p.input.moveX = d.x;
    p.input.moveZ = d.z;
    return;
  }

  // Tricks: when a defender is closing in front of us
  if (roll && near.q && near.d < 2.4 && p.cd.trick <= 0) {
    const toDef = Vec3.dirXZ(p.pos, near.q.pos);
    const toGoal = Vec3.dirXZ(p.pos, g);
    const inFront = toDef.dot(toGoal) > 0.3;
    let trickDesire = inFront ? 0.28 : 0.08;
    trickDesire *= 0.5 + (p.data.hnd / 99) * 0.8;
    if (near.q.state === 'tackle') trickDesire += 0.3;
    if (rng.chance(clamp(trickDesire, 0, 0.8))) {
      p.input.trick = true;
      // side-step direction: perpendicular to the defender, biased toward goal
      const side = (toDef.x * toGoal.z - toDef.z * toGoal.x) > 0 ? -1 : 1;
      const perp = new Vec3(-toGoal.z * side, 0, toGoal.x * side);
      const dir = new Vec3(toGoal.x * 0.7 + perp.x, 0, toGoal.z * 0.7 + perp.z).normalize();
      p.input.moveX = dir.x;
      p.input.moveZ = dir.z;
      p.input.turbo = p.turbo > 40 && rng.chance(0.55 * diff.aiTurbo);
      return;
    }
  }

  // Hit a defender who is right on us (strong players)
  if (roll && near.q && near.d < ACTION.hitRange && p.data.pow > 70 && p.cd.hit <= 0 && rng.chance(0.12 * diff.hitRate)) {
    p.input.hit = true;
    return;
  }

  // Drive: toward the goal, arcing around the nearest defender.
  let target = new Vec3(g.x - sim.attackDir(p.team) * 2.0, 0, 0);
  if (near.q && near.d < 3.5) {
    const toDef = Vec3.dirXZ(p.pos, near.q.pos);
    const toGoal = Vec3.dirXZ(p.pos, g);
    if (toDef.dot(toGoal) > 0.2) {
      ai.driveSide = ai.driveSide || (rng.chance(0.5) ? 1 : -1);
      const perp = new Vec3(-toGoal.z * ai.driveSide, 0, toGoal.x * ai.driveSide);
      target = new Vec3(p.pos.x + toGoal.x * 2 + perp.x * 3, 0, p.pos.z + toGoal.z * 2 + perp.z * 3);
    }
  } else ai.driveSide = null;
  // Don't hug the wall
  if (target.lengthXZ() > ARENA.fieldRadius - 1) target.scale((ARENA.fieldRadius - 1) / target.lengthXZ());
  const wantTurbo = p.turbo > 35 && (near.d > 2.5 || sim.momentum[p.team] >= 2) && rng.next() < diff.aiTurbo;
  moveToward(p, target, 1, wantTurbo);
}

// ---------------------------------------------------------------------------
// Offense, off the ball
// ---------------------------------------------------------------------------

function offBallOffenseAI(sim, p, dt, roll) {
  const ai = p.ai;
  const g = sim.goalPos(p.team);
  const dir = sim.attackDir(p.team);
  const holder = sim.ball.holder;
  const rng = sim.rng;
  // Lob incoming? Get under it.
  if (ai.oop && sim.ball.flight && sim.ball.flight.kind === 'lob' && sim.ball.flight.target === p) {
    const to = sim.ball.flight.to;
    moveToward(p, new Vec3(to.x, 0, to.z), 1, true);
    if (p.pos.distanceToXZ(to) < 1.0 && sim.ball.flight.t / sim.ball.flight.dur > 0.6 && p.cd.breach <= 0) p.input.breach = true;
    return;
  }
  if (ai.cutTimer > 0) {
    ai.cutTimer -= dt;
    if (ai.cutTimer <= 0) ai.cutting = false;
  }
  // Spacing: two lanes (wide left / wide right) and a spot near the crease.
  const slotIdx = (p.slot + (holder.slot || 0)) % 3;
  const spots = [
    new Vec3(g.x - dir * 4.5, 0, 4.0),
    new Vec3(g.x - dir * 4.5, 0, -4.0),
    new Vec3(g.x - dir * 7.5, 0, 0),
  ];
  let spot = spots[slotIdx];
  if (ai.cutting) spot = new Vec3(g.x - dir * 3.2, 0, (p.pos.z > 0 ? 1 : -1) * 1.6);
  // Occasional cut to the crease
  if (roll && !ai.cutting && holder.pos.distanceToXZ(g) < 9 && rng.chance(0.12)) {
    ai.cutting = true;
    ai.cutTimer = 1.5;
  }
  // Stay behind the ball line a bit if the carrier is far back (support)
  if ((holder.pos.x - p.pos.x) * dir < -6) spot = new Vec3(holder.pos.x + dir * 2.5, 0, p.pos.z);
  moveToward(p, spot, 0.95, ai.cutting && p.turbo > 30);
  // Defender in our face while we're a cutter: hit them
  if (roll && p.data.pow > 78 && p.cd.hit <= 0) {
    const near = nearestOpponentDist(sim, p);
    if (near.d < ACTION.hitRange && rng.chance(0.1 * sim.difficulty.hitRate)) p.input.hit = true;
  }
}

// ---------------------------------------------------------------------------
// Defense
// ---------------------------------------------------------------------------

function defenseAI(sim, p, dt, roll) {
  const ai = p.ai;
  const diff = sim.difficulty;
  const rng = sim.rng;
  const holder = sim.ball.holder;
  const ownGoal = sim.ownGoalPos(p.team);
  const dir = sim.attackDir(p.team);
  const mates = sim.outfield(p.team);
  // Assign: closest to carrier presses; others mark the remaining attackers / protect crease.
  const byDist = [...mates].sort((a, b) => a.pos.distanceToXZ(holder.pos) - b.pos.distanceToXZ(holder.pos));
  const presser = byDist[0];
  const attackers = sim.outfield(1 - p.team).filter((q) => q !== holder);
  const reaction = diff.aiReaction;

  if (p === presser) {
    const dHolder = p.pos.distanceToXZ(holder.pos);
    // Get goal-side of the carrier
    const toGoal = Vec3.dirXZ(holder.pos, ownGoal);
    const cushion = holder.state === 'trick' ? 1.6 : 1.0;
    const target = new Vec3(holder.pos.x + toGoal.x * cushion, 0, holder.pos.z + toGoal.z * cushion);
    moveToward(p, target, 1, dHolder > 3 && p.turbo > 25 && rng.next() < diff.aiTurbo);
    if (roll) {
      // Tackle attempt
      if (dHolder < ACTION.tackleRange + 0.1 && p.cd.tackle <= 0 && !holder.airborne) {
        let pTackle = 0.1 + diff.tackleRate * 0.12;
        if (holder.state === 'idle' && holder.stateTime > 0.8) pTackle *= 1.8;
        if (holder.state === 'trick') pTackle *= 0.35;
        if (holder.state === 'shoot') pTackle *= 1.5;
        if (p.data.tkl > 80) pTackle *= 1.4;
        if (rng.chance(clamp(pTackle, 0, 0.45))) p.input.trick = true;
      }
      // Big hit
      if (!p.input.trick && dHolder < ACTION.hitRange && p.cd.hit <= 0 && p.data.pow > 68 && rng.chance((0.06 + (p.data.pow - 68) / 250) * diff.hitRate)) p.input.hit = true;
      // Block a shot wind-up by breaching
      if (holder.state === 'shoot' && holder.shot && !holder.shot.released && dHolder < 2.2 && p.cd.breach <= 0 && rng.chance(0.35 * reaction)) p.input.breach = true;
    }
    return;
  }

  // Shot in flight toward our goal: nearby defenders breach to block
  const f = sim.ball.flight;
  if (f && f.kind === 'shot' && f.shooter.team !== p.team) {
    const d = p.pos.distanceToXZ(sim.ball.pos);
    if (d < 1.8 && p.cd.breach <= 0 && roll && rng.chance(0.5 * reaction)) p.input.breach = true;
  }

  // Marking
  const idx = byDist.indexOf(p) - 1;
  const mark = attackers.sort((a, b) => a.pos.distanceToXZ(ownGoal) - b.pos.distanceToXZ(ownGoal))[idx] || attackers[0];
  if (mark) {
    const toGoal = Vec3.dirXZ(mark.pos, ownGoal);
    const target = new Vec3(mark.pos.x + toGoal.x * 1.2, 0, mark.pos.z + toGoal.z * 1.2);
    // Pass lane awareness: if a pass is coming to our mark, step into it
    if (f && f.kind === 'pass' && f.target === mark && sim.ball.pos.distanceToXZ(p.pos) < 1.6 && p.cd.tackle <= 0 && roll && rng.chance(0.4 * diff.tackleRate)) p.input.trick = true;
    moveToward(p, target, 0.95, false);
  } else {
    // Protect the crease
    moveToward(p, new Vec3(ownGoal.x + dir * 3.5, 0, 0), 0.9, false);
  }
}

// ---------------------------------------------------------------------------
// Loose ball
// ---------------------------------------------------------------------------

function looseBallAI(sim, p, dt, roll) {
  const b = sim.ball;
  const f = b.flight;
  const rng = sim.rng;
  // Is a pass to me in flight?
  if (f && (f.kind === 'pass' || f.kind === 'lob')) {
    if (f.target === p) {
      moveToward(p, new Vec3(f.to.x, 0, f.to.z), 1, false);
      if (f.kind === 'lob' && f.t / f.dur > 0.55 && p.pos.distanceToXZ(f.to) < 1.2 && p.cd.breach <= 0) p.input.breach = true;
      return;
    }
    if (f.passer.team !== p.team) {
      // Jump the lane if I'm close
      const d = p.pos.distanceToXZ(b.pos);
      if (d < 1.6 && p.cd.tackle <= 0 && roll && p.ai.lungedFor !== f && rng.chance(0.4 * sim.difficulty.tackleRate)) {
        p.ai.lungedFor = f;
        p.input.trick = true;
      }
      // otherwise fall back into defensive shape
      const ownGoal = sim.ownGoalPos(p.team);
      const mid = new Vec3((f.to.x + ownGoal.x) / 2, 0, f.to.z * 0.5);
      moveToward(p, mid, 0.9, false);
      return;
    }
    // Teammate's pass to someone else: get open
    const g = sim.goalPos(p.team);
    moveToward(p, new Vec3(g.x - sim.attackDir(p.team) * 5, 0, p.pos.z > 0 ? 3.5 : -3.5), 0.8, false);
    return;
  }
  // Shot in flight (either team): attackers crash for rebounds, defenders try to block
  if (f && f.kind === 'shot') {
    const mine = f.shooter.team === p.team;
    if (!mine) {
      const d = p.pos.distanceToXZ(b.pos);
      if (d < 
