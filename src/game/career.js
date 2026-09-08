import { TEAMS, teamOverall } from '../data/teams.js';
import { RNG } from '../core/rng.js';

/**
 * "Run The Streets" career: pick a crew, beat every other crew on their home court
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
  if (career.complete) return 'STREET LEGEND';
  if (r >= 1200) return 'KING OF THE COURT';
  if (r >= 800) return 'PROBLEM';
  if (r >= 450) return 'HOOPER';
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
  while (!(hs >= 21 && hs - as >= 2) && !(as >= 21 && as - hs >= 2) && hs < 30 && as < 30) {
    const pH = 0.5 + (h - a) / 200;
    if (rng.chance(pH)) hs += rng.chance(0.3) ? 2 : 1;
    else as += rng.chance(0.3) ? 2 : 1;
  }
  return [hs, as];
}
