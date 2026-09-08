import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MatchSim } from '../src/game/match.js';
import { TEAMS, TEAM_BY_ID, playerOverall, teamOverall } from '../src/data/teams.js';
import { RULES, DIFFICULTY } from '../src/data/constants.js';
import { emptyInput } from '../src/game/entities.js';
import { createCareer, currentOpponent, recordResult, careerTitle } from '../src/game/career.js';
import { RNG } from '../src/core/rng.js';

const DT = 1 / 60;

function runGame(seed, opts = {}) {
  const sim = new MatchSim({ home: TEAMS[opts.home ?? 0], away: TEAMS[opts.away ?? 1], difficulty: opts.difficulty || 'pro', seed, userTeam: null });
  const events = {};
  sim.events.on('*', (name) => (events[name] = (events[name] || 0) + 1));
  let steps = 0;
  while (sim.state !== 'over' && steps < 60 * 60 * 30) {
    sim.step(DT);
    steps++;
  }
  return { sim, events, steps };
}

test('data integrity: 8 teams, 4-player rosters, required fields', () => {
  assert.equal(TEAMS.length, 8);
  for (const t of TEAMS) {
    assert.ok(t.id && t.city && t.name && t.abbr && t.primary && t.secondary && t.accent && t.motto, t.id);
    assert.equal(TEAM_BY_ID[t.id], t);
    assert.equal(t.roster.length, 4);
    for (const p of t.roster) {
      assert.ok(p.id && p.name && p.nick && p.archetype && p.signature, `${t.id} ${p.id}`);
      assert.ok(Number.isInteger(p.number));
      const ovr = playerOverall(p);
      assert.ok(ovr >= 40 && ovr <= 99, `${p.id} ovr ${ovr}`);
    }
    const ovr = teamOverall(t);
    assert.ok(ovr >= 50 && ovr <= 99);
  }
  for (const k of ['rookie', 'pro', 'legend']) assert.ok(DIFFICULTY[k] && DIFFICULTY[k].label);
});

test('RNG is deterministic', () => {
  const a = new RNG(1234);
  const b = new RNG(1234);
  for (let i = 0; i < 100; i++) assert.equal(a.next(), b.next());
});

test('CPU vs CPU games finish with a valid winner (multiple seeds/difficulties)', () => {
  const seeds = [1, 2, 3, 7, 42, 99];
  for (const d of ['rookie', 'pro', 'legend']) {
    for (const seed of seeds) {
      const { sim, events } = runGame(seed, { difficulty: d, home: seed % 8, away: (seed + 3) % 8 });
      assert.equal(sim.state, 'over', `seed ${seed} ${d} did not finish`);
      const [h, a] = sim.score;
      const w = sim.winner;
      assert.ok(w === 0 || w === 1);
      assert.ok(Math.max(h, a) >= RULES.targetScore, `score ${h}-${a}`);
      assert.ok(Math.max(h, a) <= RULES.scoreCap);
      assert.ok(Math.max(h, a) - Math.min(h, a) >= RULES.winBy || Math.max(h, a) >= RULES.scoreCap, `win margin ${h}-${a}`);
      assert.equal(w, h > a ? 0 : 1);
      assert.ok(events.score > 0);
      assert.ok(events.shot > 0);
      assert.ok(events.gameover === 1, `gameover emitted ${events.gameover}`);
    }
  }
});

test('simulation is deterministic for a given seed', () => {
  const a = runGame(555);
  const b = runGame(555);
  assert.deepEqual(a.sim.score, b.sim.score);
  assert.equal(a.steps, b.steps);
  assert.deepEqual(a.sim.snapshot(), b.sim.snapshot());
});

test('box score is internally consistent', () => {
  const sim = new MatchSim({ home: TEAMS[0], away: TEAMS[1], difficulty: 'pro', seed: 31, userTeam: null });
  const stolenFrom = [0, 0];
  sim.events.on('score', ({ team, stolen }) => (stolenFrom[1 - team] += stolen));
  let steps = 0;
  while (sim.state !== 'over' && steps++ < 60 * 60 * 30) sim.step(DT);
  assert.equal(sim.state, 'over');
  for (const t of [0, 1]) {
    // Team score = points scored by its players minus points stolen by opposing Gamebreakers.
    const pts = sim.teamPlayers(t).reduce((s, p) => s + p.stats.pts, 0);
    assert.equal(pts - stolenFrom[t], sim.score[t], `team ${t} pts`);
    for (const p of sim.teamPlayers(t)) {
      assert.ok(p.stats.fgm <= p.stats.fga, `${p.id} fgm<=fga`);
      assert.ok(p.stats.style >= 0);
      for (const k of ['pts', 'fgm', 'fga', 'dunks', 'ast', 'stl', 'blk', 'ankles', 'style', 'gb']) assert.ok(Number.isFinite(p.stats[k]), `${p.id}.${k}`);
    }
  }
});

test('gamebreaker meter fills, can be used and is consumed', () => {
  let gbCount = 0;
  let sawReady = false;
  for (const seed of [11, 12, 13, 14, 15, 16]) {
    const { sim, events } = runGame(seed, { difficulty: 'legend' });
    if (events.gbready) sawReady = true;
    gbCount += events.gamebreaker || 0;
    assert.ok(sim.gb[0] <= sim.rules.gamebreakerMeterMax && sim.gb[1] <= sim.rules.gamebreakerMeterMax);
  }
  assert.ok(sawReady, 'no team ever filled the gamebreaker meter');
  assert.ok(gbCount > 0, 'no gamebreaker was ever used');
});

test('user-controlled player responds to input: move, turbo drain, shoot, score', () => {
  const sim = new MatchSim({ home: TEAMS[0], away: TEAMS[1], difficulty: 'rookie', seed: 7, userTeam: 0 });
  const inp = emptyInput();
  sim.setUserInput(inp);
  while (sim.state !== 'live') sim.step(DT);
  const p = sim.controlled;
  assert.ok(p && p.team === 0);
  assert.equal(sim.ball.holder, p, 'user team starts with the ball');
  let scored = false;
  sim.events.on('score', ({ player }) => player.team === 0 && (scored = true));
  const startZ = p.pos.z;
  for (let i = 0; i < 90; i++) {
    const dx = 0 - p.pos.x;
    const dz = -5.9 - p.pos.z;
    const l = Math.hypot(dx, dz) || 1;
    inp.moveX = dx / l;
    inp.moveZ = dz / l;
    inp.turbo = true;
    sim.step(DT);
  }
  assert.ok(p.pos.z < startZ - 2, 'player moved toward the rim');
  assert.ok(p.turbo < 100, 'turbo drained');
  inp.moveX = 0;
  inp.moveZ = 0;
  inp.turbo = false;
  inp.shootPressed = true;
  inp.shoot = true;
  sim.step(DT);
  inp.shootPressed = false;
  for (let i = 0; i < 20; i++) sim.step(DT);
  inp.shootReleased = true;
  inp.shoot = false;
  sim.step(DT);
  inp.shootReleased = false;
  assert.ok(['shoot', 'dunk', 'layup'].includes(p.state) || sim.ball.flight || scored, `shot attempted (state=${p.state})`);
  for (let i = 0; i < 600 && !scored; i++) sim.step(DT);
  assert.ok(scored, 'a shot from under the rim eventually scores');
});

test('player switching cycles through teammates', () => {
  const sim = new MatchSim({ home: TEAMS[2], away: TEAMS[3], difficulty: 'pro', seed: 3, userTeam: 1 });
  const inp = emptyInput();
  sim.setUserInput(inp);
  while (sim.state !== 'live') sim.step(DT);
  // Make sure the user's team is on defense so switching is allowed.
  const first = sim.controlled;
  inp.switchPlayer = true;
  sim.step(DT);
  inp.switchPlayer = false;
  sim.step(DT);
  assert.ok(sim.controlled.team === 1);
  if (sim.ball.holder !== first) assert.notEqual(sim.controlled, first, 'controlled player changed');
});

test('career ladder: create, progress, complete', () => {
  const c = createCareer('dockside_kraken', 'pro');
  assert.equal(c.ladder.length, 7);
  assert.ok(!c.ladder.includes('dockside_kraken'));
  assert.ok(currentOpponent(c));
  const overalls = c.ladder.map((id) => teamOverall(TEAM_BY_ID[id]));
  for (let i = 1; i < overalls.length; i++) assert.ok(overalls[i] >= overalls[i - 1], 'ladder sorted weakest first');
  recordResult(c, { won: false, score: [15, 21], style: 500, margin: -6 });
  assert.equal(c.stage, 0);
  assert.equal(c.losses, 1);
  for (let i = 0; i < 7; i++) recordResult(c, { won: true, score: [21, 10], style: 1000, margin: 11 });
  assert.ok(c.complete);
  assert.equal(currentOpponent(c), null);
  assert.ok(c.rep > 700);
  assert.ok(typeof careerTitle(c) === 'string' && careerTitle(c).length > 0);
});
