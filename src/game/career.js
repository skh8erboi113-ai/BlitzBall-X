import { TEAMS, teamOverall } from '../data/teams.js';
import { RNG } from '../core/rng.js';

/**
 * "Run The Pools" career: pick a crew, beat every other crew in their home sphere
 * in a ladder ordered by strength, earn Rep, unlock the Legend difficulty at the end.
 * Serialisable to JSON for localStorage.
 */
export function createCareer(teamId, difficulty = 'pro') {
  const ladder = TEAMS.filter((t) => t.id !== teamId)
    .sort((a, b) => teamOverall(a) - teamOverall(b))
    .map((t) => t.id);
  return {
    teamId,
    difficulty,
    ladder,
    stage: 0,
    rep: 0,
    wins: 0,
    losses: 0,
    history: [],
    complete: false,
    seed: Math.floor(Math.random() * 1e9),
  };
}

export function currentOpponent(career) {
  if (career.complete) return null;
  return TEAMS.find((t) => t.id === career.ladder[career.stage]) || null;
}

export function recordResult(career, result) {
  const { won, score, style, margin } = result;
  career.history.push({ opponent: career.ladder[career.stage], won, score, style });
  if (won) {
    career.wins++;
    career.rep += 100 + Math.max(0, margin) * 10 + Math.round(style / 20);
    career.stage++;
    if (career.stage >= career.ladder.length) career.complete = true;
  } else {
    career.losses++;
    career.rep += Math.round(style / 40);
  }
  return career;
}

export function careerTitle(career) {
  const r = career.rep;
  if (career.complete) return 'BLITZ LEGEND';
  if (r >= 1200) return 'KING OF THE POOL';
  if (r >= 800) return 'PROBLEM';
  if (r >= 450) return 'BLITZER';
  if (r >= 200) return 'REGULAR';
  return 'ROOKIE';
}

/** Quick AI-vs-AI result for simulated ladder games (not used by the player path). */
export function simQuick(homeId, awayId, seed) {
  const rng = new RNG(seed);
  const h = teamOverall(TEAMS.find((t) => t.id === homeId));
  const a = teamOverall(TEAMS.find((t) => t.id === awayId));
  let hs = 0;
  let as = 0;
  // ~12 goals a match on average, split by rating gap; no draws.
  const goals = rng.int(8, 16);
  for (let i = 0; i < goals; i++) {
    const pH = 0.5 + (h - a) / 200;
    if (rng.chance(pH)) hs += 1;
    else as += 1;
  }
  if (hs === as) {
    if (rng.chance(0.5 + (h - a) / 200)) hs++;
    else as++;
  }
  return [hs, as];
}
