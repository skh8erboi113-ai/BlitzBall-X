/**
 * Court geometry (meters) and rules tunables.
 * The court is a fenced half-court; the rim is at the negative-Z end.
 */
export const COURT = {
  halfWidth: 7.5, // x: -7.5 .. 7.5
  baselineZ: -7.5, // behind the rim
  halfcourtZ: 6.8, // top of the playable area
  fenceMargin: 1.6, // fence sits this far outside the lines
  rimX: 0,
  rimZ: -5.9,
  rimHeight: 3.05,
  rimRadius: 0.23,
  backboardZ: -6.3,
  backboardWidth: 1.8,
  backboardHeight: 1.05,
  backboardBottom: 2.9,
  arcRadius: 6.75, // "2-point" line (worth 2 in street rules)
  keyHalfWidth: 2.45,
  keyTopZ: -1.7, // free-throw line
  checkBallZ: 3.6, // where possession restarts
};

export const FENCE = {
  minX: -COURT.halfWidth - COURT.fenceMargin,
  maxX: COURT.halfWidth + COURT.fenceMargin,
  minZ: COURT.baselineZ - COURT.fenceMargin,
  maxZ: COURT.halfcourtZ + COURT.fenceMargin,
};

export const RULES = {
  targetScore: 21,
  winBy: 2,
  scoreCap: 30, // hard cap guarantees termination
  shotClock: 20,
  insidePoints: 1,
  outsidePoints: 2,
  gamebreakerBonus: 1, // extra point on top of the shot's value
  gamebreakerSteal: 1, // points removed from the opponent
  gamebreakerMeterMax: 2400,
  resetDuration: 1.1, // seconds of "dead ball" after a score
  clearRequired: true, // must take it back behind the arc after a defensive board / steal
};

export const PHYS = {
  gravity: 9.81 * 1.15, // slightly punchy gravity feels arcade
  ballRadius: 0.125,
  ballRestitution: 0.62,
  ballFloorFriction: 0.985,
  ballAirDrag: 0.999,
  playerRadius: 0.42,
  fixedDt: 1 / 60,
};

export const MOVE = {
  baseSpeed: 5.4, // m/s at SPD 50
  speedPerStat: 0.028, // extra m/s per SPD point above 50
  turboMult: 1.38,
  accel: 22, // m/s^2 toward desired velocity
  turboMax: 100,
  turboDrain: 26, // per second while sprinting
  turboRegen: 11, // per second otherwise
  turboRegenDelay: 0.6,
  ballCarrierSlow: 0.94,
  jumpVelocity: 6.1,
  bigJumpVelocity: 7.0,
};

export const ACTION = {
  stealRange: 1.55,
  shoveRange: 1.4,
  blockRange: 1.9,
  passSpeed: 15,
  lobSpeed: 9,
  catchRadius: 0.9,
  looseBallPickupRadius: 0.75,
  slamRange: 2.6,
  layupRange: 2.0,
  trickDuration: 0.55,
  stealCooldown: 0.75,
  shoveCooldown: 1.6,
  stunAfterAnkleBreak: 0.85,
  knockdownDuration: 1.35,
  stealWhiffRecovery: 0.45,
};

export const STYLE = {
  trickBase: 40,
  trickTurboMult: 1.75,
  ankleBreakerBonus: 90,
  comboWindow: 1.6,
  comboMaxMult: 4,
  slamPoints: 140,
  alleyOopPoints: 220,
  blockPoints: 120,
  stealPoints: 100,
  shovePoints: 60,
  fadeawayPoints: 60,
  swishBonus: 30,
  lossOnTurnover: 120,
  lossOnBlocked: 80,
};

export const DIFFICULTY = {
  rookie: {
    label: 'ROOKIE',
    reaction: 0.42,
    stealRate: 0.55,
    trickRate: 0.35,
    shotAccuracy: 0.86,
    contestQuality: 0.7,
    gbUse: 0.6,
    turboUse: 0.5,
  },
  pro: {
    label: 'PRO',
    reaction: 0.26,
    stealRate: 0.95,
    trickRate: 0.7,
    shotAccuracy: 1.0,
    contestQuality: 0.9,
    gbUse: 1.0,
    turboUse: 0.8,
  },
  legend: {
    label: 'LEGEND',
    reaction: 0.14,
    stealRate: 1.35,
    trickRate: 1.0,
    shotAccuracy: 1.1,
    contestQuality: 1.05,
    gbUse: 1.0,
    turboUse: 1.0,
  },
};
