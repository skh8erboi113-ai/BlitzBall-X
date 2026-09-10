import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MatchSim, TRICKS } from '../src/game/match.js';
import { TEAMS, TEAM_BY_ID, playerOverall, teamOverall, starters } from '../src/data/teams.js';
import { RULES, DIFFICULTY, ARENA } from '../src/data/constants.js';
import { emptyInput } from '../src/game/entities.js';
import { createCareer, currentOpponent, recordResult, careerTitle } from '../src/game/career.js';
import { RNG } from '../src/core/rng.js';

const DT = 1 / 60;

function runGame(seed, opts = {}) {
  const sim = new MatchSim({ home: TEAMS[opts.home ?? 0], away: TEAMS[opts.away ?? 1], difficulty: opts.difficulty || 'pro', seed, userTeam: opts.userTeam ?? null });
  const events = {};
  sim.events.on('*', (name) => (events[name] = (events[name] || 0) + 1));
  let steps = 0;
  while (sim.state !== 'over' && steps < 60 * 60 * 30) {
    if (opts.onStep) opts.onStep(sim, steps);
    sim.step(DT);
    steps++;
  }
  return { sim, events, steps };
}

test('data integrity: 8 crews, 6-player rosters with one keeper, required fields', () => {
  assert.equal(TEAMS.length, 8);
  const ids = new Set();
  for (const t of TEAMS) {
    assert.ok(t.id && t.city && t.name && t.abbr && t.primary && t.secondary && t.accent && t.motto && t.arena, t.id);
    assert.equal(TEAM_BY_ID[t.id], t);
    assert.equal(t.roster.length, 6);
    assert.equal(t.roster.filter((p) => p.role === 'GK').length, 1);
    for (const p of t.roster) {
      assert.ok(!ids.has(p.id), `duplicate player id ${p.id}`);
      ids.add(p.id);
      assert.ok(p.id && p.name && p.nick && p.archetype && p.signature && p.role, `${t.id} ${p.id}`);
      assert.ok(Number.isInteger(p.number));
      for (const k of ['spd', 'sht', 'hnd', 'pas', 'tkl', 'pow', 'end', 'gb', 'cat', 'blk']) assert.ok(p[k] >= 40 && p[k] <= 99, `${p.id}.${k}`);
      const ovr = playerOverall(p);
      assert.ok(ovr >= 40 && ovr <= 99, `${p.id} ovr ${ovr}`);
    }
    const s = starters(t);
    assert.equal(s.length, 4);
    assert.equal(s[3].role, 'GK');
    const ovr = teamOverall(t);
    assert.ok(ovr >= 50 && ovr <= 99);
  }
  for (const k of ['rookie', 'pro', 'legend']) assert.ok(DIFFICULTY[k] && DIFFICULTY[k].label);
  assert.ok(TRICKS.length >= 4);
});

test('RNG is deterministic', () => {
  const a = new RNG(1234);
  const b = new RNG(1234);
  for (let i = 0; i < 100; i++) assert.equal(a.next(), b.next());
});

test('CPU vs CPU matches finish with a valid winner (multiple seeds/difficulties)', () => {
  const seeds = [1, 2, 3, 7, 42, 99];
  for (const d of ['rookie', 'pro', 'legend']) {
    for (const seed of seeds) {
      const { sim, events } = runGame(seed, { difficulty: d, home: seed % 8, away: (seed + 3) % 8 });
      assert.equal(sim.state, 'over', `seed ${seed} ${d} did not finish`);
      const [h, a] = sim.score;
      const w = sim.winner;
      assert.ok(w === 0 || w === 1);
      assert.notEqual(h, a, 'no draws');
      assert.equal(w, h > a ? 0 : 1);
      assert.ok(h >= 0 && a >= 0);
      assert.ok(events.gameover === 1);
      assert.ok(events.shot > 5, 'shots happened');
      assert.ok(events.halftime === 1 || Math.abs(h - a) >= RULES.mercyLead || sim.overtime || sim.half === 2, 'halftime happened');
      // Either the clock ran out (both halves played) or the mercy rule ended it in the 2nd half.
      assert.ok(sim.half === 2 || sim.overtime, `ended in half ${sim.half}`);
      if (!sim.overtime && Math.abs(h - a) < RULES.mercyLead) assert.ok(sim.clock <= 0.02, 'clock expired at full time');
    }
  }
});

test('matches are deterministic for a given seed', () => {
  const a = runGame(555, { home: 2, away: 5 });
  const b = runGame(555, { home: 2, away: 5 });
  assert.deepEqual(a.sim.score, b.sim.score);
  assert.equal(a.steps, b.steps);
  assert.deepEqual(a.sim.snapshot(), b.sim.snapshot());
});

test('scores land in an arcade-friendly range across many seeds', () => {
  let total = 0;
  let n = 0;
  let maxGoals = 0;
  for (let seed = 100; seed < 112; seed++) {
    const { sim } = runGame(seed, { home: seed % 8, away: (seed * 5 + 1) % 8 });
    total += sim.score[0] + sim.score[1];
    maxGoals = Math.max(maxGoals, sim.score[0], sim.score[1]);
    n++;
  }
  const avg = total / n;
  assert.ok(avg >= 6 && avg <= 30, `avg total goals ${avg}`);
  assert.ok(maxGoals <= 40);
});

test('all Blitzball mechanics fire over a set of matches', () => {
  const agg = {};
  for (let seed = 200; seed < 208; seed++) {
    const { events } = runGame(seed, { home: seed % 8, away: (seed + 1) % 8 });
    for (const k in events) agg[k] = (agg[k] || 0) + events[k];
  }
  for (const k of ['shot', 'score', 'save', 'pass', 'trick', 'tackle', 'bighit', 'washed', 'block', 'breach', 'style', 'gbready', 'gamebreaker', 'gbshot', 'alleyoop', 'volleyshot', 'knockdown', 'heating', 'miss', 'halftime']) {
    assert.ok(agg[k] > 0, `event ${k} never fired`);
  }
});

test('players and ball stay inside the arena; no NaNs', () => {
  const { sim } = runGame(31, {
    home: 3,
    away: 6,
    onStep: (s) => {
      for (const p of s.players) {
        assert.ok(p.pos.isFinite() && Number.isFinite(p.y), 'player finite');
        assert.ok(p.pos.lengthXZ() <= ARENA.fieldRadius + 0.05, `player outside field ${p.pos.lengthXZ()}`);
        if (p.isKeeper) assert.ok(Math.abs(p.pos.x) >= ARENA.keeperMinX - 0.05 && Math.abs(p.pos.x) <= ARENA.keeperMaxX + 0.05, 'keeper in box');
      }
      assert.ok(s.ball.pos.isFinite(), 'ball finite');
      assert.ok(s.ball.pos.lengthXZ() <= ARENA.ballRadius + 0.5, 'ball inside sphere');
      assert.ok(s.ball.pos.y <= ARENA.ceilingY + 0.5 && s.ball.pos.y >= ARENA.floorY - 0.5, 'ball vertical bounds');
    },
  });
  assert.equal(sim.state, 'over');
});

test('gamebreaker goal scores 2 and steals 1; a ready meter survives turnovers', () => {
  const sim = new MatchSim({ home: TEAMS[0], away: TEAMS[1], difficulty: 'pro', seed: 5, userTeam: null });
  // fast-forward to live
  while (sim.state !== 'live') sim.step(DT);
  sim.score[1] = 3;
  sim.gb[0] = sim.rules.gamebreakerMeterMax;
  sim.gbReady[0] = true;
  sim.loseStyle(0, 500);
  assert.equal(sim.gb[0], sim.rules.gamebreakerMeterMax, 'ready meter is safe');
  const p = sim.outfield(0)[0];
  sim.giveBall(p);
  p.pos.set(4, 0, 0);
  const ok = sim.tryGamebreaker(p);
  assert.ok(ok);
  assert.equal(sim.state, 'gamebreaker');
  let scored = null;
  sim.events.on('score', (e) => (scored = e));
  let n = 0;
  while (!scored && n++ < 60 * 12) sim.step(DT);
  assert.ok(scored, 'gamebreaker resulted in a goal');
  assert.equal(scored.gb, true);
  assert.equal(scored.points, RULES.gbPoints);
  assert.equal(scored.stolen, RULES.gbSteal);
  assert.deepEqual(sim.score, [2, 2]);
});

test('possession clock turns the ball over when the carrier stalls', () => {
  const sim = new MatchSim({ home: TEAMS[0], away: TEAMS[1], difficulty: 'pro', seed: 9, userTeam: 0 });
  while (sim.state !== 'live') sim.step(DT);
  // Make sure the user team has the ball, then feed no input with the clock nearly expired.
  const p = sim.outfield(0)[0];
  sim.giveBall(p);
  sim.setUserInput(emptyInput());
  sim.possessionClock = 0.5;
  let turnover = null;
  sim.events.on('shotclock', (e) => (turnover = e));
  let n = 0;
  while (!turnover && n++ < 60 * 2) sim.step(DT);
  assert.ok(turnover, 'possession clock fired');
  assert.equal(turnover.team, 0);
  assert.equal(sim.state, 'dead');
  assert.equal(sim.pendingPossession, 1);
  // ...and play resumes with the other team.
  while (sim.state !== 'live' && n++ < 60 * 6) sim.step(DT);
  assert.equal(sim.state, 'live');
  assert.equal(sim.possession, 1);
});

test('user-controlled team with random input finishes without errors', () => {
  const sim = new MatchSim({ home: TEAMS[4], away: TEAMS[7], difficulty: 'legend', seed: 77, userTeam: 1 });
  const rng = new RNG(3);
  let steps = 0;
  while (sim.state !== 'over' && steps < 60 * 60 * 30) {
    if (steps % 5 === 0) {
      sim.setUserInput({
        moveX: rng.range(-1, 1),
        moveZ: rng.range(-1, 1),
        turbo: rng.chance(0.4),
        shoot: false,
        shootPressed: rng.chance(0.05),
        shootReleased: rng.chance(0.05),
        pass: rng.chance(0.03),
        trick: rng.chance(0.05),
        hit: rng.chance(0.03),
        breach: rng.chance(0.03),
        switchPlayer: rng.chance(0.01),
        gamebreaker: rng.chance(0.02),
      });
    }
    sim.step(DT);
    steps++;
  }
  assert.equal(sim.state, 'over');
  assert.ok(sim.controlled && sim.controlled.team === 1);
});

test('halftime swaps kickoff and the second half plays out', () => {
  const sim = new MatchSim({ home: TEAMS[1], away: TEAMS[2], difficulty: 'rookie', seed: 12, userTeam: null });
  const kickoff = sim.kickoffTeam;
  let secondKick = null;
  sim.events.on('reset', ({ team, reason }) => {
    if (reason === 'halftime') secondKick = team;
  });
  let n = 0;
  while (sim.half === 1 && n++ < 60 * 400) sim.step(DT);
  assert.equal(sim.half, 2);
  assert.equal(secondKick, 1 - kickoff);
});

test('career ladder progresses on wins and tracks rep', () => {
  const c = createCareer(TEAMS[0].id, 'pro');
  assert.equal(c.ladder.length, 7);
  assert.ok(!c.ladder.includes(TEAMS[0].id));
  const first = currentOpponent(c);
  recordResult(c, { won: false, score: [3, 7], style: 900, margin: -4 });
  assert.equal(currentOpponent(c), first, 'loss does not advance');
  assert.equal(c.losses, 1);
  for (let i = 0; i < 7; i++) recordResult(c, { won: true, score: [9, 4], style: 2000, margin: 5 });
  assert.ok(c.complete);
  assert.equal(careerTitle(c), 'BLITZ LEGEND');
  assert.ok(c.rep > 0);
});

test('keeper must release the ball within the hold limit', () => {
  const sim = new MatchSim({ home: TEAMS[0], away: TEAMS[1], difficulty: 'pro', seed: 21, userTeam: null });
  while (sim.state !== 'live') sim.step(DT);
  const gk = sim.keeperOf(0);
  sim.giveBall(gk);
  let released = false;
  sim.events.on('pass', ({ from }) => {
    if (from === gk) released = true;
  });
  let n = 0;
  while (!released && n++ < 60 * (RULES.keeperHold + 2)) sim.step(DT);
  assert.ok(released, 'keeper distributed the ball');
});

test('keepers dive vertically inside their box and never leave the pool', () => {
  const sim = new MatchSim({ home: TEAMS[0], away: TEAMS[1], difficulty: 'pro', seed: 4242, userTeam: null });
  while (sim.state !== 'live') sim.step(DT);
  const shooter = sim.outfield(0)[0];
  const gk = sim.keeperOf(1);
  // Wound up a shot by hand so the flight is known: hard, high, straight at the ring.
  sim.giveBall(shooter);
  shooter.pos.set(6, 0, 0.4);
  sim.ball.holder = null;
  shooter.hasBall = false;
  sim.ball.pos.set(6, 0.9, 0.4);
  sim.ball.vel.set(20, 3.4, 0);
  sim.ball.flight = { kind: 'shot', shooter, gb: false, volley: false, quality: 1, dist: 5.6, t: 0, checked: new Set(), name: 'TEST' };
  let minY = Infinity;
  let maxY = -Infinity;
  let maxZ = 0;
  for (let i = 0; i < 90 && sim.ball.flight?.kind === 'shot'; i++) {
    sim.step(DT);
    minY = Math.min(minY, gk.y);
    maxY = Math.max(maxY, gk.y);
    maxZ = Math.max(maxZ, Math.abs(gk.pos.z));
    assert.ok(gk.y >= ARENA.keeperMinY - 1e-6 && gk.y <= ARENA.keeperMaxY + 1e-6, `keeper y ${gk.y} in box`);
    assert.ok(Math.abs(gk.pos.x) >= ARENA.keeperMinX - 0.05 && Math.abs(gk.pos.x) <= ARENA.keeperMaxX + 0.05, 'keeper x in box');
    assert.ok(maxZ <= ARENA.keeperMaxZ + 1e-6, `keeper z ${gk.pos.z} in box`);
    assert.ok(gk.pos.isFinite() && Number.isFinite(gk.y), 'keeper finite');
  }
  assert.ok(maxY - minY > 0.05, `keeper dived vertically (range ${(maxY - minY).toFixed(3)})`);
});
