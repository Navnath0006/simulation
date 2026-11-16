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

### Legacy behaviours kept for parity

These are reproduced unchanged so results match the legacy page. They are listed on the model page and should be reviewed with the modelling team before the model is changed:

- R₀ treats zero inputs as their defaults (for example β_C = 0 is calculated as 0.26), divides susceptible cattle by the total population of all species, and leaves out pigs and sheep/goats.
- Fixed day-0 values: Q_C = 1, q_C = 416, V_P = R_P = 1, V_S = 3, R_S = 8, and 2% of susceptible buffalo exposed even with no infected animals.
- At district level V_C2 is counted both as vaccinated and as recovered at day 0.
- Some vaccinated-compartment outflows leave the model, and clipping at zero after every Euler sub-step does not conserve animals.
- Empty buffalo, pig or sheep/goat populations are replaced by 19,644, 7,102 or 278,051 in transmission denominators.
- The legacy "Model Architecture" page shows equations that differ from the implemented code.

### Not migrated yet

- Derived-input calculators (prevalence and contact data to E_C, I_C1, β and D_C) and level presets.
- State/district data loaders, year-wise state runs, the Path-2 vaccine-effectiveness model and cohort tracer, one-off vaccination pulses, and validation against observed outbreak data.
- R_t analysis, R₀ curves and threshold matrix, endemic equilibrium and derived indicators.
- Control-measure scenarios (`simulateFMDWithControls()`), Monte Carlo, the stochastic SDE panel, economic analysis and the preparedness/risk assessment.
- Bulk Excel upload, HTML/PNG reports, multilingual help with speech, and the chatbot.
- The other FMD pages: PDE spatial (`fmd_pde.php`), SPDE stochastic (`fmd_spde.php`), SAT-1 incursion (`fmd_sat.php`, server-side PHP) and the theory/R₀ page.

Matching the legacy page shows that the port is faithful. It does not validate the model scientifically, and the simulator does not indicate clinical or regulatory approval.
