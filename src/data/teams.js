/**
 * BLITZBALL X league — original IP.
 * Eight crews, three starters + one sub each. Ratings 40–99.
 *
 * Attribute key:
 *  spd  speed / acceleration        shot  outside shooting
 *  hnd  handles (tricks, ball security)  dnk  finishing at the rim / slams
 *  pas  passing                      stl  steals / on-ball defense
 *  blk  blocks / rebounding          pow  strength (shoves, contact finishes)
 *  gb   how fast the Gamebreaker meter fills (style multiplier)
 */

export const ARCHETYPES = {
  FINISHER: 'Finisher',
  SNIPER: 'Sniper',
  HANDLER: 'Handler',
  ENFORCER: 'Enforcer',
  RIMGUARD: 'Rim Guard',
  ALLROUND: 'All-Around',
};

const P = (id, name, nick, archetype, num, skin, hair, stats, sig) => ({
  id,
  name,
  nick,
  archetype,
  number: num,
  skin, // 0..3 palette index
  hair, // style index
  ...stats,
  signature: sig, // signature Gamebreaker flavor text
});

export const TEAMS = [
  {
    id: 'dockside_kraken',
    name: 'Kraken',
    city: 'Dockside',
    abbr: 'DCK',
    primary: '#12b5b0',
    secondary: '#0b1c2c',
    accent: '#f5f0e6',
    court: 'harbor',
    motto: 'Tides don’t lose.',
    roster: [
      P('kraken_1', 'Marlo Vance', 'THE TIDE', ARCHETYPES.HANDLER, 7, 2, 1, { spd: 88, shot: 74, hnd: 95, dnk: 62, pas: 90, stl: 80, blk: 40, pow: 55, gb: 92 }, 'Riptide Crossover'),
      P('kraken_2', 'Dez Okoro', 'ANCHOR', ARCHETYPES.RIMGUARD, 34, 3, 3, { spd: 60, shot: 42, hnd: 48, dnk: 84, pas: 58, stl: 55, blk: 94, pow: 91, gb: 70 }, 'Deep Six Slam'),
      P('kraken_3', 'Sable Reyes', 'SLINGER', ARCHETYPES.SNIPER, 11, 1, 5, { spd: 76, shot: 92, hnd: 70, dnk: 50, pas: 72, stl: 62, blk: 45, pow: 50, gb: 78 }, 'Harbor Light Three'),
      P('kraken_4', 'Tomas Greer', 'PIER', ARCHETYPES.ALLROUND, 22, 0, 2, { spd: 70, shot: 66, hnd: 66, dnk: 66, pas: 68, stl: 66, blk: 62, pow: 64, gb: 64 }, 'Undertow Floater'),
    ],
  },
  {
    id: 'ninth_street_saints',
    name: 'Saints',
    city: 'Ninth Street',
    abbr: 'NSS',
    primary: '#f2c230',
    secondary: '#1a1a1a',
    accent: '#ffffff',
    court: 'rooftop',
    motto: 'Every block is holy ground.',
    roster: [
      P('saints_1', 'Andre "Halo" Pike', 'HALO', ARCHETYPES.SNIPER, 3, 3, 0, { spd: 78, shot: 96, hnd: 78, dnk: 55, pas: 76, stl: 58, blk: 42, pow: 48, gb: 85 }, 'Rooftop Rainmaker'),
      P('saints_2', 'Bishop Cole', 'BISHOP', ARCHETYPES.ENFORCER, 50, 2, 3, { spd: 64, shot: 52, hnd: 58, dnk: 88, pas: 60, stl: 70, blk: 82, pow: 95, gb: 68 }, 'Excommunication Dunk'),
      P('saints_3', 'Lola Marquez', 'CHOIR', ARCHETYPES.HANDLER, 1, 1, 4, { spd: 92, shot: 70, hnd: 90, dnk: 58, pas: 88, stl: 84, blk: 38, pow: 46, gb: 88 }, 'Hymn Hesitation'),
      P('saints_4', 'Ike Waller', 'DEACON', ARCHETYPES.ALLROUND, 14, 0, 1, { spd: 68, shot: 68, hnd: 64, dnk: 70, pas: 66, stl: 64, blk: 66, pow: 68, gb: 62 }, 'Sunday Spin'),
    ],
  },
  {
    id: 'ironworks_forge',
    name: 'Forge',
    city: 'Ironworks',
    abbr: 'IRN',
    primary: '#ff5a1f',
    secondary: '#2b2b2b',
    accent: '#ffd9c2',
    court: 'foundry',
    motto: 'Built, not born.',
    roster: [
      P('forge_1', 'Gus Petrov', 'FURNACE', ARCHETYPES.ENFORCER, 44, 0, 3, { spd: 58, shot: 48, hnd: 52, dnk: 92, pas: 56, stl: 60, blk: 90, pow: 99, gb: 72 }, 'Blast Furnace Slam'),
      P('forge_2', 'Kiana Holt', 'RIVET', ARCHETYPES.HANDLER, 9, 3, 4, { spd: 90, shot: 76, hnd: 88, dnk: 60, pas: 84, stl: 78, blk: 40, pow: 52, gb: 84 }, 'Rivet Gun Runner'),
      P('forge_3', 'Emil Strand', 'SMOKESTACK', ARCHETYPES.RIMGUARD, 55, 1, 2, { spd: 62, shot: 55, hnd: 50, dnk: 85, pas: 60, stl: 58, blk: 92, pow: 88, gb: 66 }, 'Smokestack Swat'),
      P('forge_4', 'Roy Amadi', 'INGOT', ARCHETYPES.SNIPER, 21, 2, 0, { spd: 72, shot: 86, hnd: 66, dnk: 52, pas: 70, stl: 60, blk: 44, pow: 56, gb: 70 }, 'Molten Range'),
    ],
  },
  {
    id: 'neon_district_volt',
    name: 'Volt',
    city: 'Neon District',
    abbr: 'NEO',
    primary: '#c026ff',
    secondary: '#0d0620',
    accent: '#5cf2ff',
    court: 'neon',
    motto: 'Too fast to film.',
    roster: [
      P('volt_1', 'Jax Kimura', 'LIVEWIRE', ARCHETYPES.HANDLER, 0, 1, 5, { spd: 99, shot: 72, hnd: 97, dnk: 68, pas: 86, stl: 82, blk: 36, pow: 44, gb: 95 }, 'Short Circuit Shake'),
      P('volt_2', 'Priya Shah', 'PULSE', ARCHETYPES.SNIPER, 23, 2, 4, { spd: 82, shot: 90, hnd: 80, dnk: 54, pas: 78, stl: 66, blk: 40, pow: 46, gb: 82 }, 'Neon Pull-Up'),
      P('volt_3', 'Big Ray Dunlap', 'BREAKER', ARCHETYPES.RIMGUARD, 88, 3, 3, { spd: 66, shot: 40, hnd: 46, dnk: 90, pas: 54, stl: 56, blk: 88, pow: 90, gb: 68 }, 'Circuit Breaker Jam'),
      P('volt_4', 'Nico Alder', 'STATIC', ARCHETYPES.ALLROUND, 12, 0, 1, { spd: 74, shot: 66, hnd: 70, dnk: 64, pas: 70, stl: 68, blk: 58, pow: 58, gb: 66 }, 'Static Stepback'),
    ],
  },
  {
    id: 'south_yard_kings',
    name: 'Kings',
    city: 'South Yard',
    abbr: 'SYK',
    primary: '#e8232a',
    secondary: '#111111',
    accent: '#f5d76e',
    court: 'projects',
    motto: 'Crowned in concrete.',
    roster: [
      P('kings_1', 'Terrence "Trey" Moss', 'TREY', ARCHETYPES.ALLROUND, 33, 3, 2, { spd: 86, shot: 84, hnd: 86, dnk: 84, pas: 80, stl: 76, blk: 60, pow: 72, gb: 90 }, 'Coronation Windmill'),
      P('kings_2', 'Manny Ortiz', 'SCEPTER', ARCHETYPES.SNIPER, 5, 1, 0, { spd: 74, shot: 91, hnd: 72, dnk: 52, pas: 74, stl: 60, blk: 42, pow: 50, gb: 76 }, 'Royal Rainbow'),
      P('kings_3', 'Deshawn Boyd', 'THRONE', ARCHETYPES.ENFORCER, 41, 3, 3, { spd: 62, shot: 50, hnd: 54, dnk: 90, pas: 58, stl: 66, blk: 86, pow: 94, gb: 70 }, 'Throne Room Tomahawk'),
      P('kings_4', 'Alvin Cho', 'PAGE', ARCHETYPES.HANDLER, 2, 1, 5, { spd: 84, shot: 66, hnd: 84, dnk: 56, pas: 82, stl: 74, blk: 38, pow: 48, gb: 74 }, 'Court Jester Cross'),
    ],
  },
  {
    id: 'blacktop_phantoms',
    name: 'Phantoms',
    city: 'Blacktop Hollow',
    abbr: 'BTP',
    primary: '#8a8f99',
    secondary: '#0a0a0c',
    accent: '#c8ff3d',
    court: 'underpass',
    motto: 'You never saw us.',
    roster: [
      P('phantom_1', 'Silas Wren', 'GHOST', ARCHETYPES.HANDLER, 13, 0, 1, { spd: 94, shot: 78, hnd: 93, dnk: 64, pas: 84, stl: 88, blk: 42, pow: 50, gb: 88 }, 'Vanishing Act'),
      P('phantom_2', 'Nadia Ferro', 'WRAITH', ARCHETYPES.SNIPER, 31, 2, 4, { spd: 80, shot: 88, hnd: 76, dnk: 50, pas: 76, stl: 72, blk: 44, pow: 46, gb: 80 }, 'Cold Spot Jumper'),
      P('phantom_3', 'Otto Brandt', 'POLTERGEIST', ARCHETYPES.RIMGUARD, 66, 1, 3, { spd: 64, shot: 46, hnd: 50, dnk: 86, pas: 56, stl: 62, blk: 91, pow: 87, gb: 66 }, 'Haunted Rejection'),
      P('phantom_4', 'Cass Idris', 'ECHO', ARCHETYPES.ALLROUND, 8, 3, 2, { spd: 72, shot: 68, hnd: 68, dnk: 66, pas: 70, stl: 70, blk: 60, pow: 60, gb: 64 }, 'Echo Chamber Spin'),
    ],
  },
  {
    id: 'sunset_pier_breakers',
    name: 'Breakers',
    city: 'Sunset Pier',
    abbr: 'SSP',
    primary: '#ff8a3d',
    secondary: '#123c5a',
    accent: '#ffe07a',
    court: 'beach',
    motto: 'Sand in your shoes, L on your record.',
    roster: [
      P('breakers_1', 'Kai Moana', 'BIG WAVE', ARCHETYPES.FINISHER, 10, 2, 2, { spd: 84, shot: 62, hnd: 78, dnk: 96, pas: 66, stl: 64, blk: 70, pow: 82, gb: 86 }, 'Pipeline Posterizer'),
      P('breakers_2', 'Rosa Delgado', 'SUNSHINE', ARCHETYPES.SNIPER, 4, 1, 4, { spd: 78, shot: 89, hnd: 74, dnk: 52, pas: 78, stl: 64, blk: 42, pow: 48, gb: 78 }, 'Golden Hour Three'),
      P('breakers_3', 'Bruno Sato', 'LIFEGUARD', ARCHETYPES.RIMGUARD, 77, 1, 0, { spd: 66, shot: 48, hnd: 52, dnk: 82, pas: 60, stl: 60, blk: 89, pow: 86, gb: 64 }, 'Riptide Rescue Block'),
      P('breakers_4', 'Lena Park', 'DRIFT', ARCHETYPES.HANDLER, 17, 1, 5, { spd: 88, shot: 70, hnd: 86, dnk: 56, pas: 84, stl: 76, blk: 38, pow: 46, gb: 76 }, 'Longboard Cross'),
    ],
  },
  {
    id: 'uptown_royals',
    name: 'Royals',
    city: 'Uptown',
    abbr: 'UPT',
    primary: '#3b5bff',
    secondary: '#f8f8ff',
    accent: '#ffd700',
    court: 'plaza',
    motto: 'Old money, new game.',
    roster: [
      P('royals_1', 'Victor Lang', 'THE BARON', ARCHETYPES.ALLROUND, 24, 0, 1, { spd: 82, shot: 86, hnd: 84, dnk: 80, pas: 84, stl: 74, blk: 64, pow: 70, gb: 88 }, 'Penthouse Fadeaway'),
      P('royals_2', 'Imani Cross', 'DUCHESS', ARCHETYPES.HANDLER, 6, 3, 4, { spd: 90, shot: 74, hnd: 92, dnk: 60, pas: 90, stl: 80, blk: 40, pow: 50, gb: 86 }, 'Velvet Rope Cross'),
      P('royals_3', 'Hank Bauer', 'BUTLER', ARCHETYPES.ENFORCER, 45, 0, 3, { spd: 60, shot: 50, hnd: 52, dnk: 88, pas: 60, stl: 62, blk: 88, pow: 93, gb: 66 }, 'Service Entrance Slam'),
      P('royals_4', 'Wes Trammel', 'HEIR', ARCHETYPES.SNIPER, 19, 2, 0, { spd: 74, shot: 87, hnd: 70, dnk: 54, pas: 72, stl: 60, blk: 44, pow: 52, gb: 72 }, 'Trust Fund Three'),
    ],
  },
];

export const TEAM_BY_ID = Object.fromEntries(TEAMS.map((t) => [t.id, t]));

export function playerOverall(p) {
  return Math.round(
    p.spd * 0.16 +
      p.shot * 0.15 +
      p.hnd * 0.14 +
      p.dnk * 0.14 +
      p.pas * 0.1 +
      p.stl * 0.11 +
      p.blk * 0.1 +
      p.pow * 0.1,
  );
}

export function teamOverall(team) {
  const starters = team.roster.slice(0, 3);
  return Math.round(starters.reduce((s, p) => s + playerOverall(p), 0) / starters.length);
}

export const PLAYER_BY_ID = Object.fromEntries(TEAMS.flatMap((t) => t.roster.map((p) => [p.id, { ...p, teamId: t.id }])));
