/**
 * Foot-and-mouth disease (FMD) multi-host ODE engine.
 *
 * TypeScript port of the deterministic core of the legacy page `fmd_simulation.php`
 * (snapshot of 13 November 2026):
 *   simulateFMDCore()            -> simulateFmdCore()
 *   calculateEnvironmentalFactor -> environmentalFactor()
 *   getSeasonFactor()            -> seasonFactor()
 *   calculateR0()                -> calculateR0()
 *   fmdConservedInit()           -> conservedInitialState()
 *   _vaccCumulative()            -> cumulativeCattleFlows()
 *   computeVaccinationImpact()   -> vaccinationImpact()
 *   computeITotalArray/findPeak  -> totalInfected() / findPeak()
 *
 * Arithmetic is written in the same order as the legacy code so results can be compared
 * exactly with fixtures captured from the legacy page (see tests/fmd-engine.test.ts and
 * docs/VALIDATION.md). Legacy behaviours that look questionable are intentionally kept for
 * parity and are listed in docs/MIGRATION_STATUS.md; change them only with the modelling team.
 *
 * Not ported here: the Path-2 vaccine-effectiveness model and cohort tracer, one-off
 * vaccination pulses, control-measure scenarios, Monte Carlo, SDE, economics and the
 * derived-input calculators of the legacy page.
 */

export type ContactLevel = "farm" | "district" | "state";

/** One day is split into this many explicit-Euler sub-steps (legacy EULER_SUBSTEPS). */
export const EULER_SUBSTEPS = 100;
/** Output step in days (legacy global `dt`). */
export const DT = 1;

/** Parameter object passed to the engine. Field names match the legacy `p` object. */
export interface FmdParams {
  N: number;
  V_C10: number;
  V_C20: number;
  S_C0: number;
  E_C0: number;
  I_C10: number;
  I_C20: number;
  R_C0: number;
  I_B20: number;
  I_P0: number;
  I_S0: number;
  beta_C: number;
  beta_B: number;
  seasonFactor: number;
  contactMode: ContactLevel;
  conservePopulation: boolean;
  V_B10: number;
  V_P0: number;
  V_S0: number;
  mu_C: number;
  mu_B: number;
  D_C: number;
  phi: number;
  alpha_C: number;
  alpha_B: number;
  alpha_P: number;
  alpha_S: number;
  temperature: number;
  humidity: number;
  pH: number;
  F: number;
  rho_1: number;
  rho_2: number;
  sigma_1: number;
  gamma_3: number;
  gamma_4: number;
  gamma_1: number;
  gamma_2: number;
  theta: number;
  delta_C: number;
  alpha_C1: number;
  alpha_C2: number;
  alpha_C3: number;
  chi_1: number;
  chi_2: number;
  K_1: number;
  K_2: number;
  delta_QC: number;
  gamma_B: number;
  gamma_P: number;
  gamma_S: number;
  D_P: number;
  D_S: number;
  B_N: number;
  P_N: number;
  S_N: number;
  delta_B: number;
  delta_P: number;
  delta_S: number;
  alpha_B1: number;
  alpha_B2: number;
  chi_B: number;
  gamma_B1: number;
  gamma_B2: number;
  gamma_P1: number;
  gamma_S1: number;
  beta_P: number;
  beta_S: number;
  mu_P: number;
  mu_S: number;
}

/** Species populations and day-0 infected counts (legacy readSpecies()). */
export interface Species {
  NC: number;
  Nb: number;
  Np: number;
  NSG: number;
  I_B20: number;
  I_P0: number;
  I_S0: number;
}

export const COMPARTMENTS = [
  "S_C",
  "E_C",
  "I_C1",
  "I_C2",
  "R_C",
  "V_C1",
  "V_C2",
  "Q_C",
  "q_C",
  "S_B",
  "E_B",
  "I_B",
  "V_B1",
  "V_B2",
  "R_B",
  "S_P",
  "I_P",
  "V_P",
  "R_P",
  "S_S",
  "I_S",
  "V_S",
  "R_S",
] as const;
export type Compartment = (typeof COMPARTMENTS)[number];
export type SimulationSeries = Record<Compartment, Float64Array>;

export interface CoreResult {
  series: SimulationSeries;
  /** Day-0 susceptible buffalo, pigs and sheep/goats used by the run. */
  SB0: number;
  SP0: number;
  SS0: number;
  F_env: number;
  /** Number of stored days (day 0 .. days-1). */
  days: number;
}

// ---------------------------------------------------------------------------
// Environment and seasonality
// ---------------------------------------------------------------------------

export interface EnvironmentalFactor {
  f_T: number;
  f_H: number;
  f_pH: number;
  F_env: number;
}

/** Cardinal response of temperature, humidity and pH; product clamped to [0, 2]. */
export function environmentalFactor(
  temp: number,
  humidity: number,
  pH: number,
): EnvironmentalFactor {
  const T_opt = 20,
    T_min = 0,
    T_max = 60,
    H_opt = 60,
    H_min = 0,
    H_max = 100,
    pH_opt = 7,
    pH_min = 0,
    pH_max = 14;
  let f_T = 0,
    f_H = 0,
    f_pH = 0;
  if (temp >= T_min && temp <= T_max) {
    const num = temp * (temp - T_min) * Math.sqrt(T_max - temp);
    const den = T_opt * (T_opt - T_min) * Math.sqrt(T_max - T_opt);
    f_T = den ? num / den : 0;
  }
  if (humidity >= H_min && humidity <= H_max) {
    const num = humidity * (humidity - H_min) * Math.sqrt(H_max - humidity);
    const den = H_opt * (H_opt - H_min) * Math.sqrt(H_max - H_opt);
    f_H = den ? num / den : 0;
  }
  if (pH >= pH_min && pH <= pH_max) {
    const num = pH * (pH - pH_min) * Math.sqrt(pH_max - pH);
    const den = pH_opt * (pH_opt - pH_min) * Math.sqrt(pH_max - pH_opt);
    f_pH = den ? num / den : 0;
  }
  const F_env = Math.max(0, Math.min(2, f_T * f_H * f_pH));
  return { f_T, f_H, f_pH, F_env };
}

/** Farm level: multiplicative monthly index (12-month mean = 1). */
export const FARM_SEASON_INDEX: Readonly<Record<number, number>> = {
  1: 1.59,
  2: 1.29,
  3: 1.22,
  4: 0.74,
  5: 0.55,
  6: 0.5,
  7: 0.6,
  8: 0.74,
  9: 0.87,
  10: 1.04,
  11: 1.51,
  12: 1.36,
};
/** District level: additive monthly beta increment. */
export const DISTRICT_SEASON_INDEX: Readonly<Record<number, number>> = {
  1: 0.124877,
  2: 0.11193,
  3: 0.102833,
  4: 0.094829,
  5: 0.082376,
  6: 0.105614,
  7: 0.121129,
  8: 0.14057,
  9: 0.16213,
  10: 0.14365,
  11: 0.13592,
  12: 0.140705,
};
/** State level: additive monthly beta increment (Karnataka-specific values in the legacy page). */
export const STATE_SEASON_INDEX: Readonly<Record<number, number>> = {
  1: 0.120605,
  2: 0.1081,
  3: 0.099314,
  4: 0.091584,
  5: 0.079558,
  6: 0.102,
  7: 0.116984,
  8: 0.13576,
  9: 0.156583,
  10: 0.138735,
  11: 0.131269,
  12: 0.13589,
};

/** True when seasonality is added to beta (district/state); false when it multiplies beta (farm). */
export function isAdditiveSeason(level: ContactLevel): boolean {
  return level === "state" || level === "district";
}

/** Month 0 = annual average (no seasonal forcing). */
export function seasonFactor(level: ContactLevel, month: number): number {
  const isAdd = isAdditiveSeason(level);
  if (!month) return isAdd ? 0 : 1;
  if (level === "state") return STATE_SEASON_INDEX[month] || 0;
  if (level === "district") return DISTRICT_SEASON_INDEX[month] || 0;
  return FARM_SEASON_INDEX[month] || 1;
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

export interface ConservedInitialState {
  S_C: number;
  E_C: number;
  I_C1: number;
  I_C2: number;
  R_C: number;
  V_C1: number;
  V_C2: number;
  Q_C: number;
  q_C: number;
  S_B: number;
  E_B: number;
  I_B2: number;
  V_B1: number;
  V_B2: number;
  R_B: number;
  S_P: number;
  I_P: number;
  V_P: number;
  R_P: number;
  S_S: number;
  I_S: number;
  V_S: number;
  R_S: number;
  /** Animals by which day-0 inputs exceed each population (clamped to 0 susceptibles). */
  shortfall: {
    cattle: number;
    buffalo: number;
    pig: number;
    sheepgoat: number;
  };
}

/** State level: day-0 compartments of every host add up to its population (legacy fmdConservedInit). */
export function conservedInitialState(
  p: FmdParams,
  s: Species,
): ConservedInitialState {
  const nz = (value: number) => {
    const v = +value;
    return isFinite(v) && v > 0 ? v : 0;
  };
  const NC = nz(s.NC),
    Nb = nz(s.Nb),
    Np = nz(s.Np),
    NSG = nz(s.NSG);
  const E_C = nz(p.E_C0),
    I_C1 = nz(p.I_C10),
    I_C2 = nz(p.I_C20),
    R_C = nz(p.R_C0),
    V_C1 = nz(p.V_C10),
    V_C2 = nz(p.V_C20),
    Q_C = 0,
    q_C = 0,
    I_B2 = nz(p.I_B20),
    V_B1 = nz(p.V_B10),
    V_B2 = 0,
    R_B = 0,
    I_P = nz(p.I_P0),
    V_P = nz(p.V_P0),
    R_P = 0,
    I_S = nz(p.I_S0),
    V_S = nz(p.V_S0),
    R_S = 0;
  let S_C = NC - (E_C + I_C1 + I_C2 + R_C + V_C1 + V_C2 + Q_C + q_C);
  const bFree = Nb - (I_B2 + V_B1 + V_B2 + R_B);
  const E_B = Math.max(0, bFree) * 0.02; // legacy assumption: 2% of free buffalo exposed at day 0
  let S_B = bFree - E_B;
  let S_P = Np - (I_P + V_P + R_P);
  let S_S = NSG - (I_S + V_S + R_S);
  const shortfall = {
    cattle: Math.max(0, -S_C),
    buffalo: Math.max(0, -S_B),
    pig: Math.max(0, -S_P),
    sheepgoat: Math.max(0, -S_S),
  };
  S_C = Math.max(0, S_C);
  S_B = Math.max(0, S_B);
  S_P = Math.max(0, S_P);
  S_S = Math.max(0, S_S);
  return {
    S_C,
    E_C,
    I_C1,
    I_C2,
    R_C,
    V_C1,
    V_C2,
    Q_C,
    q_C,
    S_B,
    E_B,
    I_B2,
    V_B1,
    V_B2,
    R_B,
    S_P,
    I_P,
    V_P,
    R_P,
    S_S,
    I_S,
    V_S,
    R_S,
    shortfall,
  };
}

// ---------------------------------------------------------------------------
// Core simulation
// ---------------------------------------------------------------------------

/**
 * Integrates the 23-compartment model for `T` stored days (day 0 .. T-1) with explicit
 * Euler sub-steps of h = DT / EULER_SUBSTEPS, clipping every compartment at 0 after each
 * sub-step, exactly as the legacy simulateFMDCore() does without its optional extensions.
 */
export function simulateFmdCore(
  p: FmdParams,
  s: Species,
  T: number,
): CoreResult {
  const days = Math.max(1, Math.round(T));
  const SB0 = Math.max(0, s.Nb - s.I_B20);
  const SP0 = Math.max(0, s.Np - s.I_P0);
  const SS0 = Math.max(0, s.NSG - s.I_S0);
  const { F_env } = environmentalFactor(p.temperature, p.humidity, p.pH);
  const c0 = p.conservePopulation ? conservedInitialState(p, s) : null;

  const isAdd = isAdditiveSeason(p.contactMode);
  const sf = p.seasonFactor;
  const effectiveBeta = (base: number) =>
    isAdd ? Math.max(0.001, base + sf) : Math.max(0.001, base * sf);
  const bC = effectiveBeta(p.beta_C);
  const bB = effectiveBeta(p.beta_B);
  const bP = effectiveBeta(p.beta_P);
  const bS = effectiveBeta(p.beta_S);
  // Farm level = closed short-horizon outbreak: no demographic/waning recycling into S.
  const recycle = p.contactMode === "farm" ? 0 : 1;
  const h = DT / EULER_SUBSTEPS;
  const a1g1 = p.alpha_C1 * p.gamma_1; // V_C1 -> R_C
  const c1g2 = p.chi_1 * p.gamma_2; // V_C2 -> R_C
  const wan1 = p.alpha_C3; // V_C1 -> S_C
  const wan2 = p.chi_2; // V_C2 -> S_C

  let S_C = c0 ? c0.S_C : p.S_C0,
    E_C = p.E_C0,
    I_C1 = p.I_C10,
    I_C2 = p.I_C20,
    R_C = p.R_C0,
    V_C1 = p.V_C10,
    V_C2 = p.V_C20,
    Q_C = c0 ? c0.Q_C : 1,
    q_C = c0 ? c0.q_C : 416;
  let S_B = c0 ? c0.S_B : SB0,
    E_B = c0 ? c0.E_B : SB0 * 0.02,
    I_B2 = p.I_B20,
    V_B1 = c0 ? c0.V_B1 : 0,
    V_B2 = 0,
    R_B = 0;
  let S_P = c0 ? c0.S_P : SP0,
    I_P = p.I_P0,
    V_P = c0 ? c0.V_P : 1,
    R_P = c0 ? c0.R_P : 1;
  let S_S = c0 ? c0.S_S : SS0,
    I_S = p.I_S0,
    V_S = c0 ? c0.V_S : 3,
    R_S = c0 ? c0.R_S : 8;

  const series = Object.fromEntries(
    COMPARTMENTS.map((name) => [name, new Float64Array(days)]),
  ) as SimulationSeries;
  const store = (t: number) => {
    series.S_C[t] = S_C;
    series.E_C[t] = E_C;
    series.I_C1[t] = I_C1;
    series.I_C2[t] = I_C2;
    series.R_C[t] = R_C;
    series.V_C1[t] = V_C1;
    series.V_C2[t] = V_C2;
    series.Q_C[t] = Q_C;
    series.q_C[t] = q_C;
    series.S_B[t] = S_B;
    series.E_B[t] = E_B;
    series.I_B[t] = I_B2;
    series.V_B1[t] = V_B1;
    series.V_B2[t] = V_B2;
    series.R_B[t] = R_B;
    series.S_P[t] = S_P;
    series.I_P[t] = I_P;
    series.V_P[t] = V_P;
    series.R_P[t] = R_P;
    series.S_S[t] = S_S;
    series.I_S[t] = I_S;
    series.V_S[t] = V_S;
    series.R_S[t] = R_S;
  };
  store(0);

  for (let t = 1; t < days; t++) {
    for (let k = 0; k < EULER_SUBSTEPS; k++) {
      const I_cattle = I_C1 + I_C2;
      const I_other = I_B2 + I_P + I_S;
      const I_total = I_cattle + I_other * F_env * p.F;

      // Cattle
      const dS_C =
        recycle *
          (p.delta_C +
            wan1 * V_C1 +
            wan2 * V_C2 +
            p.K_1 * Q_C +
            p.theta * R_C) -
        (p.alpha_C + p.mu_C + (bC * I_total) / p.N) * S_C;
      const dE_C = ((bC * I_total) / p.N) * S_C - (p.rho_1 + p.mu_C) * E_C;
      const dI_C1 = p.rho_1 * E_C - (p.mu_C + p.sigma_1) * I_C1;
      const dI_C2 =
        p.sigma_1 * I_C1 +
        p.K_2 * Q_C -
        (p.gamma_3 + p.mu_C + p.phi + p.D_C) * I_C2;
      const dR_C =
        a1g1 * V_C1 +
        c1g2 * V_C2 +
        p.gamma_3 * I_C2 +
        p.gamma_4 * q_C -
        (p.mu_C + p.theta) * R_C;
      const dV_C1 =
        p.alpha_C * S_C - (a1g1 + p.alpha_C2 + wan1 + p.mu_C) * V_C1;
      const dV_C2 = p.alpha_C2 * V_C1 - (c1g2 + p.mu_C + wan2) * V_C2;
      const dQ_C = p.delta_QC - (p.K_1 + p.K_2 + p.mu_C) * Q_C;
      const dq_C = p.phi * I_C2 - (p.gamma_4 + p.mu_C) * q_C;

      // Buffalo
      const dS_B =
        recycle * p.delta_B -
        ((bB * F_env * I_cattle) / p.B_N + p.mu_B + p.alpha_B) * S_B;
      const dE_B =
        ((bB * F_env * I_cattle) / p.B_N) * S_B - (p.rho_2 + p.mu_B) * E_B;
      const dI_B2 = p.rho_2 * E_B - (p.mu_B + p.gamma_B) * I_B2;
      const dV_B1 =
        p.alpha_B * S_B -
        (p.alpha_B1 + p.alpha_B2 + p.mu_B + p.gamma_B2) * V_B1;
      const dV_B2 = p.alpha_B2 * V_B1 - (p.mu_B + p.chi_B + p.gamma_B1) * V_B2;
      const dR_B =
        p.gamma_B * I_B2 - p.mu_B * R_B + p.gamma_B1 * V_B2 + p.gamma_B2 * V_B1;

      // Pigs
      const dS_P =
        recycle * p.delta_P -
        ((bP * F_env * I_cattle) / p.P_N + p.mu_P + p.alpha_P) * S_P;
      const dI_P =
        ((bP * F_env * I_cattle) / p.P_N) * S_P -
        (p.mu_P + p.D_P + p.gamma_P) * I_P;
      const dV_P = p.alpha_P * S_P - (p.delta_P + p.mu_P + p.gamma_P1) * V_P;
      const dR_P = p.gamma_P * I_P - p.mu_P * R_P + p.gamma_P1 * V_P;

      // Sheep and goats
      const dS_S =
        recycle * p.delta_S -
        ((bS * F_env * I_cattle) / p.S_N + p.mu_S + p.alpha_S) * S_S;
      const dI_S =
        ((bS * F_env * I_cattle) / p.S_N) * S_S -
        (p.mu_S + p.D_S + p.gamma_S) * I_S;
      const dV_S = p.alpha_S * S_S - (p.delta_S + p.mu_S + p.gamma_S1) * V_S;
      const dR_S = p.gamma_S * I_S - p.mu_S * R_S + p.gamma_S1 * V_S;

      // One explicit-Euler sub-step, then clip at zero.
      S_C = Math.max(0, S_C + dS_C * h);
      E_C = Math.max(0, E_C + dE_C * h);
      I_C1 = Math.max(0, I_C1 + dI_C1 * h);
      I_C2 = Math.max(0, I_C2 + dI_C2 * h);
      R_C = Math.max(0, R_C + dR_C * h);
      V_C1 = Math.max(0, V_C1 + dV_C1 * h);
      V_C2 = Math.max(0, V_C2 + dV_C2 * h);
      Q_C = Math.max(0, Q_C + dQ_C * h);
      q_C = Math.max(0, q_C + dq_C * h);
      S_B = Math.max(0, S_B + dS_B * h);
      E_B = Math.max(0, E_B + dE_B * h);
      I_B2 = Math.max(0, I_B2 + dI_B2 * h);
      V_B1 = Math.max(0, V_B1 + dV_B1 * h);
      V_B2 = Math.max(0, V_B2 + dV_B2 * h);
      R_B = Math.max(0, R_B + dR_B * h);
      S_P = Math.max(0, S_P + dS_P * h);
      I_P = Math.max(0, I_P + dI_P * h);
      V_P = Math.max(0, V_P + dV_P * h);
      R_P = Math.max(0, R_P + dR_P * h);
      S_S = Math.max(0, S_S + dS_S * h);
      I_S = Math.max(0, I_S + dI_S * h);
      V_S = Math.max(0, V_S + dV_S * h);
      R_S = Math.max(0, R_S + dR_S * h);
    }
    store(t);
  }

  return {
    series,
    SB0: c0 ? c0.S_B : SB0,
    SP0: c0 ? c0.S_P : SP0,
    SS0: c0 ? c0.S_S : SS0,
    F_env,
    days,
  };
}

// ---------------------------------------------------------------------------
// Basic reproduction number and herd immunity
// ---------------------------------------------------------------------------

/** Inputs of the analytical R0 (legacy calculateR0 params). Zero values fall back to the legacy defaults. */
export interface R0Input {
  beta_C: number;
  beta_B: number;
  beta_BC: number;
  beta_CB: number;
  S_C0: number;
  S_B0: number;
  rho_1: number;
  rho_2: number;
  gamma_3: number;
  mu_C: number;
  mu_B: number;
  D_C: number;
  phi: number;
  N: number;
  B_N: number;
  sigma_1: number;
  F: number;
  temperature: number;
  humidity: number;
  pH: number;
}

/**
 * Normalised two-host (cattle-buffalo) analytical R0 of the legacy page:
 *   R0 = (A + B + sqrt((A - B)^2 + Delta)) / 2
 * using susceptible fractions S_C0/N and S_B0/B_N. Seasonality is applied to every beta as in
 * the simulation. Note: the legacy code uses `value || default`, so a zero input takes the
 * default value (kept for parity).
 */
export function calculateR0(
  params: R0Input,
  level: ContactLevel,
  season: number,
): number {
  const fenv = Math.max(
    0.1,
    environmentalFactor(params.temperature, params.humidity, params.pH).F_env,
  );
  const isAdd = isAdditiveSeason(level);
  const applySeason = (base: number, factor: number) =>
    isAdd ? Math.max(0.001, base + factor) : Math.max(0.001, base * factor);
  const betaCC = applySeason(params.beta_C || 0.26, season);
  const betaBB = applySeason(params.beta_B || 0.3, season);
  const betaBC = applySeason(
    params.beta_BC || (params.beta_B || 0.3) * 0.5,
    season,
  );
  const betaCB = applySeason(
    params.beta_CB || (params.beta_C || 0.26) * 0.3,
    season,
  );
  const NC = Math.max(1, params.N || 592366);
  const NB = Math.max(1, params.B_N || 19644);
  const SC = Math.min(Math.max(1, params.S_C0 || 200), NC);
  const SB = Math.min(Math.max(1, params.S_B0 || 200), NB);
  const rho1 = Math.max(0.001, params.rho_1 || 0.66);
  const rho2 = Math.max(0.001, params.rho_2 || 0.66);
  const sigma1 = Math.max(0.001, params.sigma_1 || 0.5);
  const sigma2 = 0.5; // buffalo progression: fixed in the legacy R0
  const gamma3 = Math.max(0.001, params.gamma_3 || 0.0926);
  const muC = Math.max(0.0001, params.mu_C || 0.01);
  const muB = Math.max(0.0001, params.mu_B || 0.01);
  const DC = Math.max(0.0001, params.D_C || 0.08);
  const DB = 0.01; // buffalo disease-induced death: fixed in the legacy R0
  const phi = Math.max(0, params.phi || 0.142);
  const Fval = Math.max(0.01, params.F || 1);

  const SC_f = SC / NC;
  const SB_f = SB / NB;
  const OmegaC = (rho1 + muC) * (muC + sigma1) * (gamma3 + muC + phi + DC);
  const OmegaB = (rho2 + muB) * (muB + sigma2) * (muB + DB);
  if (OmegaC <= 0 || OmegaB <= 0) return 0;
  const A_n =
    (betaCC * SC_f * rho1 * (DC + gamma3 + muC + phi + sigma1)) / OmegaC;
  const B_n = (betaBB * SB_f * rho2 * (DB + muB + sigma2)) / OmegaB;
  const Delta2_n =
    (4 *
      betaBC *
      betaCB *
      fenv *
      Fval *
      SC_f *
      SB_f *
      rho1 *
      rho2 *
      sigma1 *
      sigma2) /
    (OmegaC * OmegaB);
  const Delta_n = (A_n - B_n) * (A_n - B_n) + Delta2_n;
  const R0 = (A_n + B_n + Math.sqrt(Math.max(0, Delta_n))) / 2;
  return isFinite(R0) && R0 > 0 ? R0 : 0;
}

/** Herd-immunity threshold in percent (1 - 1/R0), or null when R0 <= 1. */
export function herdImmunityThreshold(R0: number): number | null {
  if (!isFinite(R0) || R0 <= 1) return null;
  return Math.max(0, Math.min(100, (1 - 1 / R0) * 100));
}

// ---------------------------------------------------------------------------
// Derived outputs
// ---------------------------------------------------------------------------

/** Daily infected animals of all hosts: I_C1 + I_C2 + I_B + I_P + I_S. */
export function totalInfected(series: SimulationSeries): Float64Array {
  const n = series.I_C1.length;
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++)
    out[i] =
      (series.I_C1[i] || 0) +
      (series.I_C2[i] || 0) +
      (series.I_B[i] || 0) +
      (series.I_P[i] || 0) +
      (series.I_S[i] || 0);
  return out;
}

/** First day with the highest value (legacy findPeak). */
export function findPeak(values: ArrayLike<number>): {
  peak: number;
  peakDay: number;
} {
  let peak = -Infinity,
    peakDay = 0;
  for (let i = 0; i < values.length; i++)
    if (values[i] > peak) {
      peak = values[i];
      peakDay = i;
    }
  return { peak: Math.max(0, peak), peakDay };
}

export interface CattleFlows {
  /** Cumulative new cattle infections (E_C -> I_C1 flow). */
  infections: Float64Array;
  /** Cumulative disease deaths of symptomatic cattle. */
  deaths: Float64Array;
  /** Cumulative vaccinated cattle, starting from the day-0 vaccinated stock. */
  vaccinated: Float64Array;
}

/** Daily cumulative cattle flows (legacy _vaccCumulative), one-day rectangle rule. */
export function cumulativeCattleFlows(
  series: SimulationSeries,
  p: Pick<FmdParams, "V_C10" | "V_C20" | "rho_1" | "D_C" | "alpha_C">,
): CattleFlows {
  const n = series.S_C.length;
  const h = DT;
  const infections = new Float64Array(n);
  const deaths = new Float64Array(n);
  const vaccinated = new Float64Array(n);
  vaccinated[0] = (p.V_C10 || 0) + (p.V_C20 || 0);
  for (let t = 1; t < n; t++) {
    infections[t] = infections[t - 1] + p.rho_1 * (series.E_C[t - 1] || 0) * h;
    deaths[t] = deaths[t - 1] + p.D_C * (series.I_C2[t - 1] || 0) * h;
    vaccinated[t] =
      vaccinated[t - 1] + p.alpha_C * (series.S_C[t - 1] || 0) * h;
  }
  return { infections, deaths, vaccinated };
}

export interface VaccinationImpact {
  /** Flows with the current settings, with no vaccination at all, and with day-0 stock only. */
  withVaccination: CattleFlows;
  noVaccination: CattleFlows;
  stockOnly: CattleFlows;
  cattlePopulation: number;
  lastDay: number;
  infectionsWithout: number;
  infectionsWith: number;
  saved: number;
  deathsAverted: number;
  fromStock: number;
  fromCampaign: number;
  vaccinated: number;
  /** Percent fewer cattle infections than with no vaccination. */
  percentFewer: number;
  /** Vaccinated cattle per infection averted, or null when nothing is averted. */
  numberNeededToVaccinate: number | null;
}

/**
 * Counterfactual comparison of the legacy "cattle saved by vaccination" tile:
 * (B) no vaccination at all and (C) the existing vaccinated stock only, against (A) the
 * current settings. At district level R_C0 already contains V_C2, so it is removed in (B).
 */
export function vaccinationImpact(
  p: FmdParams,
  species: Species,
  T: number,
  current: SimulationSeries,
  cattlePopulation: number,
): VaccinationImpact {
  const mode = p.contactMode || "farm";
  const vc1 = Math.max(0, p.V_C10 || 0),
    vc2 = Math.max(0, p.V_C20 || 0);
  const pNo: FmdParams = {
    ...p,
    alpha_C: 0,
    V_C10: 0,
    V_C20: 0,
    S_C0: (p.S_C0 || 0) + vc1 + vc2,
    R_C0: mode === "district" ? Math.max(0, (p.R_C0 || 0) - vc2) : p.R_C0,
  };
  const pStock: FmdParams = { ...p, alpha_C: 0 };
  const simNo = simulateFmdCore(pNo, species, T).series;
  const simStock = simulateFmdCore(pStock, species, T).series;
  const cW = cumulativeCattleFlows(current, p);
  const cN = cumulativeCattleFlows(simNo, pNo);
  const cS = cumulativeCattleFlows(simStock, pStock);
  const NC = Math.max(
    1,
    cattlePopulation ||
      p.S_C0 + p.E_C0 + p.I_C10 + p.I_C20 + p.R_C0 + vc1 + vc2 ||
      1,
  );
  const L = current.S_C.length - 1;
  const infW = cW.infections[L],
    infN = cN.infections[L],
    infS = cS.infections[L];
  const saved = infN - infW;
  const vaccinated = cW.vaccinated[L];
  return {
    withVaccination: cW,
    noVaccination: cN,
    stockOnly: cS,
    cattlePopulation: NC,
    lastDay: L,
    infectionsWithout: infN,
    infectionsWith: infW,
    saved,
    deathsAverted: cN.deaths[L] - cW.deaths[L],
    fromStock: infN - infS,
    fromCampaign: infS - infW,
    vaccinated,
    percentFewer: infN > 0 ? (saved / infN) * 100 : 0,
    numberNeededToVaccinate: saved > 0.5 ? vaccinated / saved : null,
  };
}
