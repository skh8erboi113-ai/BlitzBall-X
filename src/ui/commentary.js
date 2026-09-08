/**
 * Street-announcer commentary lines, keyed by sim events. Picked with the sim RNG so
 * headless tests don't diverge from the browser build.
 */
const LINES = {
  dunk: [
    '{p} just put somebody on a POSTER!',
    'OH! {p} with the {d}! Call the fire department!',
    '{p} threw that DOWN. Somebody check the rim!',
    'You can\'t guard {p}! {d}!',
    '{p} says GET OUT THE WAY! {d}!',
  ],
  dunk_big: ['ARE YOU KIDDING ME?! {p} with the {d}!', 'THAT IS DISRESPECTFUL! {p}!', 'Somebody call the cops, {p} just committed a robbery at the rim!'],
  swish2: ['{p} from DEEP! Nothing but net!', 'BANG! {p} for two from way out!', 'Splash! {p} is feeling it from downtown!', '{p} with ice in the veins. TWO!'],
  swish1: ['{p} drops it in.', 'Bucket. {p}.', 'Smooth finish from {p}.', '{p} gets it to go.'],
  ankle: ['{v}\'s ANKLES! {p} broke him down!', 'OH NO! {v} is on the floor! {p} is nasty with it!', '{p} put {v} on skates!', 'Somebody help {v} up! {p} with the shake!'],
  steal: ['{p} picks his pocket!', 'STRIPPED! {p} takes it away!', '{p} with the sticky hands!', 'Turnover! {p} read it all the way.'],
  block: ['REJECTED! {p} says NOT TODAY!', '{p} sends it back to the parking lot!', 'GET THAT OUTTA HERE! {p} with the swat!', '{p} with the block party!'],
  alleyoop: ['{a} to {p}... ALLEY-OOP! OH MY!', 'Lob city! {a} finds {p} above the rim!', '{a} throws it up, {p} throws it DOWN!'],
  gamebreaker: ['GAMEBREAKER! {p} is about to end somebody\'s night!', 'HERE IT COMES! {p} has the GAMEBREAKER!', 'IT\'S OVER! {p} GAMEBREAKER!'],
  gbscore: ['GAMEBREAKER SLAM! That\'s points for {t} AND points off the board!', 'DEVASTATING! {p} flips this game with the GAMEBREAKER!'],
  miss: ['{p} can\'t buy a bucket right now.', 'Off the iron. {p} will want that one back.', 'No good from {p}.', 'Brick! {p} was way off.'],
  heating: ['{p} is HEATING UP!', '{t} is on FIRE!', 'Somebody put {p} out! He\'s on fire!'],
  shove: ['{p} sends {v} to the concrete!', 'No blood, no foul! {p} with the shove!', '{p} says get off me!'],
  turnover_clock: ['Shot clock violation! {t} took too long.', 'Too slow! Clock runs out on {t}.'],
  turnover_clear: ['{t} forgot to clear it! Turnover!', 'Gotta take it back! {t} turns it over.'],
  gamepoint: ['{t} at game point!', 'One more bucket and this is OVER for {t}!'],
  win: ['{t} WINS IT! WHAT A GAME!', 'THAT\'S THE GAME! {t} takes it!', 'Ball game! {t} runs the court!'],
  blowout: ['{t} is running them off the court!', 'This is getting ugly. {t} up big.'],
  tip: ['Ball\'s up! {h} versus {aw}! First to 21, win by 2!', 'Let\'s run it! {h} taking on {aw}. Twenty-one wins!'],
  trick: ['{p} with the {tr}!', 'Ooh, {tr} from {p}!', '{p} is putting on a show! {tr}!'],
  combo: ['{p} is COOKING! Combo x{c}!', '{p} won\'t stop! Combo x{c}!'],
};

const first = (p) => (p && p.data ? (p.data.nick || p.data.name.split(' ')[0]) : '');

export class Commentary {
  constructor(sim, onLine) {
    this.sim = sim;
    this.onLine = onLine;
    this.last = -10;
    this.lastKey = '';
    this.gamePointCalled = [false, false];
    this.bind();
  }

  say(key, ctx = {}, force = false, priority = 1) {
    const pool = LINES[key];
    if (!pool) return;
    const now = this.sim.time;
    if (!force && now - this.last < 1.6 && priority < 2) return;
    let line = pool[Math.floor(this.sim.rng.next() * pool.length)];
    line = line
      .replace('{p}', first(ctx.p))
      .replace('{v}', first(ctx.v))
      .replace('{a}', first(ctx.a))
      .replace('{t}', ctx.t || '')
      .replace('{h}', ctx.h || '')
      .replace('{aw}', ctx.aw || '')
      .replace('{d}', ctx.d || 'SLAM')
      .replace('{tr}', ctx.tr || '')
      .replace('{c}', ctx.c || '');
    this.last = now;
    this.lastKey = key;
    this.onLine(line, priority);
  }

  teamName(t) {
    return `${this.sim.teams[t].city} ${this.sim.teams[t].name}`;
  }

  bind() {
    const ev = this.sim.events;
    const sim = this.sim;
    ev.on('live', () => {
      if (sim.time < 1.5) this.say('tip', { h: this.teamName(0), aw: this.teamName(1) }, true, 2);
    });
    ev.on('dunk', ({ player, label, dunkType }) => this.say(dunkType >= 2 ? 'dunk_big' : 'dunk', { p: player, d: label }, true, 2));
    ev.on('score', ({ player, points, type, gb, team, score }) => {
      if (gb) return this.say('gbscore', { p: player, t: this.teamName(team) }, true, 3);
      if (type === 'jumper' || type === 'layup') this.say(points >= 2 ? 'swish2' : 'swish1', { p: player }, true, 2);
      const opp = score[1 - team];
      const mine = score[team];
      const target = sim.rules.targetScore;
      if (mine >= target - 1 && mine - opp >= 1 && !this.gamePointCalled[team] && mine < target) {
        this.gamePointCalled[team] = true;
        setTimeout(() => this.say('gamepoint', { t: this.teamName(team) }, true, 2), 900);
      }
      if (mine - opp >= 8 && mine % 4 === 0) setTimeout(() => this.say('blowout', { t: this.teamName(team) }, false, 1), 1200);
    });
    ev.on('ankle', ({ breaker, victim }) => this.say('ankle', { p: breaker, v: victim }, true, 2));
    ev.on('steal', ({ stealer }) => this.say('steal', { p: stealer }, false, 2));
    ev.on('block', ({ blocker }) => this.say('block', { p: blocker }, true, 2));
    ev.on('alleyoop', ({ passer, finisher }) => this.say('alleyoop', { a: passer, p: finisher }, true, 3));
    ev.on('gamebreaker', ({ player }) => this.say('gamebreaker', { p: player }, true, 3));
    ev.on('miss', ({ player, type }) => {
      if (type !== 'lob' && sim.rng.chance(0.35)) this.say('miss', { p: player }, false, 1);
    });
    ev.on('heating', ({ player, team }) => this.say('heating', { p: player, t: this.teamName(team) }, true, 2));
    ev.on('shove', ({ shover, victim }) => this.say('shove', { p: shover, v: victim }, false, 1));
    ev.on('turnover', ({ team, reason }) => {
      if (reason === 'SHOT CLOCK') this.say('turnover_clock', { t: this.teamName(team) }, true, 2);
      else if (reason === 'NO CLEAR') this.say('turnover_clear', { t: this.teamName(team) }, true, 2);
    });
    ev.on('trick', ({ player, broke, combo, type }) => {
      if (broke) return;
      if (combo >= 3) this.say('combo', { p: player, c: combo }, false, 1);
      else if (sim.rng.chance(0.25)) this.say('trick', { p: player, tr: ['crossover', 'behind-the-back', 'spin move', 'through the legs', 'hesi', 'off the dome'][type] }, false, 1);
    });
    ev.on('gameover', ({ winner }) => this.say('win', { t: this.teamName(winner) }, true, 3));
  }
}
