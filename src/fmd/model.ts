import {
  calculateR0,
  conservedInitialState,
  environmentalFactor,
  findPeak,
  herdImmunityThreshold,
  seasonFactor,
  simulateFmdCore,
  totalInfected,
  vaccinationImpact,
  type Compartment,
  type ContactLevel,
  type CoreResult,
  type EnvironmentalFactor,
  type FmdParams,
  type R0Input,
  type Species,
  type VaccinationImpact,
} from "./engine";

/** Values a user can edit. Defaults reproduce the legacy dashboard at district level. */
export interface FmdInputs {
  level: ContactLevel;
  /** 0 = annual average, 1-12 = calendar month. */
  month: number;
  days: number;
  NC: number;
  Nb: number;
  Np: number;
  NSG: number;
  V_C10: number;
  V_C20: number;
  E_C0: number;
  I_C10: number;
  I_C20: number;
  /** Recovered cattle in addition to V_C2 (legacy R_C_additional). */
  R_C_additional: number;
  I_B20: number;
  I_P0: number;
  I_S0: number;
  V_B10: number;
  V_P0: number;
  V_S0: number;
  beta_C: number;
  beta_B: number;
  beta_BC: number;
  beta_CB: number;
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
  gamma_1: number;
  gamma_2: number;
  gamma_3: number;
  gamma_4: number;
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
}

export type NumericField = Exclude<keyof FmdInputs, "level" | "month">;

export const DEFAULT_INPUTS: Readonly<FmdInputs> = {
  level: "district",
  month: 0,
  days: 50,
  NC: 287502,
  Nb: 19644,
  Np: 7102,
  NSG: 278118,
  V_C10: 28132,
  V_C20: 372,
  E_C0: 137,
  I_C10: 69,
  I_C20: 476,
  R_C_additional: 0,
  I_B20: 22,
  I_P0: 0,
  I_S0: 40,
  V_B10: 0,
  V_P0: 0,
  V_S0: 0,
  beta_C: 0.21,
  beta_B: 0.11,
  beta_BC: 0.15,
  beta_CB: 0.078,
  mu_C: 0.0571,
  mu_B: 0.0571,
  D_C: 0.02521,
  phi: 0.01,
  alpha_C: 0.09,
  alpha_B: 0,
  alpha_P: 0,
  alpha_S: 0,
  temperature: 28,
  humidity: 65,
  pH: 6.4,
  F: 1,
  rho_1: 0.66,
  rho_2: 0.66,
  sigma_1: 0.5,
  gamma_1: 0.001,
  gamma_2: 0.5,
  gamma_3: 0.0926,
  gamma_4: 0.5,
  theta: 0.0056,
  delta_C: 0.2,
  alpha_C1: 0.1,
  alpha_C2: 0.2,
  alpha_C3: 0.7,
  chi_1: 0.5,
  chi_2: 0.5,
  K_1: 0.5,
  K_2: 0.5,
  delta_QC: 5,
};

/** Rates that the legacy page does not expose; they are fixed in runSimulation(). */
export const FIXED_CONSTANTS = {
  gamma_B: 0.0926,
  gamma_P: 0.12,
  gamma_S: 0.11,
  D_P: 0.0858,
  D_S: 0.0858,
  delta_B: 0.15,
  delta_P: 0.18,
  delta_S: 0.12,
  alpha_B1: 0.02,
  alpha_B2: 0.03,
  chi_B: 0.001,
  gamma_B1: 0.08,
  gamma_B2: 0.05,
  gamma_P1: 0.09,
  gamma_S1: 0.07,
  beta_P: 0.35,
  beta_S: 0.28,
  mu_P: 0.08,
  mu_S: 0.01,
} as const;

export const FIXED_CONSTANT_LABELS: Record<
  keyof typeof FIXED_CONSTANTS,
  string
> = {
  gamma_B: "Recovery rate, buffalo (γ_B)",
  gamma_P: "Recovery rate, pigs (γ_P)",
  gamma_S: "Recovery rate, sheep/goats (γ_S)",
  D_P: "Disease-induced death rate, pigs (D_P)",
  D_S: "Disease-induced death rate, sheep/goats (D_S)",
  delta_B: "Buffalo recruitment (Δ_B, animals/day)",
  delta_P: "Pig recruitment (Δ_P, animals/day) and V_P waning (δ_P)",
  delta_S: "Sheep/goat recruitment (Δ_S, animals/day) and V_S waning (δ_S)",
  alpha_B1: "Buffalo V_B1 outflow (α_B1)",
  alpha_B2: "Buffalo V_B1 → V_B2 (α_B2)",
  chi_B: "Buffalo V_B2 outflow (χ_B)",
  gamma_B1: "Buffalo V_B2 → R_B (γ_B1)",
  gamma_B2: "Buffalo V_B1 → R_B (γ_B2)",
  gamma_P1: "Pig V_P → R_P (γ_P1)",
  gamma_S1: "Sheep/goat V_S → R_S (γ_S1)",
  beta_P: "Transmission rate to pigs (β_P)",
  beta_S: "Transmission rate to sheep/goats (β_S)",
  mu_P: "Natural death rate, pigs (μ_P)",
  mu_S: "Natural death rate, sheep/goats (μ_S)",
};

export type FieldGroup =
  | "horizon"
  | "populations"
  | "cattle"
  | "otherHosts"
  | "transmission"
  | "mortality"
  | "vaccination"
  | "environment"
  | "advanced";

export interface FieldSpec {
  key: NumericField;
  label: string;
  group: FieldGroup;
  min: number;
  max?: number;
  step: number;
  integer?: boolean;
  unit?: string;
  help: string;
}

export const GROUP_LABELS: Record<FieldGroup, string> = {
  horizon: "Time horizon",
  populations: "Host populations",
  cattle: "Cattle at day 0",
  otherHosts: "Other hosts at day 0",
  transmission: "Transmission",
  mortality: "Mortality and isolation",
  vaccination: "Vaccination",
  environment: "Environment",
  advanced: "Advanced cattle rates",
};

// Upper limits keep every compartment's total outflow below 1/h = 100 per day, so one
// Euler sub-step can never move more animals out of a compartment than it holds (the
// legacy page has no upper limits). Rates: ≤ 20/day; the four coefficients that are
// multiplied together (α_C1·γ₁, χ₁·γ₂): ≤ 1 each.
const RATE = { min: 0, max: 20, step: 0.0001 } as const;
const COEFFICIENT = { min: 0, max: 1, step: 0.0001 } as const;

export const FIELDS: readonly FieldSpec[] = [
  {
    key: "days",
    group: "horizon",
    label: "Simulation days",
    min: 10,
    max: 3650,
    step: 1,
    integer: true,
    unit: "days",
    help: "Number of stored days (day 0 to days − 1).",
  },
  {
    key: "NC",
    group: "populations",
    label: "Cattle",
    min: 1,
    step: 1,
    integer: true,
    help: "Cattle population (NC).",
  },
  {
    key: "Nb",
    group: "populations",
    label: "Buffalo",
    min: 0,
    step: 1,
    integer: true,
    help: "Buffalo population (B_N). The legacy page uses 19,644 when this is 0.",
  },
  {
    key: "Np",
    group: "populations",
    label: "Pigs",
    min: 0,
    step: 1,
    integer: true,
    help: "Pig population (P_N). The legacy page uses 7,102 when this is 0.",
  },
  {
    key: "NSG",
    group: "populations",
    label: "Sheep and goats",
    min: 0,
    step: 1,
    integer: true,
    help: "Sheep and goat population (S_N). The legacy page uses 278,051 when this is 0.",
  },
  // Whole numbers: the legacy page rounds these day-0 counts before running.
  {
    key: "V_C10",
    group: "cattle",
    label: "Vaccinated, fewer than 3 rounds (V_C1)",
    min: 0,
    step: 1,
    integer: true,
    help: "Cattle vaccinated fewer than three times.",
  },
  {
    key: "V_C20",
    group: "cattle",
    label: "Vaccinated, 3 or more rounds (V_C2)",
    min: 0,
    step: 1,
    integer: true,
    help: "Cattle vaccinated three or more times. At district level they are also counted in R_C at day 0, as in the legacy page.",
  },
  {
    key: "E_C0",
    group: "cattle",
    label: "Exposed (E_C)",
    min: 0,
    step: 1,
    integer: true,
    help: "Latently infected cattle. The legacy page derives this from prevalence inputs that are not migrated yet.",
  },
  {
    key: "I_C10",
    group: "cattle",
    label: "Asymptomatic infected (I_C1)",
    min: 0,
    step: 1,
    integer: true,
    help: "Subclinically infected cattle. The legacy page derives this from prevalence inputs that are not migrated yet.",
  },
  {
    key: "I_C20",
    group: "cattle",
    label: "Symptomatic infected (I_C2)",
    min: 0,
    step: 1,
    integer: true,
    help: "Clinically infected cattle.",
  },
  {
    key: "R_C_additional",
    group: "cattle",
    label: "Recovered, additional (R_C)",
    min: 0,
    step: 1,
    integer: true,
    help: "Recovered cattle. At district level R_C at day 0 is V_C2 plus this value; at farm and state level it is this value.",
  },
  {
    key: "I_B20",
    group: "otherHosts",
    label: "Infected buffalo (I_B)",
    min: 0,
    step: 1,
    integer: true,
    help: "Infected buffalo at day 0.",
  },
  {
    key: "I_P0",
    group: "otherHosts",
    label: "Infected pigs (I_P)",
    min: 0,
    step: 1,
    integer: true,
    help: "Infected pigs at day 0.",
  },
  {
    key: "I_S0",
    group: "otherHosts",
    label: "Infected sheep/goats (I_S)",
    min: 0,
    step: 1,
    integer: true,
    help: "Infected sheep and goats at day 0.",
  },
  {
    key: "V_B10",
    group: "otherHosts",
    label: "Vaccinated buffalo",
    min: 0,
    step: 1,
    help: "Used only at state level, where day-0 compartments are made to add up to each population.",
  },
  {
    key: "V_P0",
    group: "otherHosts",
    label: "Vaccinated pigs",
    min: 0,
    step: 1,
    help: "Used only at state level.",
  },
  {
    key: "V_S0",
    group: "otherHosts",
    label: "Vaccinated sheep/goats",
    min: 0,
    step: 1,
    help: "Used only at state level.",
  },
  {
    key: "beta_C",
    group: "transmission",
    label: "Cattle transmission rate (β_C)",
    min: 0,
    max: 10,
    step: 0.001,
    unit: "/day",
    help: "Infection of cattle by infected cattle and, through fomites, other hosts. Labelled “symptomatic transmission” in the legacy form.",
  },
  {
    key: "beta_B",
    group: "transmission",
    label: "Buffalo transmission rate (β_B)",
    min: 0,
    max: 10,
    step: 0.001,
    unit: "/day",
    help: "Infection of buffalo by infected cattle via the environment. Labelled “asymptomatic transmission” in the legacy form.",
  },
  {
    key: "beta_BC",
    group: "transmission",
    label: "Buffalo → cattle, for R₀ (β_BC)",
    min: 0,
    max: 5,
    step: 0.001,
    unit: "/day",
    help: "Cross-species term used only by the analytical R₀.",
  },
  {
    key: "beta_CB",
    group: "transmission",
    label: "Cattle → buffalo, for R₀ (β_CB)",
    min: 0,
    max: 5,
    step: 0.001,
    unit: "/day",
    help: "Cross-species term used only by the analytical R₀.",
  },
  {
    key: "mu_C",
    group: "mortality",
    label: "Cattle natural death rate (μ_C)",
    min: 0,
    max: 1,
    step: 0.0001,
    unit: "/day",
    help: "Natural mortality of cattle.",
  },
  {
    key: "mu_B",
    group: "mortality",
    label: "Buffalo natural death rate (μ_B)",
    min: 0,
    max: 1,
    step: 0.0001,
    unit: "/day",
    help: "Natural mortality of buffalo.",
  },
  {
    key: "D_C",
    group: "mortality",
    label: "Disease-induced death rate (D_C)",
    min: 0,
    max: 1,
    step: 0.00001,
    unit: "/day",
    help: "FMD mortality of symptomatic cattle. The legacy page derives this value; it is entered directly here.",
  },
  {
    key: "phi",
    group: "mortality",
    label: "Isolation rate (φ)",
    min: 0.01,
    max: 1,
    step: 0.001,
    unit: "/day",
    help: "Rate at which symptomatic cattle are isolated (I_C2 → q_C).",
  },
  {
    key: "alpha_C",
    group: "vaccination",
    label: "Cattle vaccination rate (α_C)",
    min: 0,
    max: 1,
    step: 0.01,
    unit: "/day",
    help: "Fraction of susceptible cattle vaccinated per day (S_C → V_C1).",
  },
  {
    key: "alpha_B",
    group: "vaccination",
    label: "Buffalo vaccination rate (α_B)",
    min: 0,
    max: 1,
    step: 0.01,
    unit: "/day",
    help: "S_B → V_B1.",
  },
  {
    key: "alpha_P",
    group: "vaccination",
    label: "Pig vaccination rate (α_P)",
    min: 0,
    max: 1,
    step: 0.01,
    unit: "/day",
    help: "S_P → V_P.",
  },
  {
    key: "alpha_S",
    group: "vaccination",
    label: "Sheep/goat vaccination rate (α_S)",
    min: 0,
    max: 1,
    step: 0.01,
    unit: "/day",
    help: "S_S → V_S.",
  },
  {
    key: "temperature",
    group: "environment",
    label: "Temperature",
    min: -10,
    max: 50,
    step: 0.1,
    unit: "°C",
    help: "Environmental response x²·√(60 − x): 1 at 20 °C, rising to its maximum at 48 °C; 0 at or below 0 °C.",
  },
  {
    key: "humidity",
    group: "environment",
    label: "Relative humidity",
    min: 0,
    max: 100,
    step: 1,
    unit: "%",
    help: "Environmental response x²·√(100 − x): 1 at 60%, rising to its maximum at 80%; 0 at 0% and 100%.",
  },
  {
    key: "pH",
    group: "environment",
    label: "pH",
    min: 0,
    max: 14,
    step: 0.1,
    help: "Environmental response x²·√(14 − x): 1 at pH 7, rising to its maximum at pH 11.2; 0 at pH 0 and 14.",
  },
  {
    key: "F",
    group: "environment",
    label: "Fomite index (F)",
    min: 0,
    max: 1,
    step: 0.01,
    help: "Scales transmission from buffalo, pigs and sheep/goats to cattle.",
  },
  {
    key: "rho_1",
    group: "advanced",
    label: "Exposed → asymptomatic cattle (ρ₁)",
    ...RATE,
    unit: "/day",
    help: "E_C → I_C1.",
  },
  {
    key: "rho_2",
    group: "advanced",
    label: "Exposed → infected buffalo (ρ₂)",
    ...RATE,
    unit: "/day",
    help: "E_B → I_B.",
  },
  {
    key: "sigma_1",
    group: "advanced",
    label: "Asymptomatic → symptomatic (σ₁)",
    ...RATE,
    unit: "/day",
    help: "I_C1 → I_C2.",
  },
  {
    key: "gamma_1",
    group: "advanced",
    label: "V_C1 immunity factor (γ₁)",
    ...COEFFICIENT,
    help: "V_C1 → R_C flows at α_C1·γ₁.",
  },
  {
    key: "gamma_2",
    group: "advanced",
    label: "V_C2 immunity factor (γ₂)",
    ...COEFFICIENT,
    help: "V_C2 → R_C flows at χ₁·γ₂.",
  },
  {
    key: "gamma_3",
    group: "advanced",
    label: "Recovery, symptomatic cattle (γ₃)",
    ...RATE,
    unit: "/day",
    help: "I_C2 → R_C.",
  },
  {
    key: "gamma_4",
    group: "advanced",
    label: "Recovery, isolated cattle (γ₄)",
    ...RATE,
    unit: "/day",
    help: "q_C → R_C.",
  },
  {
    key: "theta",
    group: "advanced",
    label: "Loss of immunity (θ)",
    ...RATE,
    unit: "/day",
    help: "Leaves R_C at every level; returns to S_C except at farm level.",
  },
  {
    key: "delta_C",
    group: "advanced",
    label: "Cattle recruitment (Δ_C)",
    min: 0,
    max: 1000000,
    step: 0.0001,
    unit: "animals/day",
    help: "Inflow to S_C (not at farm level).",
  },
  {
    key: "alpha_C1",
    group: "advanced",
    label: "V_C1 → R_C coefficient (α_C1)",
    ...COEFFICIENT,
    help: "Multiplied by γ₁.",
  },
  {
    key: "alpha_C2",
    group: "advanced",
    label: "V_C1 → V_C2 (α_C2)",
    ...RATE,
    unit: "/day",
    help: "Progression to three or more rounds.",
  },
  {
    key: "alpha_C3",
    group: "advanced",
    label: "V_C1 waning to S_C (α_C3)",
    ...RATE,
    unit: "/day",
    help: "Leaves V_C1 at every level; returns to S_C except at farm level.",
  },
  {
    key: "chi_1",
    group: "advanced",
    label: "V_C2 → R_C coefficient (χ₁)",
    ...COEFFICIENT,
    help: "Multiplied by γ₂.",
  },
  {
    key: "chi_2",
    group: "advanced",
    label: "V_C2 waning to S_C (χ₂)",
    ...RATE,
    unit: "/day",
    help: "Leaves V_C2 at every level; returns to S_C except at farm level.",
  },
  {
    key: "K_1",
    group: "advanced",
    label: "Quarantine release (K₁)",
    ...RATE,
    unit: "/day",
    help: "Leaves Q_C at every level; returns to S_C except at farm level.",
  },
  {
    key: "K_2",
    group: "advanced",
    label: "Quarantine → symptomatic (K₂)",
    ...RATE,
    unit: "/day",
    help: "Q_C → I_C2.",
  },
  {
    key: "delta_QC",
    group: "advanced",
    label: "Inflow to quarantine (Δ_QC)",
    min: 0,
    max: 1000000,
    step: 0.0001,
    unit: "animals/day",
    help: "Constant inflow to Q_C.",
  },
];

export const LEVEL_LABELS: Record<ContactLevel, string> = {
  farm: "Farm level",
  district: "District level",
  state: "State level",
};

export const MONTH_NAMES = [
  "Annual average (no seasonality)",
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/** Total population and the derived day-0 cattle values shown read-only in the form. */
export function derivedCattle(inputs: FmdInputs): {
  N: number;
  R_C0: number;
  S_C0: number;
  /** Positive when the other day-0 cattle compartments exceed the cattle population. */
  cattleOverflow: number;
} {
  const N = inputs.NC + inputs.Nb + inputs.Np + inputs.NSG;
  // Legacy updateRCTotal(): district level folds V_C2 into R_C.
  const R_C0 =
    inputs.level === "district"
      ? inputs.V_C20 + inputs.R_C_additional
      : inputs.R_C_additional;
  // Legacy recalcSC(): remainder of the cattle population, rounded and floored at 0.
  const cattleTotal = inputs.NC > 0 ? inputs.NC : N;
  const raw =
    cattleTotal -
    (inputs.V_C10 +
      inputs.V_C20 +
      inputs.E_C0 +
      inputs.I_C10 +
      inputs.I_C20 +
      R_C0);
  return {
    N,
    R_C0,
    S_C0: Math.max(0, Math.round(raw)),
    cattleOverflow: Math.max(0, -raw),
  };
}

/** Engine parameters assembled exactly as the legacy runSimulation() does. */
export function buildParams(inputs: FmdInputs): FmdParams {
  const { N, R_C0, S_C0 } = derivedCattle(inputs);
  return {
    N,
    V_C10: inputs.V_C10,
    V_C20: inputs.V_C20,
    S_C0,
    E_C0: inputs.E_C0,
    I_C10: inputs.I_C10,
    I_C20: inputs.I_C20,
    R_C0,
    I_B20: inputs.I_B20,
    I_P0: inputs.I_P0,
    I_S0: inputs.I_S0,
    beta_C: inputs.beta_C,
    beta_B: inputs.beta_B,
    seasonFactor: seasonFactor(inputs.level, inputs.month),
    contactMode: inputs.level,
    conservePopulation: inputs.level === "state",
    V_B10: inputs.V_B10,
    V_P0: inputs.V_P0,
    V_S0: inputs.V_S0,
    mu_C: inputs.mu_C,
    mu_B: inputs.mu_B,
    D_C: inputs.D_C,
    phi: inputs.phi,
    alpha_C: inputs.alpha_C,
    alpha_B: inputs.alpha_B,
    alpha_P: inputs.alpha_P,
    alpha_S: inputs.alpha_S,
    temperature: inputs.temperature,
    humidity: inputs.humidity,
    pH: inputs.pH,
    F: inputs.F,
    rho_1: inputs.rho_1,
    rho_2: inputs.rho_2,
    sigma_1: inputs.sigma_1,
    gamma_3: inputs.gamma_3,
    gamma_4: inputs.gamma_4,
    gamma_1: inputs.gamma_1,
    gamma_2: inputs.gamma_2,
    theta: inputs.theta,
    delta_C: inputs.delta_C,
    alpha_C1: inputs.alpha_C1,
    alpha_C2: inputs.alpha_C2,
    alpha_C3: inputs.alpha_C3,
    chi_1: inputs.chi_1,
    chi_2: inputs.chi_2,
    K_1: inputs.K_1,
    K_2: inputs.K_2,
    delta_QC: inputs.delta_QC,
    ...FIXED_CONSTANTS,
    // Legacy: `Math.max(1, +Nb || 19644)` etc., so an empty population uses the default.
    B_N: Math.max(1, inputs.Nb || 19644),
    P_N: Math.max(1, inputs.Np || 7102),
    S_N: Math.max(1, inputs.NSG || 278051),
  };
}

export function buildSpecies(inputs: FmdInputs): Species {
  return {
    NC: inputs.NC,
    Nb: inputs.Nb,
    Np: inputs.Np,
    NSG: inputs.NSG,
    I_B20: inputs.I_B20,
    I_P0: inputs.I_P0,
    I_S0: inputs.I_S0,
  };
}

/** R₀ inputs assembled as in the legacy runSimulation(). */
export function buildR0Input(
  inputs: FmdInputs,
  params: FmdParams,
  SB0: number,
): R0Input {
  return {
    beta_C: inputs.beta_C,
    beta_B: inputs.beta_B,
    beta_BC: inputs.beta_BC,
    beta_CB: inputs.beta_CB,
    S_C0: params.S_C0,
    S_B0: SB0,
    rho_1: params.rho_1,
    rho_2: params.rho_2,
    gamma_3: params.gamma_3,
    mu_C: params.mu_C,
    mu_B: params.mu_B,
    D_C: params.D_C,
    phi: params.phi,
    N: params.N,
    B_N: params.B_N,
    sigma_1: params.sigma_1,
    F: params.F,
    temperature: params.temperature,
    humidity: params.humidity,
    pH: params.pH,
  };
}

export interface FmdScenarioResult {
  inputs: FmdInputs;
  params: FmdParams;
  core: CoreResult;
  environment: EnvironmentalFactor;
  R0: number;
  herdImmunity: number | null;
  infected: Float64Array;
  peak: { peak: number; peakDay: number };
  vaccination: VaccinationImpact;
  warnings: string[];
  /** True when the numerical check failed; the results are then not reliable. */
  unstable: boolean;
}

const HOST_COMPARTMENTS: readonly {
  label: string;
  compartments: readonly Compartment[];
  /** Animals per day entering the host's compartments from outside the model. */
  inflow: (p: FmdParams, recycle: number) => number;
}[] = [
  {
    label: "cattle",
    compartments: [
      "S_C",
      "E_C",
      "I_C1",
      "I_C2",
      "R_C",
      "V_C1",
      "V_C2",
      "Q_C",
      "q_C",
    ],
    inflow: (p, recycle) => recycle * p.delta_C + p.delta_QC,
  },
  {
    label: "buffalo",
    compartments: ["S_B", "E_B", "I_B", "V_B1", "V_B2", "R_B"],
    inflow: (p, recycle) => recycle * p.delta_B,
  },
  {
    label: "pig",
    compartments: ["S_P", "I_P", "V_P", "R_P"],
    inflow: (p, recycle) => recycle * p.delta_P,
  },
  {
    label: "sheep/goat",
    compartments: ["S_S", "I_S", "V_S", "R_S"],
    inflow: (p, recycle) => recycle * p.delta_S,
  },
];

/**
 * Numerical check of a run. With a stable Euler sub-step a host's total can only grow
 * through recruitment and quarantine inflow. Growth beyond that (animals created when a
 * sub-step overshoots and the compartment is clipped at 0) or non-finite values mean the
 * results are numerical artefacts. Typical causes: very high rates, or a buffalo, pig or
 * sheep/goat population that is tiny compared with the number of infected cattle.
 */
export function stabilityWarnings(core: CoreResult, p: FmdParams): string[] {
  const recycle = p.contactMode === "farm" ? 0 : 1;
  const warnings: string[] = [];
  for (const host of HOST_COMPARTMENTS) {
    const inflow = host.inflow(p, recycle);
    const totalAt = (t: number) =>
      host.compartments.reduce((sum, name) => sum + core.series[name][t], 0);
    const initial = totalAt(0);
    for (let t = 0; t < core.days; t++) {
      const total = totalAt(t);
      if (!Number.isFinite(total)) {
        warnings.push(
          `Numerical instability: ${host.label} values become undefined on day ${t}. These results are not reliable; lower the rates or check the populations.`,
        );
        break;
      }
      const limit = (initial + inflow * t) * (1 + 1e-9) + 1e-6;
      if (total > limit) {
        warnings.push(
          `Numerical instability: on day ${t} the ${host.label} total (${formatCount(total)}) exceeds its day-0 total plus inflows (${formatCount(limit)}). These results are not reliable; lower the rates or check very small populations.`,
        );
        break;
      }
    }
  }
  return warnings;
}

export function runFmdScenario(inputs: FmdInputs): FmdScenarioResult {
  const params = buildParams(inputs);
  const species = buildSpecies(inputs);
  const core = simulateFmdCore(params, species, inputs.days);
  const R0 = calculateR0(
    buildR0Input(inputs, params, core.SB0),
    inputs.level,
    params.seasonFactor,
  );
  const infected = totalInfected(core.series);
  const stability = stabilityWarnings(core, params);
  const warnings: string[] = [...stability];
  const { cattleOverflow } = derivedCattle(inputs);
  if (cattleOverflow > 0)
    warnings.push(
      `Day-0 cattle compartments exceed the cattle population by ${formatCount(cattleOverflow)}; susceptible cattle are set to 0.`,
    );
  if (inputs.level === "state") {
    const { shortfall } = conservedInitialState(params, species);
    for (const [host, value] of Object.entries(shortfall))
      if (value > 0)
        warnings.push(
          `State level: day-0 ${host === "sheepgoat" ? "sheep/goat" : host} compartments exceed the population by ${formatCount(value)}; susceptibles are set to 0.`,
        );
  }
  for (const [label, infectedCount, population] of [
    ["buffalo", inputs.I_B20, inputs.Nb],
    ["pigs", inputs.I_P0, inputs.Np],
    ["sheep/goats", inputs.I_S0, inputs.NSG],
  ] as const)
    if (infectedCount > population)
      warnings.push(`Infected ${label} exceed the ${label} population.`);
  return {
    inputs,
    params,
    core,
    environment: environmentalFactor(
      inputs.temperature,
      inputs.humidity,
      inputs.pH,
    ),
    R0,
    herdImmunity: herdImmunityThreshold(R0),
    infected,
    peak: findPeak(infected),
    vaccination: vaccinationImpact(
      params,
      species,
      inputs.days,
      core.series,
      inputs.NC,
    ),
    warnings,
    unstable: stability.length > 0,
  };
}

// ---------------------------------------------------------------------------
// Form parsing and validation
// ---------------------------------------------------------------------------

export type FormValues = Record<NumericField, string>;

export function toFormValues(inputs: FmdInputs): FormValues {
  return Object.fromEntries(
    FIELDS.map((field) => [field.key, String(inputs[field.key])]),
  ) as FormValues;
}

export function parseForm(
  values: FormValues,
  level: ContactLevel,
  month: number,
): { inputs: FmdInputs | null; errors: Partial<Record<NumericField, string>> } {
  const errors: Partial<Record<NumericField, string>> = {};
  const parsed = { level, month } as FmdInputs;
  for (const field of FIELDS) {
    const raw = (values[field.key] ?? "").trim();
    const value = raw === "" ? NaN : Number(raw);
    if (!Number.isFinite(value)) {
      errors[field.key] = "Enter a number.";
      continue;
    }
    if (field.integer && !Number.isInteger(value)) {
      errors[field.key] = "Enter a whole number.";
      continue;
    }
    if (value < field.min || (field.max !== undefined && value > field.max)) {
      errors[field.key] =
        field.max === undefined
          ? `Must be at least ${field.min}.`
          : `Must be between ${field.min} and ${field.max}.`;
      continue;
    }
    parsed[field.key] = value;
  }
  return Object.keys(errors).length
    ? { inputs: null, errors }
    : { inputs: parsed, errors };
}

// ---------------------------------------------------------------------------
// Formatting and export
// ---------------------------------------------------------------------------

const countFormat = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 0,
});

/** Whole animals in Indian digit grouping; "—" for values that are not finite. */
export function formatCount(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return countFormat.format(Math.round(value) || 0);
}

export function resultsCsv(result: FmdScenarioResult): string {
  const names = Object.keys(
    result.core.series,
  ) as (keyof CoreResult["series"])[];
  const lines = [["day", ...names, "I_total"].join(",")];
  for (let t = 0; t < result.core.days; t++)
    lines.push(
      [
        t,
        ...names.map((name) => result.core.series[name][t]),
        result.infected[t],
      ].join(","),
    );
  return lines.join("\n") + "\n";
}

export function parametersCsv(result: FmdScenarioResult): string {
  const rows: [string, string | number | boolean][] = [
    ["level", result.inputs.level],
    ["month", result.inputs.month],
    ["days", result.inputs.days],
    ...Object.entries(result.params),
    ["R0", result.R0],
    ["F_env", result.environment.F_env],
  ];
  return (
    "parameter,value\n" + rows.map(([k, v]) => `${k},${v}`).join("\n") + "\n"
  );
}
