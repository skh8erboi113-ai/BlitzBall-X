import { TEAMS, TEAM_BY_ID, playerOverall, teamOverall } from '../data/teams.js';
import { DIFFICULTY } from '../data/constants.js';
import { currentOpponent, careerTitle } from '../game/career.js';

/**
 * DOM screens. Each screen is a function(app) → { el, onNav(navInput), destroy }.
 * Menus support mouse and keyboard/gamepad navigation.
 */

const h = (html) => {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
};

function teamCard(team, opts = {}) {
  const ovr = teamOverall(team);
  const stars = team.roster.slice(0, 3).map((p) => `<li><span class="nick">${p.nick}</span><span class="pname">${p.name}</span><span class="ovr">${playerOverall(p)}</span></li>`).join('');
  return `
    <div class="team-card ${opts.cls || ''}" style="--c1:${team.primary};--c2:${team.secondary};--c3:${team.accent}" data-id="${team.id}">
      <div class="tc-head">
        <div class="tc-abbr">${team.abbr}</div>
        <div class="tc-names"><div class="tc-city">${team.city}</div><div class="tc-name">${team.name}</div></div>
        <div class="tc-ovr"><span>OVR</span>${ovr}</div>
      </div>
      <div class="tc-motto">“${team.motto}”</div>
      <ul class="tc-roster">${stars}</ul>
    </div>`;
}

function menuList(items) {
  return `<ul class="menu">${items.map((it, i) => `<li class="menu-item ${i === 0 ? 'sel' : ''}" data-action="${it.action}" ${it.disabled ? 'data-disabled="1"' : ''}><span class="mi-label">${it.label}</span>${it.sub ? `<span class="mi-sub">${it.sub}</span>` : ''}</li>`).join('')}</ul>`;
}

function wireMenu(root, onSelect, app) {
  const items = Array.from(root.querySelectorAll('.menu-item'));
  let idx = items.findIndex((i) => i.classList.contains('sel'));
  if (idx < 0) idx = 0;
  const setSel = (n) => {
    items[idx]?.classList.remove('sel');
    idx = (n + items.length) % items.length;
    items[idx].classList.add('sel');
    app.audio.uiMove();
  };
  items.forEach((el, i) => {
    el.addEventListener('mouseenter', () => {
      if (i !== idx) {
        items[idx]?.classList.remove('sel');
        idx = i;
        el.classList.add('sel');
      }
    });
    el.addEventListener('click', () => {
      if (el.dataset.disabled) return;
      app.audio.uiConfirm();
      onSelect(el.dataset.action, el);
    });
  });
  return {
    nav(n) {
      if (n.up) setSel(idx - 1);
      if (n.down) setSel(idx + 1);
      if (n.confirm) {
        const el = items[idx];
        if (el && !el.dataset.disabled) {
          app.audio.uiConfirm();
          onSelect(el.dataset.action, el);
        }
      }
    },
    get index() {
      return idx;
    },
  };
}

// ---------------------------------------------------------------------------
// Title
// ---------------------------------------------------------------------------

export function TitleScreen(app) {
  const hasCareer = !!app.state.career;
  const el = h(`
    <section class="screen title-screen">
      <div class="title-bg"></div>
      <div class="title-graffiti">
        <div class="logo-wrap">
          <div class="logo-blitz">BLITZBALL</div>
          <div class="logo-x">X</div>
        </div>
        <div class="tagline">3-ON-3 · FIRST TO 21 · NO REFS</div>
      </div>
      <div class="title-menu">
        ${menuList([
          { action: 'quick', label: 'PICK UP GAME', sub: 'Quick match vs CPU' },
          { action: 'career', label: hasCareer ? 'CONTINUE RUNNING THE STREETS' : 'RUN THE STREETS', sub: hasCareer ? `${careerTitle(app.state.career)} · ${app.state.career.wins}W ${app.state.career.losses}L` : 'Career ladder · 7 crews' },
          { action: 'versus', label: 'WATCH', sub: 'CPU vs CPU exhibition' },
          { action: 'howto', label: 'HOW TO PLAY' },
          { action: 'settings', label: 'SETTINGS' },
        ])}
      </div>
      <div class="title-foot"><span>${app.state.records.wins}W – ${app.state.records.losses}L</span><span>BEST STYLE ${app.state.records.styleBest}</span><span>v1.0</span></div>
    </section>`);
  const menu = wireMenu(el, (action) => {
    if (action === 'quick') app.go('teamselect', { mode: 'quick' });
    else if (action === 'career') app.go(hasCareer ? 'career' : 'teamselect', { mode: 'career' });
    else if (action === 'versus') app.go('teamselect', { mode: 'versus' });
    else if (action === 'howto') app.go('howto');
    else if (action === 'settings') app.go('settings');
  }, app);
  return { el, onNav: (n) => menu.nav(n) };
}

// ---------------------------------------------------------------------------
// Team select
// ---------------------------------------------------------------------------

export function TeamSelectScreen(app, params) {
  const mode = params.mode || 'quick';
  let side = 0; // 0 = picking your team, 1 = picking opponent (quick/versus)
  let picks = [0, 1];
  const el = h(`
    <section class="screen teamselect">
      <header class="screen-head"><h1>${mode === 'career' ? 'PICK YOUR CREW' : mode === 'versus' ? 'PICK THE MATCHUP' : 'PICK YOUR CREW'}</h1><div class="head-sub">${mode === 'career' ? 'You run with them all the way to the top.' : 'Left/Right to browse · Enter to lock in'}</div></header>
      <div class="ts-body">
        <div class="ts-side ts-left"><div class="ts-label">${mode === 'versus' ? 'HOME' : 'YOU'}</div><div class="ts-card"></div></div>
        <div class="ts-vs">VS</div>
        <div class="ts-side ts-right"><div class="ts-label">${mode === 'career' ? 'FIRST OPPONENT' : 'CPU'}</div><div class="ts-card"></div></div>
      </div>
      <div class="ts-grid">${TEAMS.map((t, i) => `<button class="ts-chip" data-i="${i}" style="--c1:${t.primary};--c3:${t.accent}">${t.abbr}</button>`).join('')}</div>
      <footer class="screen-foot">
        <div class="foot-left"><span class="key">◀ ▶</span> browse <span class="key">▲ ▼</span> switch side <span class="key">ENTER</span> lock in <span class="key">ESC</span> back</div>
        <div class="foot-right">
          <label>DIFFICULTY <select class="diff-sel">${Object.entries(DIFFICULTY).map(([k, v]) => `<option value="${k}" ${app.state.settings.difficulty === k ? 'selected' : ''} ${k === 'legend' && !app.state.unlocked.legendMode && false ? 'disabled' : ''}>${v.label}</option>`).join('')}</select></label>
          <button class="btn primary start-btn">${mode === 'career' ? 'START THE RUN' : 'BALL UP'}</button>
        </div>
      </footer>
    </section>`);
  const cards = [el.querySelector('.ts-left .ts-card'), el.querySelector('.ts-right .ts-card')];
  const sides = [el.querySelector('.ts-left'), el.querySelector('.ts-right')];
  const chips = Array.from(el.querySelectorAll('.ts-chip'));
  const render = () => {
    if (mode === 'career') {
      const oppLadder = TEAMS.filter((t) => t.id !== TEAMS[picks[0]].id).sort((a, b) => teamOverall(a) - teamOverall(b));
      picks[1] = TEAMS.indexOf(oppLadder[0]);
    }
    cards[0].innerHTML = teamCard(TEAMS[picks[0]]);
    cards[1].innerHTML = teamCard(TEAMS[picks[1]], { cls: 'cpu' });
    sides.forEach((s, i) => s.classList.toggle('active', i === side));
    chips.forEach((c, i) => {
      c.classList.toggle('sel-a', i === picks[0]);
      c.classList.toggle('sel-b', i === picks[1]);
    });
  };
  const cycle = (dir) => {
    let n = picks[side];
    do n = (n + dir + TEAMS.length) % TEAMS.length;
    while (n === picks[1 - side]);
    picks[side] = n;
    app.audio.uiMove();
    render();
  };
  chips.forEach((c) =>
    c.addEventListener('click', () => {
      const i = parseInt(c.dataset.i, 10);
      if (i === picks[1 - side]) return;
      picks[side] = i;
      app.audio.uiMove();
      render();
    }),
  );
  sides.forEach((s, i) =>
    s.addEventListener('click', () => {
      if (mode === 'career' && i === 1) return;
      side = i;
      render();
    }),
  );
  const start = () => {
    app.audio.uiConfirm();
    app.state.settings.difficulty = el.querySelector('.diff-sel').value;
    app.save();
    const home = TEAMS[picks[0]];
    const away = TEAMS[picks[1]];
    if (mode === 'career') app.startCareer(home.id);
    else app.startMatch({ home, away, userTeam: mode === 'versus' ? null : 0, mode });
  };
  el.querySelector('.start-btn').addEventListener('click', start);
  el.querySelector('.diff-sel').addEventListener('change', (e) => {
    app.state.settings.difficulty = e.target.value;
    app.save();
  });
  render();
  return {
    el,
    onNav(n) {
      if (n.left) cycle(-1);
      if (n.right) cycle(1);
      if ((n.up || n.down) && mode !== 'career') {
        side = 1 - side;
        app.audio.uiMove();
        render();
      }
      if (n.confirm) start();
      if (n.back) {
        app.audio.uiBack();
        app.go('title');
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Career hub
// ---------------------------------------------------------------------------

export function CareerScreen(app) {
  const c = app.state.career;
  const team = TEAM_BY_ID[c.teamId];
  const opp = currentOpponent(c);
  const ladder = c.ladder
    .map((id, i) => {
      const t = TEAM_BY_ID[id];
      const st = i < c.stage ? 'done' : i === c.stage ? 'now' : 'locked';
      return `<li class="ladder-item ${st}" style="--c1:${t.primary};--c3:${t.accent}"><span class="li-n">${i + 1}</span><span class="li-abbr">${t.abbr}</span><span class="li-name">${t.city} ${t.name}</span><span class="li-ovr">OVR ${teamOverall(t)}</span><span class="li-state">${st === 'done' ? 'BEAT' : st === 'now' ? 'NEXT' : ''}</span></li>`;
    })
    .join('');
  const el = h(`
    <section class="screen career" style="--c1:${team.primary};--c2:${team.secondary};--c3:${team.accent}">
      <header class="screen-head"><h1>RUN THE STREETS</h1><div class="head-sub">${team.city} ${team.name} · ${careerTitle(c)} · REP ${c.rep} · ${c.wins}W ${c.losses}L</div></header>
      <div class="career-body">
        <div class="career-left">
          <div class="career-next">
            ${c.complete ? `<div class="cn-title">YOU RUN THIS CITY</div><div class="cn-sub">Every crew beaten. Legend difficulty unlocked.</div>` : `<div class="cn-title">NEXT UP</div>${teamCard(opp, { cls: 'cpu' })}<div class="cn-court">@ ${opp.city.toUpperCase()} · THEIR COURT</div>`}
          </div>
          ${menuList([
            ...(c.complete ? [] : [{ action: 'play', label: 'PLAY NEXT GAME', sub: `${DIFFICULTY[c.difficulty].label} difficulty` }]),
            { action: 'roster', label: 'MY CREW' },
            { action: 'abandon', label: 'ABANDON RUN', sub: 'Deletes career progress' },
            { action: 'back', label: 'BACK' },
          ])}
        </div>
        <div class="career-right"><div class="ladder-title">THE LADDER</div><ol class="ladder">${ladder}</ol></div>
      </div>
    </section>`);
  const menu = wireMenu(el, (action) => {
    if (action === 'play') app.startMatch({ home: opp, away: team, userTeam: 1, mode: 'career' });
    else if (action === 'roster') app.go('roster', { teamId: team.id, back: 'career' });
    else if (action === 'abandon') {
      if (confirm('Abandon this run? Progress will be deleted.')) {
        app.state.career = null;
        app.save();
        app.go('title');
      }
    } else if (action === 'back') app.go('title');
  }, app);
  return {
    el,
    onNav(n) {
      menu.nav(n);
      if (n.back) app.go('title');
    },
  };
}

// ---------------------------------------------------------------------------
// Roster viewer
// ---------------------------------------------------------------------------

export function RosterScreen(app, params) {
  const team = TEAM_BY_ID[params.teamId];
  const bars = (p) => ['spd', 'shot', 'hnd', 'dnk', 'pas', 'stl', 'blk', 'pow'].map((k) => `<div class="stat"><span class="stat-k">${k.toUpperCase()}</span><div class="stat-bar"><div style="width:${p[k]}%"></div></div><span class="stat-v">${p[k]}</span></div>`).join('');
  const el = h(`
    <section class="screen roster" style="--c1:${team.primary};--c2:${team.secondary};--c3:${team.accent}">
      <header class="screen-head"><h1>${team.city.toUpperCase()} ${team.name.toUpperCase()}</h1><div class="head-sub">“${team.motto}” · OVR ${teamOverall(team)}</div></header>
      <div class="roster-grid">
        ${team.roster.map((p, i) => `<div class="pcard-big ${i < 3 ? 'starter' : 'sub'}"><div class="pb-num">#${p.number}</div><div class="pb-nick">${p.nick}</div><div class="pb-name">${p.name}</div><div class="pb-arch">${p.archetype} · OVR ${playerOverall(p)}</div><div class="pb-sig">GB: ${p.signature}</div><div class="pb-stats">${bars(p)}</div></div>`).join('')}
      </div>
      <footer class="screen-foot"><button class="btn back-btn">BACK</button></footer>
    </section>`);
  el.querySelector('.back-btn').addEventListener('click', () => app.go(params.back || 'title'));
  return { el, onNav: (n) => (n.back || n.confirm) && app.go(params.back || 'title') };
}

// ---------------------------------------------------------------------------
// How to play
// ---------------------------------------------------------------------------

export function HowToScreen(app) {
  const el = h(`
    <section class="screen howto">
      <header class="screen-head"><h1>HOW TO PLAY</h1><div class="head-sub">Street rules. Style wins games.</div></header>
      <div class="howto-cols">
        <div class="howto-col">
          <h2>RULES</h2>
          <ul>
            <li><b>First to 21, win by 2.</b> Inside the arc = 1. Outside = 2.</li>
            <li><b>20-second shot clock.</b> Rim resets it.</li>
            <li><b>Clear it.</b> After a steal or defensive board, take the ball outside the arc before you score.</li>
            <li><b>No refs.</b> Shove people. Break ankles. Nobody's calling anything.</li>
          </ul>
          <h2>STYLE & GAMEBREAKER</h2>
          <ul>
            <li>Tricks, ankle breakers, dunks, blocks, steals and alley-oops earn <b>Style</b>.</li>
            <li>Chain tricks fast for a <b>combo multiplier</b>. Turnovers drain it.</li>
            <li>Fill the meter and press <b>E</b> (LT+RT) with the ball to unleash a <b>GAMEBREAKER</b>: an unstoppable slam that adds to your score <b>and subtracts from theirs</b>.</li>
            <li>Three straight buckets and your crew is <b>ON FIRE</b>.</li>
          </ul>
        </div>
        <div class="howto-col">
          <h2>CONTROLS</h2>
          <table class="ctrl">
            <tr><th></th><th>KEYBOARD</th><th>GAMEPAD</th></tr>
            <tr><td>Move</td><td>WASD / Arrows</td><td>Left stick</td></tr>
            <tr><td>Turbo</td><td>SHIFT</td><td>RT / RB</td></tr>
            <tr><td>Shoot (hold, release at the top)</td><td>J / SPACE</td><td>A / ✕</td></tr>
            <tr><td>Pass · Alley-oop (hold turbo)</td><td>K</td><td>X / ▢</td></tr>
            <tr><td>Trick (with ball) / Steal (defense)</td><td>L</td><td>B / ○</td></tr>
            <tr><td>Shove</td><td>I</td><td>Y / △</td></tr>
            <tr><td>Jump / Block</td><td>U or J on defense</td><td>A / ✕ on defense</td></tr>
            <tr><td>Switch player</td><td>Q / TAB</td><td>LB</td></tr>
            <tr><td>Gamebreaker</td><td>E</td><td>LT + RT</td></tr>
            <tr><td>Pause</td><td>ESC</td><td>START</td></tr>
          </table>
          <h2>TIPS</h2>
          <ul>
            <li>Hold direction + trick with <b>turbo</b> for a bigger move and a better shot at breaking ankles.</li>
            <li>Release your jumper at the <b>top</b> of the jump for a PERFECT — it matters more than the shooter's rating.</li>
            <li>Turbo is shared between running and tricks. Empty meter = slow you.</li>
            <li>Big men block. Handlers steal. Snipers shoot. Play your crew.</li>
          </ul>
        </div>
      </div>
      <footer class="screen-foot"><button class="btn back-btn">BACK</button></footer>
    </section>`);
  el.querySelector('.back-btn').addEventListener('click', () => app.go('title'));
  return { el, onNav: (n) => (n.back || n.confirm) && app.go('title') };
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export function SettingsScreen(app, params = {}) {
  const s = app.state.settings;
  const row = (key, label, kind, opts) => {
    if (kind === 'range') return `<div class="set-row" data-key="${key}"><span class="set-label">${label}</span><input type="range" min="0" max="1" step="0.05" value="${s[key]}"><span class="set-val">${Math.round(s[key] * 100)}%</span></div>`;
    if (kind === 'select') return `<div class="set-row" data-key="${key}"><span class="set-label">${label}</span><select>${opts.map((o) => `<option value="${o[0]}" ${s[key] === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select></div>`;
    if (kind === 'toggle') return `<div class="set-row" data-key="${key}"><span class="set-label">${label}</span><input type="checkbox" ${s[key] ? 'checked' : ''}></div>`;
    return '';
  };
  const el = h(`
    <section class="screen settings">
      <header class="screen-head"><h1>SETTINGS</h1><div class="head-sub">Saved automatically</div></header>
      <div class="set-list">
        ${row('masterVolume', 'MASTER VOLUME', 'range')}
        ${row('musicVolume', 'MUSIC', 'range')}
        ${row('sfxVolume', 'SFX & CROWD', 'range')}
        ${row('quality', 'GRAPHICS', 'select', [['low', 'LOW (no shadows / bloom)'], ['medium', 'MEDIUM'], ['high', 'HIGH']])}
        ${row('difficulty', 'DEFAULT DIFFICULTY', 'select', Object.entries(DIFFICULTY).map(([k, v]) => [k, v.label]))}
        ${row('commentary', 'COMMENTARY', 'toggle')}
        ${row('screenShake', 'SCREEN SHAKE', 'toggle')}
      </div>
      <div class="set-actions"><button class="btn danger reset-btn">RESET ALL DATA</button><button class="btn back-btn">BACK</button></div>
    </section>`);
  el.querySelectorAll('.set-row').forEach((r) => {
    const key = r.dataset.key;
    const input = r.querySelector('input,select');
    input.addEventListener('input', () => {
      if (input.type === 'range') {
        s[key] = parseFloat(input.value);
        r.querySelector('.set-val').textContent = `${Math.round(s[key] * 100)}%`;
        app.audio.applyVolumes();
        if (key !== 'musicVolume') app.audio.uiMove();
      } else if (input.type === 'checkbox') s[key] = input.checked;
      else s[key] = input.value;
      app.save();
    });
  });
  el.querySelector('.back-btn').addEventListener('click', () => app.go(params.back || 'title'));
  el.querySelector('.reset-btn').addEventListener('click', () => {
    if (confirm('Delete all saved data (career, records, settings)?')) app.resetAll();
  });
  return { el, onNav: (n) => n.back && app.go(params.back || 'title') };
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

export function ResultsScreen(app, params) {
  const { sim, mode, userTeam, careerResult } = params;
  const [h0, a0] = sim.teams;
  const won = userTeam === null ? null : sim.winner === userTeam;
  const rows = (team) =>
    sim
      .teamPlayers(team)
      .map((p) => `<tr><td class="r-name"><b>${p.data.nick}</b> ${p.data.name}</td><td>${p.stats.pts}</td><td>${p.stats.fgm}/${p.stats.fga}</td><td>${p.stats.dunks}</td><td>${p.stats.ast}</td><td>${p.stats.stl}</td><td>${p.stats.blk}</td><td>${p.stats.ankles}</td><td class="r-style">${p.stats.style}</td></tr>`)
      .join('');
  const mvp = [...sim.players].sort((a, b) => b.stats.style + b.stats.pts * 40 - (a.stats.style + a.stats.pts * 40))[0];
  const el = h(`
    <section class="screen results" style="--c1:${sim.teams[sim.winner].primary};--c3:${sim.teams[sim.winner].accent}">
      <div class="res-head">
        <div class="res-verdict">${won === null ? 'FINAL' : won ? 'YOU RUN THE COURT' : 'RUN IT BACK'}</div>
        <div class="res-score"><span class="rs-team" style="--c1:${h0.primary}">${h0.abbr}</span><span class="rs-num">${sim.score[0]}</span><span class="rs-dash">–</span><span class="rs-num">${sim.score[1]}</span><span class="rs-team" style="--c1:${a0.primary}">${a0.abbr}</span></div>
        <div class="res-sub">${sim.teams[sim.winner].city.toUpperCase()} ${sim.teams[sim.winner].name.toUpperCase()} WIN · GAME MVP: ${mvp.data.nick} (${mvp.stats.pts} PTS · ${mvp.stats.style} STYLE)</div>
        ${careerResult ? `<div class="res-career">${careerResult}</div>` : ''}
      </div>
      <div class="res-tables">
        ${[0, 1].map((t) => `<table class="box" style="--c1:${sim.teams[t].primary};--c3:${sim.teams[t].accent}"><thead><tr><th class="r-name">${sim.teams[t].city.toUpperCase()} ${sim.teams[t].name.toUpperCase()}</th><th>PTS</th><th>FG</th><th>DNK</th><th>AST</th><th>STL</th><th>BLK</th><th>ANK</th><th>STYLE</th></tr></thead><tbody>${rows(t)}</tbody></table>`).join('')}
      </div>
      ${menuList([
        ...(mode === 'career' ? [{ action: 'career', label: 'BACK TO THE STREETS' }] : [{ action: 'rematch', label: 'RUN IT BACK', sub: 'Same matchup' }, { action: 'teamselect', label: 'NEW MATCHUP' }]),
        { action: 'title', label: 'MAIN MENU' },
      ])}
    </section>`);
  const menu = wireMenu(el, (action) => {
    if (action === 'rematch') app.startMatch({ home: h0, away: a0, userTeam, mode });
    else if (action === 'teamselect') app.go('teamselect', { mode });
    else if (action === 'career') app.go('career');
    else app.go('title');
  }, app);
  return { el, onNav: (n) => menu.nav(n) };
}

// ---------------------------------------------------------------------------
// Pause overlay (rendered above the match)
// ---------------------------------------------------------------------------

export function PauseOverlay(app, { onResume, onQuit, onRestart }) {
  const el = h(`
    <div class="pause">
      <div class="pause-box">
        <div class="pause-title">PAUSED</div>
        ${menuList([
          { action: 'resume', label: 'RESUME' },
          { action: 'controls', label: 'CONTROLS' },
          { action: 'settings', label: 'SETTINGS' },
          ...(onRestart ? [{ action: 'restart', label: 'RESTART GAME' }] : []),
          { action: 'quit', label: 'QUIT TO MENU' },
        ])}
        <div class="pause-controls hidden">
          <div><b>WASD</b> move · <b>SHIFT</b> turbo · <b>J/SPACE</b> shoot (release at the top) · <b>K</b> pass (<b>+SHIFT</b> alley-oop)</div>
          <div><b>L</b> trick / steal · <b>I</b> shove · <b>U</b> jump/block · <b>Q</b> switch · <b>E</b> Gamebreaker</div>
        </div>
      </div>
    </div>`);
  const menu = wireMenu(el, (action) => {
    if (action === 'resume') onResume();
    else if (action === 'quit') onQuit();
    else if (action === 'restart') onRestart();
    else if (action === 'controls') el.querySelector('.pause-controls').classList.toggle('hidden');
    else if (action === 'settings') app.openSettingsOverlay();
  }, app);
  return { el, onNav: (n) => menu.nav(n) };
}
