# Migration status

This repository contains a **partial migration** of the portal into React. The portal presentation and the **core Foot & Mouth Disease (FMD) ODE simulator** are migrated; the other scientific applications are not. It must not be presented as a completed conversion of the original portal.

| Area | Scope in this repository |
| --- | --- |
| Home and navigation | React portal with hash navigation |
| Module catalogue | Searchable descriptions; FMD links to its simulator, other entries are informational |
| FMD ODE simulator | Core engine ported to TypeScript and checked against the legacy page (see below) |
| Other scientific simulation engines | Not migrated or packaged |
| Team and contact | Static informational content |
| Feedback | Omitted |
| Backend and database | Omitted; no runtime API or database is required |
| Scientific datasets and manuscripts | Not copied or distributed |
| Legacy HTML applications | Not embedded, proxied, or bundled |
| Deployment | Static build, CI, nginx container configuration, and optional manual Pages workflow |

The legacy XAMPP project remains a separate source. This repository does not require that server or access to its filesystem at runtime. The frontend contains no database connection, feedback submission endpoint, or placeholder API that sends user input to a server. Simulations run entirely in the browser.

## Foot & Mouth Disease

Routes: `#/modules/fmd` (simulator) and `#/modules/fmd/model` (model description and validation). The legacy deep links `dashboard.php?d=fmd&v=sim`, `...&v=guide` and `...&v=theory`, if redirected to this application with the same query string, open the simulator or the model view.

### Migrated from `fmd_simulation.php` (version of 13 November 2026)

| Legacy function | Port |
| --- | --- |
| `simulateFMDCore()` without its optional extensions | `simulateFmdCore()` in `src/fmd/engine.ts` |
| `calculateEnvironmentalFactor()` | `environmentalFactor()` |
| `getSeasonFactor()` and the three monthly index tables | `seasonFactor()` |
| `calculateR0()` (analytical cattle–buffalo R₀) and the herd-immunity tile | `calculateR0()`, `herdImmunityThreshold()` |
| `fmdConservedInit()` (state level) | `conservedInitialState()` |
| `computeVaccinationImpact()` and `_vaccCumulative()` | `vaccinationImpact()`, `cumulativeCattleFlows()` |
| `computeITotalArray()`, `findPeak()` | `totalInfected()`, `findPeak()` |
| Parameter assembly in `runSimulation()`, `recalcSC()`, `updateRCTotal()` | `buildParams()`, `derivedCattle()` in `src/fmd/model.ts` |

The React page shows R₀, the herd-immunity threshold, peak infection, vaccination impact, the environmental factor, cumulative cattle infections and deaths, epidemic curves, compartment values for any day, and CSV exports of daily results and parameters.

Form defaults reproduce the legacy dashboard at district level. In the legacy page, exposed cattle (E_C), asymptomatic cattle (I_C1) and D_C are read-only values derived by calculators that are not migrated; here they are entered directly, starting from the legacy defaults. Changing the level does not load the legacy level presets.

### Differences from the legacy page

- **Total population N.** This page always uses NC + Nb + Np + NSG, which is the legacy value when the legacy page first loads. The legacy N is an editable field: after any population or day-0 infected/exposed count is edited, `recalcNFromSpecies()` resets it to Σ max(0, population − day-0 exposed/infected animals) (the state data loader always uses that form). R₀ and the results then differ slightly — about 0.03% with the defaults, more than 10% for small herds. The modelling team should decide which definition is intended.
- **Input limits.** Day-0 animal counts must be whole numbers (the legacy page rounds them). Rates are limited to 20 per day and the coefficients γ₁, γ₂, α_C1 and χ₁ to 1, so one Euler sub-step cannot move more animals out of a compartment than it holds (the legacy page has no upper limits). After every run a numerical check flags non-finite values or a host total that grows beyond its day-0 total plus inflows — possible with very small buffalo, pig or sheep/goat populations — and the page then marks the results as not reliable.

### Legacy behaviours kept for parity

These are reproduced unchanged so results match the legacy page. They are listed on the model page and should be reviewed with the modelling team before the model is changed:

- R₀ treats zero inputs as their defaults (for example β_C = 0 is calculated as 0.26), divides day-0 susceptible cattle by the total population N of all species, and leaves out pigs and sheep/goats.
- At farm and district level, fixed day-0 values: Q_C = 1, q_C = 416, V_P = R_P = 1, V_S = 3, R_S = 8 (state level starts Q_C, q_C, R_P and R_S at 0 and V_P, V_S at the entered values). At every level 2% of susceptible buffalo are exposed even with no infected animals.
- At district level V_C2 is counted both as vaccinated and as recovered at day 0.
- Some outflows leave the model: δ_P, δ_S, α_B1 and χ_B from vaccinated compartments, and at farm level also θ·R_C, K₁·Q_C, α_C3·V_C1 and χ₂·V_C2 (which return animals to S_C at other levels). Clipping at zero after every Euler sub-step does not conserve animals.
- Empty buffalo, pig or sheep/goat populations are replaced by 19,644, 7,102 or 278,051 in transmission denominators.
- The environmental response names 20 °C, 60% humidity and pH 7 as optima, but its formula x²·√(x_max − x) is largest at 48 °C, 80% and pH 11.2.
- The legacy "Model Architecture" page shows equations that differ from the implemented code.

### Not migrated yet

- Derived-input calculators (prevalence and contact data to E_C, I_C1, β and D_C) and level presets.
- State/district data loaders, year-wise state runs, the Path-2 vaccine-effectiveness model and cohort tracer, one-off vaccination pulses, and validation against observed outbreak data.
- R_t analysis, R₀ curves and threshold matrix, endemic equilibrium and derived indicators.
- Control-measure scenarios (`simulateFMDWithControls()`), Monte Carlo, the stochastic SDE panel, economic analysis and the preparedness/risk assessment.
- Bulk Excel upload, HTML/PNG reports, multilingual help with speech, and the chatbot.
- The other FMD pages: PDE spatial (`fmd_pde.php`), SPDE stochastic (`fmd_spde.php`), SAT-1 incursion (`fmd_sat.php`, server-side PHP) and the theory/R₀ page.

Matching the legacy page shows that the port is faithful. It does not validate the model scientifically, and the simulator does not indicate clinical or regulatory approval.
