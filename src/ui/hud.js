import { RULES } from '../data/constants.js';

/**
 * In-match HUD: scoreboard, shot clock, gamebreaker meters, turbo bar, style popups,
 * commentary ticker, banners (GAMEBREAKER / ANKLE BREAKER / etc), controls hint.
 */
export class HUD {
  constructor(root, sim) {
    this.root = root;
    this.sim = sim;
    this.root.innerHTML = this.template();
    this.$ = (s) => this.root.querySelector(s);
    this.els = {
      homeName: this.$('.sb-team.home .sb-name'),
      awayName: this.$('.sb-team.away .sb-name'),
      homeScore: this.$('.sb-team.home .sb-score'),
      awayScore: this.$('.sb-team.away .sb-score'),
      homeGb: this.$('.sb-team.home .gb-fill'),
      awayGb: this.$('.sb-team.away .gb-fill'),
      homeGbWrap: this.$('.sb-team.home .gb-meter'),
      awayGbWrap: this.$('.sb-team.away .gb-meter'),
      clock: this.$('.sb-clock'),
      clear: this.$('.sb-clear'),
      turbo: this.$('.turbo-fill'),
      turboWrap: this.$('.turbo'),
      pcard: this.$('.pcard'),
      pname: this.$('.pcard-name'),
      pnick: this.$('.pcard-nick'),
      pnum: this.$('.pcard-num'),
      popups: this.$('.popups'),
      banner: this.$('.banner'),
      bannerText: this.$('.banner-text'),
      bannerSub: this.$('.banner-sub'),
      ticker: this.$('.ticker-text'),
      tickerWrap: this.$('.ticker'),
      hint: this.$('.hint'),
      combo: this.$('.combo'),
      heat: this.$('.heat'),
      timing: this.$('.timing'),
    };
    const [h, a] = sim.teams;
    this.els.homeName.textContent = h.abbr;
    this.els.awayName.textContent = a.abbr;
    this.root.style.setProperty('--home', h.primary);
    this.root.style.setProperty('--home-accent', h.accent);
    this.root.style.setProperty('--away', a.primary);
    this.root.style.setProperty('--away-accent', a.accent);
    this.bannerTimer = null;
    this.tickerTimer = null;
    this.tickerQueue = [];
    this.lastScore = [0, 0];
    this.bind();
  }

  template() {
    return `
      <div class="scoreboard">
        <div class="sb-team home">
          <div class="sb-name">HOME</div>
          <div class="sb-score">0</div>
          <div class="gb-meter"><div class="gb-fill"></div><span class="gb-label">GB</span></div>
        </div>
        <div class="sb-mid">
          <div class="sb-title">FIRST TO ${RULES.targetScore}</div>
          <div class="sb-clock">20</div>
          <div class="sb-clear">CLEAR IT</div>
        </div>
        <div class="sb-team away">
          <div class="sb-name">AWAY</div>
          <div class="sb-score">0</div>
          <div class="gb-meter"><div class="gb-fill"></div><span class="gb-label">GB</span></div>
        </div>
      </div>
      <div class="popups"></div>
      <div class="banner"><div class="banner-text"></div><div class="banner-sub"></div></div>
      <div class="timing"></div>
      <div class="combo"></div>
      <div class="heat">ON FIRE</div>
      <div class="pcard">
        <div class="pcard-num">00</div>
        <div class="pcard-info">
          <div class="pcard-nick">NICK</div>
          <div class="pcard-name">Name</div>
          <div class="turbo"><div class="turbo-fill"></div><span>TURBO</span></div>
        </div>
      </div>
      <div class="ticker"><span class="ticker-mic">🎙</span><span class="ticker-text"></span></div>
      <div class="hint"></div>
    `;
  }

  setHint(text) {
    this.els.hint.textContent = text;
  }

  bind() {
    const ev = this.sim.events;
    ev.on('style', ({ player, points, label, combo, big, team }) => {
      if (this.sim.userTeam !== null && team !== this.sim.userTeam && !big) return; // only show CPU big plays
      this.popup(`${label}`, `+${points}`, team, big, combo);
    });
    ev.on('gbready', ({ team }) => {
      this.banner('GAMEBREAKER READY', this.sim.userTeam === team ? 'PRESS E / LT+RT' : `${this.sim.teams[team].name.toUpperCase()}`, team, 2000);
      this.flashGb(team);
    });
    ev.on('gamebreaker', ({ team, player }) => this.banner('GAMEBREAKER!', player.data.signature.toUpperCase(), team, 2600, true));
    ev.on('ankle', ({ breaker }) => this.banner('ANKLE BREAKER', '', breaker.team, 1400));
    ev.on('block', ({ blocker }) => this.banner('REJECTED', '', blocker.team, 1100));
    ev.on('alleyoop', ({ finisher }) => this.banner('ALLEY-OOP', '', finisher.team, 1300));
    ev.on('score', ({ team, points, gb, stolen, player, type }) => {
      if (gb) this.banner(`+${points}  /  -${stolen}`, 'GAMEBREAKER SLAM', team, 2400, true);
      else if (points >= 2) this.banner('FOR TWO', '', team, 900);
      this.pulseScore(team);
    });
    ev.on('heating', ({ team }) => {
      if (this.sim.userTeam === null || team === this.sim.userTeam) this.showHeat(true);
    });
    ev.on('turnover', ({ reason, team }) => this.banner(reason, 'TURNOVER', 1 - team, 1500));
    ev.on('violation', ({ reason }) => this.banner(reason, 'TAKE IT BACK', null, 1200));
    ev.on('possession', ({ team }) => {
      if (this.sim.momentum[1 - team] === 0) this.showHeat(false);
    });
    ev.on('timing', ({ label, good }) => this.showTiming(label, good));
    ev.on('gameover', ({ winner }) => this.banner('GAME', `${this.sim.teams[winner].city.toUpperCase()} ${this.sim.teams[winner].name.toUpperCase()} WIN`, winner, 5000, true));
  }

  popup(label, sub, team, big, combo) {
    const el = document.createElement('div');
    el.className = `popup ${big ? 'big' : ''} t${team}`;
    el.innerHTML = `<span class="popup-label">${label}</span><span class="popup-pts">${sub}</span>${combo > 1 ? `<span class="popup-combo">x${combo}</span>` : ''}`;
    el.style.setProperty('--rot', `${(Math.random() - 0.5) * 10}deg`);
    el.style.setProperty('--dx', `${(Math.random() - 0.5) * 120}px`);
    this.els.popups.appendChild(el);
    while (this.els.popups.children.length > 5) this.els.popups.firstChild.remove();
    setTimeout(() => el.classList.add('out'), big ? 1400 : 950);
    setTimeout(() => el.remove(), big ? 1900 : 1400);
    if (combo > 1) {
      this.els.combo.textContent = `COMBO x${combo}`;
      this.els.combo.classList.add('show');
      clearTimeout(this.comboTimer);
      this.comboTimer = setTimeout(() => this.els.combo.classList.remove('show'), 1200);
    }
  }

  banner(text, sub, team, ms = 1200, huge = false) {
    const b = this.els.banner;
    this.els.bannerText.textContent = text;
    this.els.bannerSub.textContent = sub || '';
    b.className = `banner show ${huge ? 'huge' : ''} ${team === null ? '' : `t${team}`}`;
    clearTimeout(this.bannerTimer);
    this.bannerTimer = setTimeout(() => b.classList.remove('show'), ms);
  }

  showTiming(label, good) {
    const t = this.els.timing;
    t.textContent = label;
    t.className = `timing show ${good ? 'good' : 'bad'} ${label === 'PERFECT' ? 'perfect' : ''}`;
    clearTimeout(this.timingTimer);
    this.timingTimer = setTimeout(() => t.classList.remove('show'), 800);
  }

  showHeat(on) {
    this.els.heat.classList.toggle('show', on);
  }

  flashGb(team) {
    const w = team === 0 ? this.els.homeGbWrap : this.els.awayGbWrap;
    w.classList.add('ready');
  }

  pulseScore(team) {
    const el = team === 0 ? this.els.homeScore : this.els.awayScore;
    el.classList.remove('pulse');
    void el.offsetWidth;
    el.classList.add('pulse');
  }

  ticker(line, priority) {
    if (priority >= 2) this.tickerQueue = [];
    this.tickerQueue.push(line);
    if (!this.tickerTimer) this.nextTicker();
  }

  nextTicker() {
    const line = this.tickerQueue.shift();
    if (!line) {
      this.tickerTimer = null;
      this.els.tickerWrap.classList.remove('show');
      return;
    }
    this.els.ticker.textContent = line;
    this.els.tickerWrap.classList.add('show');
    this.tickerTimer = setTimeout(() => {
      this.tickerTimer = null;
      if (this.tickerQueue.length) this.nextTicker();
      else this.els.tickerWrap.classList.remove('show');
    }, 2600);
  }

  update() {
    const sim = this.sim;
    const [h, a] = sim.score;
    this.els.homeScore.textContent = h;
    this.els.awayScore.textContent = a;
    const max = sim.rules.gamebreakerMeterMax;
    this.els.homeGb.style.width = `${(sim.gb[0] / max) * 100}%`;
    this.els.awayGb.style.width = `${(sim.gb[1] / max) * 100}%`;
    this.els.homeGbWrap.classList.toggle('ready', sim.gbReady[0]);
    this.els.awayGbWrap.classList.toggle('ready', sim.gbReady[1]);
    const clock = Math.max(0, Math.ceil(sim.shotClock));
    this.els.clock.textContent = sim.state === 'live' ? clock : '--';
    this.els.clock.classList.toggle('urgent', clock <= 5 && sim.state === 'live');
    this.els.clear.classList.toggle('show', sim.mustClear && sim.possession === sim.userTeam && sim.state === 'live');
    // Player card: the controlled player, or (spectating) whoever has the ball.
    const p = sim.controlled || sim.ball.holder || this._lastCard;
    if (p) {
      this._lastCard = p;
      this.els.turbo.style.width = `${p.turbo}%`;
      this.els.turboWrap.classList.toggle('low', p.turbo < 20);
      if (this._cardId !== p.id) {
        this._cardId = p.id;
        this.els.pname.textContent = p.data.name;
        this.els.pnick.textContent = p.data.nick;
        this.els.pnum.textContent = `#${p.data.number}`;
        this.els.pcard.style.setProperty('--c1', sim.teams[p.team].primary);
        this.els.pcard.style.setProperty('--c2', sim.teams[p.team].secondary);
      }
    }
  }
}
