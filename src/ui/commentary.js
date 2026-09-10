/**
 * Poolside-announcer commentary lines, keyed by sim events. Picked with the sim RNG so
 * headless tests don't diverge from the browser build.
 */
const LINES = {
  goal: ['{p} BURIES it! GOAL!', 'GOAL! {p} rips it past the keeper!', '{p} finds the back of the net!', 'Top bins! {p} with the finish!', '{p} lets it fly and it\'s IN!'],
  goal_long: ['FROM DOWNTOWN! {p} from way out!', 'ARE YOU KIDDING?! {p} from distance!', '{p} with a SCREAMER from the halfway line!'],
  goal_volley: ['{p} meets it in the air... VOLLEY! GOAL!', 'OFF THE LOB! {p} hammers the volley home!', 'Bicycle! {p} with the acrobatic finish!'],
  goal_perfect: ['PERFECT strike from {p}! The keeper never moved!', '{p} with a laser. Unstoppable.'],
  save: ['{k} says NOT TODAY!', 'Big save from {k}!', '{k} gets a hand on it!', 'DENIED by the keeper! {k} stands tall!'],
  save_big: ['WHAT A SAVE! {k} out of nowhere!', '{k} is a WALL! Unbelievable stop!', 'FULL STRETCH! {k} keeps it out!'],
  washed: ['{v} got WASHED! {p} left him spinning!', 'OH NO! {v} is going in circles! {p} is nasty with it!', '{p} put {v} in the rinse cycle!', 'Somebody help {v}! {p} with the shake!'],
  tackle: ['{p} picks his pocket!', 'STRIPPED! {p} takes it away!', '{p} with the sticky hands!', 'Turnover! {p} read it all the way.'],
  block: ['DENIED! {p} gets in the way!', '{p} throws the body in front of it!', 'GET THAT OUTTA HERE! {p} with the block!'],
  alleyoop: ['{a} lobs it up... {p} VOLLEYS IT HOME!', 'Lob city! {a} finds {p} in the air!', '{a} floats it, {p} SMASHES it!'],
  gamebreaker: ['GAMEBREAKER! {p} is about to end somebody\'s night!', 'HERE IT COMES! {p} has the GAMEBREAKER!', 'IT\'S OVER! {p} GAMEBREAKER!'],
  gbscore: ['GAMEBREAKER GOAL! Points for {t} AND points off the board!', 'DEVASTATING! {p} flips this match with the GAMEBREAKER!'],
  miss: ['{p} can\'t find the target right now.', 'Off the ring! {p} will want that one back.', 'Wide from {p}.', 'Skied it! {p} was way off.'],
  post: ['OFF THE RING! {p} was an inch away!', 'Clang! {p} rattles the post!'],
  heating: ['{p} is HEATING UP!', '{t} is on FIRE!', 'Somebody cool {p} down! He\'s on fire!'],
  bighit: ['{p} sends {v} tumbling!', 'No blood, no foul! {p} with the big hit!', '{p} says get off me!', 'BOOM! {v} felt that one from {p}!'],
  turnover_clock: ['Possession clock! {t} took too long.', 'Too slow! Clock runs out on {t}.'],
  keeperhold: ['The keeper has to get rid of it!'],
  win: ['{t} WINS IT! WHAT A MATCH!', 'THAT\'S THE MATCH! {t} takes it!', 'Full time! {t} rule the pool!'],
  blowout: ['{t} is running them out of the sphere!', 'This is getting ugly. {t} up big.'],
  tip: ['Ball\'s in! {h} versus {aw}! Two halves, most goals wins!', 'Let\'s run it! {h} taking on {aw} in the sphere!'],
  trick: ['{p} with the {tr}!', 'Ooh, {tr} from {p}!', '{p} is putting on a show! {tr}!'],
  combo: ['{p} is COOKING! Combo x{c}!', '{p} won\'t stop! Combo x{c}!'],
  halftime: ['That\'s the half! {h} {s0}, {aw} {s1}.', 'Halftime in the sphere. {h} {s0} - {aw} {s1}.'],
  overtime: ['We\'re level! OVERTIME — next goal wins!', 'GOLDEN GOAL! Next one in takes it!'],
  mercy: ['MERCY! {t} end it early!'],
};

const first = (p) => (p && p.data ? p.data.nick || p.data.name.split(' ')[0] : '');

export class Commentary {
  constructor(sim, onLine) {
    this.sim = sim;
    this.onLine = onLine;
    this.last = -10;
    this.lastKey = '';
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
      .replace('{k}', first(ctx.k))
      .replace('{t}', ctx.t || '')
      .replace('{h}', ctx.h || '')
      .replace('{aw}', ctx.aw || '')
      .replace('{s0}', ctx.s0 ?? '')
      .replace('{s1}', ctx.s1 ?? '')
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
      if (sim.time < 2.5) this.say('tip', { h: this.teamName(0), aw: this.teamName(1) }, true, 2);
    });
    ev.on('score', ({ player, type, gb, team, score }) => {
      if (gb) return this.say('gbscore', { p: player, t: this.teamName(team) }, true, 3);
      if (type === 'volley') this.say('goal_volley', { p: player }, true, 2);
      else if (type === 'long') this.say('goal_long', { p: player }, true, 2);
      else this.say('goal', { p: player }, true, 2);
      const opp = score[1 - team];
      const mine = score[team];
      if (mine - opp >= 5 && mine % 3 === 0) setTimeout(() => this.say('blowout', { t: this.teamName(team) }, false, 1), 1200);
    });
    ev.on('save', ({ keeper, big }) => this.say(big ? 'save_big' : 'save', { k: keeper }, big, 2));
    ev.on('washed', ({ player, victim }) => this.say('washed', { p: player, v: victim }, true, 2));
    ev.on('tackle', ({ player }) => this.say('tackle', { p: player }, false, 2));
    ev.on('block', ({ blocker }) => this.say('block', { p: blocker }, true, 2));
    ev.on('alleyoop', ({ passer, finisher }) => this.say('alleyoop', { a: passer, p: finisher }, true, 3));
    ev.on('gamebreaker', ({ player }) => this.say('gamebreaker', { p: player }, true, 3));
    ev.on('miss', ({ player, type }) => {
      if (type === 'post') this.say('post', { p: player }, false, 1);
      else if (type !== 'blocked' && sim.rng.chance(0.35)) this.say('miss', { p: player }, false, 1);
    });
    ev.on('heating', ({ player, team }) => this.say('heating', { p: player, t: this.teamName(team) }, true, 2));
    ev.on('bighit', ({ player, victim }) => this.say('bighit', { p: player, v: victim }, false, 1));
    ev.on('turnover', ({ team, reason }) => {
      if (reason === 'POSSESSION CLOCK') this.say('turnover_clock', { t: this.teamName(team) }, true, 2);
    });
    ev.on('violation', ({ reason }) => {
      if (reason === 'KEEPER HOLD') this.say('keeperhold', {}, false, 1);
    });
    ev.on('trick', ({ player, name }) => {
      if (player.combo >= 3) this.say('combo', { p: player, c: player.combo }, false, 1);
      else if (sim.rng.chance(0.25)) this.say('trick', { p: player, tr: name.toLowerCase() }, false, 1);
    });
    ev.on('halftime', ({ score }) => this.say('halftime', { h: this.teamName(0), aw: this.teamName(1), s0: score[0], s1: score[1] }, true, 3));
    ev.on('overtime', () => this.say('overtime', {}, true, 3));
    ev.on('gameover', ({ winner, score }) => {
      if (Math.abs(score[0] - score[1]) >= sim.rules.mercyLead) this.say('mercy', { t: this.teamName(winner) }, true, 3);
      else this.say('win', { t: this.teamName(winner) }, true, 3);
    });
  }
}
