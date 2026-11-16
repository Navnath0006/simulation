import { EULER_SUBSTEPS } from "./engine";
import { FIXED_CONSTANTS, FIXED_CONSTANT_LABELS } from "./model";

const VALIDATION_ROWS: readonly [string, string][] = [
  ["Dashboard defaults: district level, annual average, 50 days", "1.8875"],
  [
    "Farm level, November, 180 days, α_C 0.2, 32 °C, 75% humidity, pH 7.2, F 1.2",
    "3.0206",
  ],
  ["District level, September, 365 days, β_C 0.12, β_B 0.07", "4.1278"],
  [
    "State level, January, 200 days, vaccinated buffalo/pigs/sheep-goats at day 0",
    "3.8448",
  ],
  [
    "Farm level, annual average, 120 days, no infected animals at day 0",
    "1.8891",
  ],
  ["Farm level, annual average, 3,650 days", "1.8875"],
  [
    "District level, April, 240 days, vaccination of buffalo, pigs and sheep/goats, other non-default rates",
    "5.4839",
  ],
];

const CATTLE = `λ_C  = β_C* · (I_C1 + I_C2 + F_env·F·(I_B + I_P + I_S)) / N

dS_C/dt  = r·(Δ_C + α_C3·V_C1 + χ_2·V_C2 + K_1·Q_C + θ·R_C) − (α_C + μ_C + λ_C)·S_C
dE_C/dt  = λ_C·S_C − (ρ_1 + μ_C)·E_C
dI_C1/dt = ρ_1·E_C − (μ_C + σ_1)·I_C1
dI_C2/dt = σ_1·I_C1 + K_2·Q_C − (γ_3 + μ_C + φ + D_C)·I_C2
dR_C/dt  = α_C1·γ_1·V_C1 + χ_1·γ_2·V_C2 + γ_3·I_C2 + γ_4·q_C − (μ_C + θ)·R_C
dV_C1/dt = α_C·S_C − (α_C1·γ_1 + α_C2 + α_C3 + μ_C)·V_C1
dV_C2/dt = α_C2·V_C1 − (χ_1·γ_2 + μ_C + χ_2)·V_C2
dQ_C/dt  = Δ_QC − (K_1 + K_2 + μ_C)·Q_C
dq_C/dt  = φ·I_C2 − (γ_4 + μ_C)·q_C`;

const OTHER_HOSTS = `λ_X  = β_X* · F_env · (I_C1 + I_C2) / N_X      for X = buffalo (B), pigs (P), sheep/goats (S)

dS_B/dt  = r·Δ_B − (λ_B + μ_B + α_B)·S_B
dE_B/dt  = λ_B·S_B − (ρ_2 + μ_B)·E_B
dI_B/dt  = ρ_2·E_B − (μ_B + γ_B)·I_B
dV_B1/dt = α_B·S_B − (α_B1 + α_B2 + μ_B + γ_B2)·V_B1
dV_B2/dt = α_B2·V_B1 − (μ_B + χ_B + γ_B1)·V_B2
dR_B/dt  = γ_B·I_B − μ_B·R_B + γ_B1·V_B2 + γ_B2·V_B1

dS_P/dt  = r·Δ_P − (λ_P + μ_P + α_P)·S_P          (sheep/goats: same form, subscript S)
dI_P/dt  = λ_P·S_P − (μ_P + D_P + γ_P)·I_P
dV_P/dt  = α_P·S_P − (δ_P + μ_P + γ_P1)·V_P
dR_P/dt  = γ_P·I_P − μ_P·R_P + γ_P1·V_P`;

const R0_TEXT = `Ω_C = (ρ_1 + μ_C)(μ_C + σ_1)(γ_3 + μ_C + φ + D_C)
Ω_B = (ρ_2 + μ_B)(μ_B + σ_2)(μ_B + D_B)                 σ_2 = 0.5, D_B = 0.01 (fixed)
A   = β_C*·(S_C0/N)·ρ_1·(D_C + γ_3 + μ_C + φ + σ_1) / Ω_C
B   = β_B*·(S_B0/N_B)·ρ_2·(D_B + μ_B + σ_2) / Ω_B
Δ   = 4·β_BC*·β_CB*·max(0.1, F_env)·F·(S_C0/N)·(S_B0/N_B)·ρ_1·ρ_2·σ_1·σ_2 / (Ω_C·Ω_B)
R₀  = (A + B + √((A − B)² + Δ)) / 2          herd-immunity threshold = 1 − 1/R₀`;

export default function FmdModel() {
  return (
    <div className="fmd-model">
      <section className="fmd-card" aria-labelledby="model-about">
        <h2 id="model-about">What the simulator computes</h2>
        <p>
          A deterministic multi-host compartmental model of foot-and-mouth
          disease with 23 compartments: cattle (9), buffalo (6), pigs (4) and
          sheep/goats (4). It is a TypeScript port of the core engine of the
          legacy page <code>fmd_simulation.php</code> (version of 13 November
          2026). Equations below are written exactly as implemented.
        </p>
        <p>
          <strong>β*</strong> is the seasonally adjusted rate: at farm level β*
          = max(0.001, β × s), at district and state level β* = max(0.001, β +
          s), where s is the monthly index of the selected level (no
          seasonality: s = 1 at farm level, 0 otherwise). <strong>r</strong> is
          0 at farm level (closed outbreak) and 1 otherwise.{" "}
          <strong>F_env</strong> is the product of cardinal temperature (0, 20,
          60 °C), humidity (0, 60, 100%) and pH (0, 7, 14) responses, limited to
          0–2.
        </p>
      </section>

      <section className="fmd-card" aria-labelledby="model-cattle">
        <h2 id="model-cattle">Cattle</h2>
        <pre className="fmd-equations">{CATTLE}</pre>
      </section>

      <section className="fmd-card" aria-labelledby="model-hosts">
        <h2 id="model-hosts">Buffalo, pigs, sheep and goats</h2>
        <pre className="fmd-equations">{OTHER_HOSTS}</pre>
        <table className="fmd-table fmd-constants">
          <caption>Fixed rates (not editable in the legacy page)</caption>
          <thead>
            <tr>
              <th scope="col">Parameter</th>
              <th scope="col">Value</th>
            </tr>
          </thead>
          <tbody>
            {(
              Object.keys(FIXED_CONSTANTS) as (keyof typeof FIXED_CONSTANTS)[]
            ).map((key) => (
              <tr key={key}>
                <th scope="row">{FIXED_CONSTANT_LABELS[key]}</th>
                <td>{FIXED_CONSTANTS[key]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="fmd-card" aria-labelledby="model-r0">
        <h2 id="model-r0">Basic reproduction number</h2>
        <p>
          The analytical cattle–buffalo R₀ of the legacy page, using susceptible
          fractions so that it does not depend on population scale. The
          cross-species rates β_BC and β_CB come from the form; a zero value
          falls back to 0.5·β_B and 0.3·β_C. Seasonality is applied to every
          rate as in the simulation.
        </p>
        <pre className="fmd-equations">{R0_TEXT}</pre>
      </section>

      <section className="fmd-card" aria-labelledby="model-numerics">
        <h2 id="model-numerics">Initial values and numerical method</h2>
        <ul className="fmd-list">
          <li>
            Explicit Euler with {EULER_SUBSTEPS} sub-steps per day; every
            compartment is set to 0 if a sub-step makes it negative. Values are
            stored once per day for days 0 to (days − 1).
          </li>
          <li>
            Day-0 susceptible cattle are the cattle population minus all other
            day-0 cattle compartments, rounded. At district level, recovered
            cattle include V_C2.
          </li>
          <li>
            Day-0 buffalo: susceptible = buffalo − infected, exposed = 2% of
            susceptible. Pigs and sheep/goats: susceptible = population −
            infected.
          </li>
          <li>
            State level makes every host’s day-0 compartments add up to its
            population and starts quarantine and isolation at 0.
          </li>
          <li>
            Vaccination impact reruns the model with no vaccination (α_C = 0,
            vaccinated cattle returned to susceptible) and with the day-0
            vaccinated stock only (α_C = 0), and compares cumulative cattle
            infections (ρ_1·E_C per day) and deaths (D_C·I_C2 per day).
          </li>
        </ul>
      </section>

      <section className="fmd-card" aria-labelledby="model-validation">
        <h2 id="model-validation">Validation against the legacy page</h2>
        <p>
          Reference values were captured from the legacy page running in a
          browser. For each scenario, every stored value of 15 output series
          matches the legacy engine exactly (largest relative difference 0), and
          so does R₀. The dashboard’s herd-immunity, environmental-factor and
          vaccination-impact figures also match, as do the vaccination-impact
          comparisons at farm and state level. These checks run in the automated
          test suite.
        </p>
        <table className="fmd-table">
          <caption>Validation scenarios</caption>
          <thead>
            <tr>
              <th scope="col">Scenario</th>
              <th scope="col">R₀ (legacy and port)</th>
            </tr>
          </thead>
          <tbody>
            {VALIDATION_ROWS.map(([scenario, r0]) => (
              <tr key={scenario}>
                <th scope="row">{scenario}</th>
                <td>{r0}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="fmd-muted">
          Matching the legacy page shows that the port is faithful. It is not a
          scientific validation of the model against field data.
        </p>
      </section>

      <section className="fmd-card" aria-labelledby="model-review">
        <h2 id="model-review">Legacy behaviours kept for review</h2>
        <p>
          These behaviours were reproduced unchanged so results match the legacy
          page. They should be reviewed with the modelling team before the model
          is changed.
        </p>
        <ul className="fmd-list">
          <li>
            R₀ treats a zero input as its default (for example β_C = 0 is
            calculated as 0.26, F = 0 as 1), uses the total population of all
            species for the cattle fraction, and leaves out pigs and
            sheep/goats.
          </li>
          <li>
            Fixed day-0 values: quarantined cattle 1, isolated cattle 416,
            vaccinated and recovered pigs 1 each, vaccinated sheep/goats 3,
            recovered sheep/goats 8; 2% of susceptible buffalo are exposed even
            when no animal is infected.
          </li>
          <li>
            At district level, V_C2 is counted both as vaccinated and as
            recovered at day 0.
          </li>
          <li>
            Some outflows leave the model rather than moving to another
            compartment (δ_P and δ_S from vaccinated pigs and sheep/goats, α_B1
            and χ_B from vaccinated buffalo), and clipping at 0 does not
            conserve animals.
          </li>
          <li>
            An empty buffalo, pig or sheep/goat population is replaced by
            19,644, 7,102 or 278,051 in the transmission denominator.
          </li>
          <li>
            The equations on the legacy “Model Architecture” page differ from
            the implementation (for example, a separate subclinical buffalo
            stage and different pig and sheep/goat infection terms).
          </li>
        </ul>
      </section>

      <section className="fmd-card" aria-labelledby="model-pending">
        <h2 id="model-pending">Not migrated yet</h2>
        <ul className="fmd-list">
          <li>
            Input calculators that derive exposed and asymptomatic cattle, β and
            D_C from prevalence and contact data, and the level presets.
          </li>
          <li>
            State and district data loaders, year-wise state runs, the vaccine
            effectiveness analysis and validation against observed outbreaks.
          </li>
          <li>
            R_t analysis, R₀ curves and threshold matrix, endemic equilibrium
            and derived indicators.
          </li>
          <li>
            Control-measure scenarios, Monte Carlo, the stochastic (SDE) panel,
            economic analysis and the preparedness/risk assessment.
          </li>
          <li>
            Bulk Excel upload, HTML and PNG reports, multilingual help with
            speech, and the help chatbot.
          </li>
          <li>
            The separate FMD pages: PDE spatial and SPDE stochastic models, the
            SAT-1 incursion simulator, and the theory and R₀ page.
          </li>
        </ul>
      </section>
    </div>
  );
}
