/**
 * BLITZBALL X league — original IP.
 * Eight crews, six swimmers each: three starting outfield swimmers, a keeper and two reserves.
 * Ratings 40–99.
 *
 * Attribute key (outfield swimmers):
 *  spd  swim speed / acceleration      sht  shooting power + accuracy
 *  hnd  handles (tricks, ball security) pas  passing
 *  tkl  tackles / on-ball defense       pow  strength (big hits, contact finishes)
 *  end  endurance (turbo tank)          gb   how fast the Gamebreaker meter fills
 *
 * Keeper-only attributes:
 *  cat  catching (save reach and save chance)
 *  blk  blocking (shot stopping)
 */

export const ARCHETYPES = {
  FINISHER: 'Finisher',
  SNIPER: 'Sniper',
  HANDLER: 'Handler',
  ENFORCER: 'Enforcer',
  GUARDIAN: 'Guardian',
  ALLROUND: 'All-Around',
};

const P = (id, name, nick, archetype, role, num, skin, hair, stats, sig) => ({
  id,
  name,
  nick,
  archetype,
  role, // FW | MF | DF | GK
  number: num,
  skin, // 0..3 palette index
  hair, // style index 0..5
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
    arena: 'harbor',
    motto: 'Tides don’t lose.',
    roster: [
      P('kraken_1', 'Marlo Vance', 'THE TIDE', ARCHETYPES.HANDLER, 'MF', 7, 2, 1, { spd: 88, sht: 71, hnd: 95, pas: 90, tkl: 80, pow: 56, end: 78, gb: 92, cat: 52, blk: 42 }, 'Riptide Crossover'),
      P('kraken_2', 'Dez Okoro', 'ANCHOR', ARCHETYPES.ENFORCER, 'DF', 34, 3, 3, { spd: 60, sht: 46, hnd: 52, pas: 58, tkl: 62, pow: 92, end: 88, gb: 70, cat: 58, blk: 94 }, 'Deep Six Slam'),
      P('kraken_3', 'Sable Reyes', 'SLINGER', ARCHETYPES.SNIPER, 'FW', 11, 1, 5, { spd: 76, sht: 92, hnd: 70, pas: 72, tkl: 62, pow: 51, end: 74, gb: 78, cat: 46, blk: 45 }, 'Harbor Light Three'),
      P('kraken_4', 'Ona Kelleher', 'BARNACLE', ARCHETYPES.GUARDIAN, 'GK', 1, 0, 2, { spd: 62, sht: 44, hnd: 56, pas: 62, tkl: 58, pow: 84, end: 76, gb: 62, cat: 86, blk: 88 }, 'Tidal Wall'),
      P('kraken_5', 'Tomas Greer', 'PIER', ARCHETYPES.ALLROUND, 'DF', 22, 0, 2, { spd: 70, sht: 66, hnd: 66, pas: 68, tkl: 66, pow: 66, end: 70, gb: 64, cat: 50, blk: 62 }, 'Undertow Floater'),
      P('kraken_6', 'Junie Aldous', 'SEA SPRAY', ARCHETYPES.HANDLER, 'FW', 9, 3, 4, { spd: 82, sht: 64, hnd: 80, pas: 76, tkl: 66, pow: 50, end: 68, gb: 70, cat: 44, blk: 40 }, 'Spray Stepover'),
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
    arena: 'chapel',
    motto: 'Every block is holy ground.',
    roster: [
      P('saints_1', 'Andre “Halo” Pike', 'HALO', ARCHETYPES.SNIPER, 'FW', 3, 3, 0, { spd: 78, sht: 96, hnd: 78, pas: 76, tkl: 58, pow: 49, end: 72, gb: 85, cat: 46, blk: 42 }, 'Rooftop Rainmaker'),
      P('saints_2', 'Bishop Cole', 'BISHOP', ARCHETYPES.ENFORCER, 'DF', 50, 2, 3, { spd: 64, sht: 54, hnd: 58, pas: 60, tkl: 70, pow: 95, end: 86, gb: 68, cat: 56, blk: 82 }, 'Excommunication Slam'),
      P('saints_3', 'Lola Marquez', 'CHOIR', ARCHETYPES.HANDLER, 'MF', 4, 1, 4, { spd: 92, sht: 70, hnd: 90, pas: 88, tkl: 84, pow: 47, end: 80, gb: 88, cat: 50, blk: 40 }, 'Hymn Hesitation'),
      P('saints_4', 'Ruth Achebe', 'VESPERS', ARCHETYPES.GUARDIAN, 'GK', 1, 3, 1, { spd: 58, sht: 42, hnd: 52, pas: 64, tkl: 56, pow: 78, end: 74, gb: 60, cat: 88, blk: 84 }, 'Evening Prayer Save'),
      P('saints_5', 'Ike Waller', 'DEACON', ARCHETYPES.ALLROUND, 'FW', 14, 0, 1, { spd: 68, sht: 68, hnd: 64, pas: 66, tkl: 64, pow: 68, end: 68, gb: 62, cat: 48, blk: 46 }, 'Sunday Spin'),
      P('saints_6', 'Pia Nakamura', 'CANDLE', ARCHETYPES.SNIPER, 'MF', 21, 2, 5, { spd: 74, sht: 84, hnd: 72, pas: 74, tkl: 60, pow: 48, end: 66, gb: 74, cat: 44, blk: 42 }, 'Vigil Volley'),
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
    arena: 'foundry',
    motto: 'Built, not born.',
    roster: [
      P('forge_1', 'Gus Petrov', 'FURNACE', ARCHETYPES.ENFORCER, 'DF', 44, 0, 3, { spd: 58, sht: 48, hnd: 52, pas: 56, tkl: 60, pow: 99, end: 90, gb: 72, cat: 54, blk: 90 }, 'Blast Furnace Slam'),
      P('forge_2', 'Kiana Holt', 'RIVET', ARCHETYPES.HANDLER, 'MF', 9, 3, 4, { spd: 90, sht: 76, hnd: 88, pas: 84, tkl: 78, pow: 53, end: 78, gb: 84, cat: 48, blk: 40 }, 'Rivet Gun Runner'),
      P('forge_3', 'Emil Strand', 'SMOKESTACK', ARCHETYPES.ALLROUND, 'FW', 55, 1, 2, { spd: 68, sht: 62, hnd: 60, pas: 62, tkl: 64, pow: 74, end: 76, gb: 66, cat: 52, blk: 68 }, 'Smokestack Floater'),
      P('forge_4', 'Dagny Ruiz', 'CRUCIBLE', ARCHETYPES.GUARDIAN, 'GK', 1, 2, 0, { spd: 60, sht: 40, hnd: 48, pas: 58, tkl: 62, pow: 88, end: 78, gb: 62, cat: 84, blk: 92 }, 'Molten Wall'),
      P('forge_5', 'Roy Amadi', 'INGOT', ARCHETYPES.SNIPER, 'FW', 21, 2, 0, { spd: 72, sht: 86, hnd: 66, pas: 70, tkl: 60, pow: 57, end: 70, gb: 70, cat: 44, blk: 40 }, 'Molten Range'),
      P('forge_6', 'Bex Lorne', 'SLAG', ARCHETYPES.ENFORCER, 'DF', 33, 1, 1, { spd: 62, sht: 46, hnd: 50, pas: 54, tkl: 72, pow: 88, end: 82, gb: 60, cat: 50, blk: 76 }, 'Slag Heap Shove'),
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
    arena: 'neon',
    motto: 'Too fast to film.',
    roster: [
      P('volt_1', 'Jax Kimura', 'LIVEWIRE', ARCHETYPES.HANDLER, 'MF', 0, 1, 5, { spd: 99, sht: 72, hnd: 97, pas: 86, tkl: 82, pow: 45, end: 84, gb: 95, cat: 48, blk: 40 }, 'Short Circuit Shake'),
      P('volt_2', 'Priya Shah', 'PULSE', ARCHETYPES.SNIPER, 'FW', 23, 2, 4, { spd: 82, sht: 90, hnd: 80, pas: 78, tkl: 66, pow: 47, end: 74, gb: 82, cat: 46, blk: 40 }, 'Neon Pull-Up'),
      P('volt_3', 'Big Ray Dunlap', 'BREAKER', ARCHETYPES.ALLROUND, 'DF', 88, 3, 3, { spd: 70, sht: 52, hnd: 54, pas: 58, tkl: 68, pow: 90, end: 86, gb: 68, cat: 54, blk: 88 }, 'Circuit Breaker Jam'),
      P('volt_4', 'Suri Vasquez', 'DYNAMO', ARCHETYPES.GUARDIAN, 'GK', 1, 0, 2, { spd: 66, sht: 42, hnd: 54, pas: 60, tkl: 58, pow: 76, end: 80, gb: 58, cat: 85, blk: 83 }, 'Blackout Grab'),
      P('volt_5', 'Nico Alder', 'STATIC', ARCHETYPES.ALLROUND, 'DF', 12, 0, 1, { spd: 74, sht: 66, hnd: 70, pas: 70, tkl: 68, pow: 58, end: 68, gb: 66, cat: 52, blk: 58 }, 'Static Stepback'),
      P('volt_6', 'Lux Ibarra', 'ARC', ARCHETYPES.FINISHER, 'FW', 7, 2, 5, { spd: 86, sht: 74, hnd: 78, pas: 68, tkl: 62, pow: 60, end: 66, gb: 78, cat: 44, blk: 44 }, 'Arc Flash Finish'),
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
    arena: 'yard',
    motto: 'Crowned in concrete.',
    roster: [
      P('kings_1', 'Terrence “Trey” Moss', 'TREY', ARCHETYPES.ALLROUND, 'FW', 33, 3, 2, { spd: 86, sht: 84, hnd: 86, pas: 80, tkl: 76, pow: 74, end: 80, gb: 90, cat: 50, blk: 60 }, 'Coronation Finish'),
      P('kings_2', 'Manny Ortiz', 'SCEPTER', ARCHETYPES.SNIPER, 'FW', 5, 1, 0, { spd: 74, sht: 91, hnd: 72, pas: 74, tkl: 60, pow: 51, end: 72, gb: 76, cat: 46, blk: 42 }, 'Royal Rainbow'),
      P('kings_3', 'Deshawn Boyd', 'THRONE', ARCHETYPES.ENFORCER, 'DF', 41, 3, 3, { spd: 62, sht: 50, hnd: 54, pas: 58, tkl: 66, pow: 94, end: 88, gb: 70, cat: 52, blk: 86 }, 'Throne Room Slam'),
      P('kings_4', 'Ines Duval', 'REGENT', ARCHETYPES.GUARDIAN, 'GK', 1, 1, 4, { spd: 60, sht: 44, hnd: 50, pas: 62, tkl: 60, pow: 80, end: 78, gb: 60, cat: 87, blk: 85 }, 'Crown Jewel Stop'),
      P('kings_5', 'Alvin Cho', 'PAGE', ARCHETYPES.HANDLER, 'MF', 2, 1, 5, { spd: 84, sht: 66, hnd: 84, pas: 82, tkl: 74, pow: 49, end: 74, gb: 74, cat: 48, blk: 40 }, 'Court Jester Cross'),
      P('kings_6', 'Rolo Mbeki', 'CROWN', ARCHETYPES.FINISHER, 'MF', 18, 0, 1, { spd: 78, sht: 76, hnd: 74, pas: 72, tkl: 64, pow: 70, end: 70, gb: 72, cat: 44, blk: 48 }, 'Heavy Headed Finish'),
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
    arena: 'hollow',
    motto: 'You never saw us.',
    roster: [
      P('phantom_1', 'Silas Wren', 'GHOST', ARCHETYPES.HANDLER, 'MF', 13, 0, 1, { spd: 94, sht: 78, hnd: 93, pas: 84, tkl: 88, pow: 51, end: 80, gb: 88, cat: 50, blk: 42 }, 'Vanishing Act'),
      P('phantom_2', 'Nadia Ferro', 'WRAITH', ARCHETYPES.SNIPER, 'FW', 31, 2, 4, { spd: 80, sht: 88, hnd: 76, pas: 76, tkl: 72, pow: 47, end: 74, gb: 80, cat: 46, blk: 44 }, 'Cold Spot Jumper'),
      P('phantom_3', 'Otto Brandt', 'POLTERGEIST', ARCHETYPES.ALLROUND, 'DF', 66, 1, 3, { spd: 64, sht: 48, hnd: 52, pas: 58, tkl: 62, pow: 87, end: 86, gb: 66, cat: 54, blk: 91 }, 'Haunted Rejection'),
      P('phantom_4', 'Esme Lark', 'SEANCE', ARCHETYPES.GUARDIAN, 'GK', 1, 3, 2, { spd: 64, sht: 40, hnd: 50, pas: 58, tkl: 56, pow: 74, end: 76, gb: 56, cat: 89, blk: 80 }, 'Séance Snatch'),
      P('phantom_5', 'Cass Idris', 'ECHO', ARCHETYPES.ALLROUND, 'FW', 8, 3, 2, { spd: 72, sht: 68, hnd: 68, pas: 70, tkl: 70, pow: 60, end: 68, gb: 64, cat: 48, blk: 46 }, 'Echo Chamber Spin'),
      P('phantom_6', 'Bo Nakamura', 'SHADE', ARCHETYPES.ENFORCER, 'DF', 27, 0, 0, { spd: 66, sht: 50, hnd: 56, pas: 60, tkl: 74, pow: 86, end: 82, gb: 62, cat: 52, blk: 74 }, 'Shadow Shove'),
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
    arena: 'pier',
    motto: 'Sand in your shoes, L on your record.',
    roster: [
      P('breakers_1', 'Kai Moana', 'BIG WAVE', ARCHETYPES.FINISHER, 'FW', 10, 2, 2, { spd: 84, sht: 78, hnd: 78, pas: 66, tkl: 64, pow: 84, end: 80, gb: 86, cat: 52, blk: 70 }, 'Pipeline Posterizer'),
      P('breakers_2', 'Rosa Delgado', 'SUNSHINE', ARCHETYPES.SNIPER, 'FW', 4, 1, 4, { spd: 78, sht: 89, hnd: 74, pas: 78, tkl: 64, pow: 49, end: 74, gb: 78, cat: 46, blk: 42 }, 'Golden Hour Three'),
      P('breakers_3', 'Bruno Sato', 'LIFEGUARD', ARCHETYPES.ALLROUND, 'DF', 77, 1, 0, { spd: 70, sht: 50, hnd: 54, pas: 60, tkl: 62, pow: 86, end: 84, gb: 64, cat: 58, blk: 89 }, 'Riptide Rescue Block'),
      P('breakers_4', 'Marisol Vega', 'TIDE POOL', ARCHETYPES.GUARDIAN, 'GK', 1, 3, 5, { spd: 62, sht: 44, hnd: 52, pas: 66, tkl: 58, pow: 82, end: 80, gb: 60, cat: 83, blk: 86 }, 'Tide Pool Trap'),
      P('breakers_5', 'Lena Park', 'DRIFT', ARCHETYPES.HANDLER, 'MF', 17, 1, 5, { spd: 88, sht: 70, hnd: 86, pas: 84, tkl: 76, pow: 47, end: 76, gb: 76, cat: 46, blk: 40 }, 'Longboard Cross'),
      P('breakers_6', 'Dov Halstrom', 'RIPTIDE', ARCHETYPES.FINISHER, 'MF', 25, 0, 3, { spd: 80, sht: 72, hnd: 72, pas: 70, tkl: 68, pow: 72, end: 72, gb: 70, cat: 44, blk: 52 }, 'Undertow Volley'),
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
    arena: 'uptown',
    motto: 'Old money, new game.',
    roster: [
      P('royals_1', 'Victor Lang', 'THE BARON', ARCHETYPES.ALLROUND, 'FW', 24, 0, 1, { spd: 82, sht: 86, hnd: 84, pas: 84, tkl: 74, pow: 72, end: 80, gb: 88, cat: 50, blk: 64 }, 'Penthouse Fadeaway'),
      P('royals_2', 'Imani Cross', 'DUCHESS', ARCHETYPES.HANDLER, 'MF', 6, 3, 4, { spd: 90, sht: 74, hnd: 92, pas: 90, tkl: 80, pow: 51, end: 78, gb: 86, cat: 48, blk: 40 }, 'Velvet Rope Cross'),
      P('royals_3', 'Hank Bauer', 'BUTLER', ARCHETYPES.ENFORCER, 'DF', 45, 0, 3, { spd: 60, sht: 50, hnd: 52, pas: 60, tkl: 62, pow: 93, end: 88, gb: 66, cat: 54, blk: 88 }, 'Service Entrance Shove'),
      P('royals_4', 'Ada Fairweather', 'CHATELAINE', ARCHETYPES.GUARDIAN, 'GK', 1, 2, 0, { spd: 58, sht: 42, hnd: 54, pas: 68, tkl: 56, pow: 76, end: 76, gb: 58, cat: 90, blk: 82 }, 'Estate Keeper'),
      P('royals_5', 'Wes Trammel', 'HEIR', ARCHETYPES.SNIPER, 'FW', 19, 2, 0, { spd: 74, sht: 87, hnd: 70, pas: 72, tkl: 60, pow: 53, end: 70, gb: 72, cat: 44, blk: 40 }, 'Trust Fund Three'),
      P('royals_6', 'Kit Amara', 'GALA', ARCHETYPES.HANDLER, 'DF', 8, 1, 2, { spd: 78, sht: 58, hnd: 76, pas: 78, tkl: 78, pow: 56, end: 72, gb: 68, cat: 50, blk: 44 }, 'Masquerade Step'),
    ],
  },
];

export const TEAM_BY_ID = Object.fromEntries(TEAMS.map((t) => [t.id, t]));

/** Overall rating for a swimmer. Weights sum to 1, so the result stays on the 40–99 scale. */
export function playerOverall(p) {
  if (p.role === 'GK') {
    return Math.round(p.cat * 0.3 + p.blk * 0.2 + p.pow * 0.15 + p.spd * 0.15 + p.pas * 0.1 + p.end * 0.1);
  }
  return Math.round(
    p.spd * 0.14 + p.sht * 0.16 + p.hnd * 0.15 + p.pas * 0.1 + p.tkl * 0.13 + p.pow * 0.12 + p.end * 0.1 + p.gb * 0.1,
  );
}

/** Strength of the four swimmers who take the pool: three outfield + the keeper. */
export function teamOverall(team) {
  const four = starters(team);
  return Math.round(four.reduce((s, p) => s + playerOverall(p), 0) / four.length);
}

/**
 * The four swimmers who start a match — slot order matters: the sim creates players by index,
 * and slot 3 is the keeper.
 */
export function starters(team) {
  const outfield = team.roster.filter((p) => p.role !== 'GK').slice(0, 3);
  const keeper = team.roster.find((p) => p.role === 'GK');
  return keeper ? [...outfield, keeper] : outfield;
}

export const PLAYER_BY_ID = Object.fromEntries(TEAMS.flatMap((t) => t.roster.map((p) => [p.id, { ...p, teamId: t.id }])));
