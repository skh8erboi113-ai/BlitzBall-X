import { MatchSim } from '../src/game/match.js';
import { TEAMS } from '../src/data/teams.js';

const n = parseInt(process.argv[2] || '20', 10);
const diff = process.argv[3] || 'pro';
const verbose = process.argv.includes('--v');
const results = [];
const counts = {};
let totalTime = 0;
for (let i = 0; i < n; i++) {
  const home = TEAMS[i % TEAMS.length];
  const away = TEAMS[(i * 3 + 1) % TEAMS.length];
  const sim = new MatchSim({ home, away, difficulty: diff, seed: 1000 + i, userTeam: null });
  sim.events.on('*', (type) => { counts[type] = (counts[type] || 0) + 1; });
  if (verbose && i === 0) sim.events.on('*', (t, e) => { if (['score','steal','block','ankle','dunk','turnover','gamebreaker','alleyoop'].includes(t)) console.log(sim.time.toFixed(1), t, e.player?.data?.name || e.stealer?.data?.name || e.blocker?.data?.name || e.breaker?.data?.name || e.passer?.data?.name || e.team, e.points ?? e.reason ?? ''); });
  const dt = 1 / 60;
  let steps = 0;
  const maxSteps = 60 * 60 * 30;
  while (sim.state !== 'over' && steps < maxSteps) { sim.step(dt); steps++; }
  totalTime += sim.time;
  results.push({ home: home.abbr, away: away.abbr, score: sim.score, t: sim.time, over: sim.state === 'over', poss: sim.stats.possessions, shots: sim.stats.shots, dunks: sim.stats.dunks, tricks: sim.stats.tricks });
}
for (const r of results) console.log(`${r.home} ${r.score[0]} - ${r.score[1]} ${r.away}  ${r.over ? '' : 'TIMEOUT'} t=${r.t.toFixed(0)}s poss=${r.poss} shots=${r.shots} dunks=${r.dunks} tricks=${r.tricks}`);
console.log('avg match length (game seconds):', (totalTime / n).toFixed(1));
console.log('events:', JSON.stringify(counts));
const unfinished = results.filter((r) => !r.over).length;
if (unfinished) {
  console.error(`${unfinished} game(s) did not finish`);
  process.exit(1);
}
