import '@fontsource/bangers/400.css';
import '@fontsource/barlow-condensed/500.css';
import '@fontsource/barlow-condensed/700.css';
import '@fontsource/barlow-condensed/900.css';
import '@fontsource/permanent-marker/400.css';
import './styles.css';

import { MatchSim } from './game/match.js';
import { MatchRenderer } from './render/renderer.js';
import { InputManager } from './ui/input.js';
import { AudioSystem } from './ui/audio.js';
import { HUD } from './ui/hud.js';
import { Commentary } from './ui/commentary.js';
import { loadState, saveState, clearState } from './ui/save.js';
import { createCareer, currentOpponent, recordResult, careerTitle } from './game/career.js';
import { TEAMS, TEAM_BY_ID } from './data/teams.js';
import { PHYS } from './data/constants.js';
import * as Screens from './ui/screens.js';

class App {
  constructor() {
    this.state = loadState();
    this.input = new InputManager();
    this.audio = new AudioSystem(this.state.settings);
    this.root = document.getElementById('app');
    this.screen = null;
    this.match = null;
    this.teams = TEAMS; // exposed for QA tooling
    this.overlay = null;
    this.settingsOverlay = null;
    this.raf = null;
    this.lastT = performance.now();
    this.accum = 0;
    const unlock = () => {
      this.audio.unlock();
      if (!this.match && !this.audio.beat) this.audio.startBeat('menu');
    };
    window.addEventListener('pointerdown', unlock, { once: false });
    window.addEventListener('keydown', unlock, { once: false });
    window.addEventListener('resize', () => this.match && this.match.renderer.resize());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.match && !this.match.paused && this.match.sim.state !== 'over') this.pause();
    });
    this.input.onPause = () => {
      if (!this.match || this.match.sim.state === 'over' || this.match.finished) return false;
      if (this.match.paused) {
        // Settings overlay on top of the pause menu closes first.
        if (this.settingsOverlay) {
          this.settingsOverlay.el.remove();
          this.settingsOverlay = null;
        } else this.resume();
      } else this.pause();
      return true;
    };
    this.go('title');
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
  }

  save() {
    saveState(this.state);
    this.audio.applyVolumes();
  }

  resetAll() {
    clearState();
    this.state = loadState();
    this.audio.settings = this.state.settings;
    this.audio.applyVolumes();
    this.go('title');
  }

  // ---------------------------------------------------------------------------
  // Screen routing
  // ---------------------------------------------------------------------------

  go(name, params = {}) {
    if (this.screen && this.screen.destroy) this.screen.destroy();
    if (this.screen) this.screen.el.remove();
    this.screen = null;
    const factories = {
      title: Screens.TitleScreen,
      teamselect: Screens.TeamSelectScreen,
      career: Screens.CareerScreen,
      roster: Screens.RosterScreen,
      howto: Screens.HowToScreen,
      settings: Screens.SettingsScreen,
      results: Screens.ResultsScreen,
    };
    const f = factories[name];
    if (!f) return;
    if (name !== 'results' && this.match) this.endMatch();
    if (name === 'career' && !this.isCareerValid()) {
      this.state.career = null;
      this.save();
      return this.go('title');
    }
    this.screen = f(this, params);
    this.screen.name = name;
    this.root.appendChild(this.screen.el);
    requestAnimationFrame(() => this.screen && this.screen.el.classList.add('in'));
    if (this.audio.unlocked && !this.match && (!this.audio.beat || this.audio.beat.style !== 'menu')) this.audio.startBeat('menu');
  }

  isCareerValid() {
    const c = this.state.career;
    return !!(c && TEAM_BY_ID[c.teamId] && Array.isArray(c.ladder) && c.ladder.every((id) => TEAM_BY_ID[id]) && (c.complete || TEAM_BY_ID[c.ladder[c.stage]]));
  }

  startCareer(teamId) {
    if (!TEAM_BY_ID[teamId]) return this.go('title');
    this.state.career = createCareer(teamId, this.state.settings.difficulty);
    this.save();
    this.go('career');
  }

  // ---------------------------------------------------------------------------
  // Match lifecycle
  // ---------------------------------------------------------------------------

  startMatch({ home, away, userTeam = 0, mode = 'quick' }) {
    if (this.screen) {
      this.screen.el.remove();
      this.screen = null;
    }
    if (this.match) this.endMatch();
    const wrap = document.createElement('div');
    wrap.className = 'match-wrap';
    wrap.innerHTML = `<canvas class="game-canvas"></canvas><div class="hud"></div><div class="tip-overlay"><div class="tip-box"><div class="tip-teams"><span style="--c1:${home.primary}">${home.city} ${home.name}</span><em>VS</em><span style="--c1:${away.primary}">${away.city} ${away.name}</span></div><div class="tip-rule">FIRST TO 21 · WIN BY 2 · ${mode === 'career' ? 'THEIR COURT' : home.city.toUpperCase()}</div></div></div>`;
    this.root.appendChild(wrap);
    const canvas = wrap.querySelector('.game-canvas');
    const difficulty = mode === 'career' && this.state.career ? this.state.career.difficulty : this.state.settings.difficulty;
    const seed = (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;
    const sim = new MatchSim({ home, away, difficulty, seed, userTeam });
    let renderer;
    try {
      renderer = new MatchRenderer(canvas, sim, this.state.settings);
    } catch (e) {
      console.error(e);
      wrap.remove();
      alert('WebGL is required to play. Please enable hardware acceleration or try another browser.');
      this.go('title');
      return;
    }
    const hud = new HUD(wrap.querySelector('.hud'), sim);
    hud.setHint(userTeam === null ? 'WATCHING · ESC to leave' : 'WASD move · SHIFT turbo · J shoot · K pass · L trick/steal · I shove · E gamebreaker');
    const commentary = new Commentary(sim, (line, pr) => {
      if (this.state.settings.commentary) hud.ticker(line, pr);
    });
    this.match = { sim, renderer, hud, commentary, wrap, mode, userTeam, home, away, paused: false, tipTimer: 2.2, finished: false, resultsTimer: 0 };
    this.bindMatchAudio(sim, renderer);
    if (this.audio.unlocked) {
      this.audio.startBeat('match');
      this.audio.startCrowd();
      this.audio.whistle();
    }
    setTimeout(() => wrap.querySelector('.tip-overlay')?.classList.add('out'), 1800);
    this.accum = 0;
    this.lastT = performance.now();
  }

  bindMatchAudio(sim, renderer) {
    const a = this.audio;
    const ev = sim.events;
    ev.on('bounce', ({ speed }) => a.bounce(Math.min(1, speed / 4)));
    ev.on('swish', () => {
      a.swish();
      a.crowdSwell(0.7);
    });
    ev.on('rim', ({ hard }) => a.rim(hard));
    ev.on('board', () => a.board());
    ev.on('dunk', () => {
      a.slam();
      a.crowdSwell(1.2);
    });
    ev.on('shot', () => a.whoosh(1.1));
    ev.on('pass', ({ alley }) => a.whoosh(alley ? 0.8 : 1.4));
    ev.on('fence', () => a.fence());
    ev.on('knockdown', () => {
      a.thud();
      a.crowdSwell(0.5);
    });
    ev.on('ankle', () => {
      a.stinger('big');
      a.crowdSwell(1.3);
    });
    ev.on('steal', () => {
      a.stealHit();
      a.crowdSwell(0.6);
    });
    ev.on('block', () => {
      a.blockHit();
      a.crowdSwell(1.1);
    });
    ev.on('style', ({ big, team }) => {
      if (sim.userTeam === null || team === sim.userTeam) a.stinger(big ? 'big' : 'style');
    });
    ev.on('gbready', () => a.stinger('gb'));
    ev.on('gamebreaker', () => {
      a.gbCharge();
      a.crowdSwell(1.5);
    });
    ev.on('trick', ({ turbo }) => {
      a.sneakerSqueak();
      if (turbo) a.whoosh(1.6);
    });
    ev.on('jump', () => a.sneakerSqueak());
    ev.on('miss', ({ type }) => {
      if (type !== 'lob') a.crowdGroan();
    });
    ev.on('turnover', () => a.whistle());
    ev.on('violation', () => a.whistle());
    ev.on('shotclock', () => a.buzzer());
    ev.on('gameover', () => {
      a.buzzer();
      a.crowdSwell(2);
    });
    ev.on('score', ({ gb }) => {
      if (gb) a.stinger('gb');
    });
    // Ball dribble tick from the renderer (when held & bouncing)
    this._dribbleT = 0;
  }

  pause() {
    if (!this.match || this.match.paused) return;
    this.match.paused = true;
    this.audio.suspend();
    const ov = Screens.PauseOverlay(this, {
      onResume: () => this.resume(),
      onQuit: () => this.go('title'),
      onRestart: () => {
        const m = this.match;
        this.startMatch({ home: m.home, away: m.away, userTeam: m.userTeam, mode: m.mode });
      },
    });
    this.overlay = ov;
    this.match.wrap.appendChild(ov.el);
  }

  resume() {
    if (!this.match || !this.match.paused) return;
    this.match.paused = false;
    this.audio.resume();
    if (this.overlay) this.overlay.el.remove();
    this.overlay = null;
    if (this.settingsOverlay) {
      this.settingsOverlay.el.remove();
      this.settingsOverlay = null;
    }
    this.lastT = performance.now();
  }

  openSettingsOverlay() {
    if (!this.match) return;
    const s = Screens.SettingsScreen(this, {});
    s.el.classList.add('overlay-screen', 'in');
    s.el.querySelector('.back-btn').onclick = () => {
      s.el.remove();
      this.settingsOverlay = null;
    };
    this.settingsOverlay = s;
    this.match.wrap.appendChild(s.el);
  }

  endMatch() {
    if (!this.match) return;
    this.match.renderer.dispose();
    this.match.wrap.remove();
    this.match = null;
    this.overlay = null;
    this.audio.stopCrowd();
    this.audio.resume();
  }

  finishMatch() {
    const m = this.match;
    if (!m || m.finished) return;
    m.finished = true;
    const sim = m.sim;
    const rec = this.state.records;
    let careerResult = null;
    if (m.userTeam !== null) {
      const won = sim.winner === m.userTeam;
      const myStyle = sim.teamPlayers(m.userTeam).reduce((s, p) => s + p.stats.style, 0);
      const margin = sim.score[m.userTeam] - sim.score[1 - m.userTeam];
      if (won) rec.wins++;
      else rec.losses++;
      rec.styleBest = Math.max(rec.styleBest, myStyle);
      rec.gamebreakers += sim.teamPlayers(m.userTeam).reduce((s, p) => s + p.stats.gb, 0);
      rec.dunks += sim.teamPlayers(m.userTeam).reduce((s, p) => s + p.stats.dunks, 0);
      rec.ankles += sim.teamPlayers(m.userTeam).reduce((s, p) => s + p.stats.ankles, 0);
      rec.bestMargin = Math.max(rec.bestMargin, margin);
      if (m.mode === 'career' && this.state.career) {
        const c = this.state.career;
        const before = c.rep;
        recordResult(c, { won, score: [...sim.score], style: myStyle, margin });
        careerResult = won
          ? `+${c.rep - before} REP · ${careerTitle(c)}${c.complete ? ' · YOU BEAT EVERY CREW. LEGEND DIFFICULTY UNLOCKED.' : ` · NEXT: ${currentOpponent(c).city.toUpperCase()}`}`
          : `+${c.rep - before} REP · Run it back to move up the ladder.`;
        if (c.complete) this.state.unlocked.legendMode = true;
      }
      this.save();
    }
    setTimeout(() => {
      if (!this.match) return;
      const params = { sim, mode: m.mode, userTeam: m.userTeam, careerResult };
      this.match.renderer.dispose();
      this.match.wrap.remove();
      this.match = null;
      this.audio.stopCrowd();
      this.go('results', params);
    }, 3200);
  }

  // ---------------------------------------------------------------------------
  // Frame loop
  // ---------------------------------------------------------------------------

  loop() {
    this.raf = requestAnimationFrame(this.loop);
    // Use performance.now() rather than the rAF timestamp: the latter is the frame's vsync time
    // and can be EARLIER than a performance.now() sampled when a match started/resumed, which
    // would produce a negative dt (and a camera lerp that extrapolates off into space).
    const now = performance.now();
    let dt = (now - this.lastT) / 1000;
    this.lastT = now;
    if (dt > 0.1) dt = 0.1;
    if (dt < 0) dt = 0;

    if (this.match) {
      const m = this.match;
      if (m.paused) {
        const nav = this.input.menuPoll();
        if (this.settingsOverlay) {
          if (nav.back) {
            this.settingsOverlay.el.remove();
            this.settingsOverlay = null;
          }
        } else if (this.overlay) this.overlay.onNav(nav);
        m.renderer.render();
        return;
      }
      const input = this.input.poll();
      if (m.userTeam !== null) m.sim.setUserInput(input);
      // Fixed-step simulation
      this.accum += dt;
      const step = PHYS.fixedDt;
      let n = 0;
      while (this.accum >= step && n < 5) {
        m.sim.step(step);
        this.accum -= step;
        n++;
        // One-shot inputs only apply for one sim step.
        input.shootPressed = false;
        input.shootReleased = false;
        input.pass = false;
        input.trick = false;
        input.shove = false;
        input.jump = false;
        input.switchPlayer = false;
        input.gamebreaker = false;
      }
      // Dribble sound
      const holder = m.sim.ball.holder;
      if (holder && (holder.state === 'idle' || holder.state === 'run')) {
        this._dribbleT -= dt;
        if (this._dribbleT <= 0) {
          this.audio.dribble();
          this._dribbleT = holder.speedNorm > 0.2 ? 0.28 : 0.45;
        }
      }
      m.renderer.update(dt);
      m.hud.update();
      m.renderer.render();
      this.audio.setCrowdLevel(m.renderer.crowdEnergy);
      if (m.sim.state === 'over' && !m.finished) this.finishMatch();
      if (m.userTeam === null && input.switchPlayer) {
        /* spectator: nothing */
      }
    } else if (this.screen) {
      const nav = this.input.menuPoll();
      if (this.screen.onNav) this.screen.onNav(nav);
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});
