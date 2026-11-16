# Validation

Checked locally on 16 November 2026 using Node.js 22.19.0.

| Check | Result |
| --- | --- |
| TypeScript and production build | Passed with `npm run build`; the FMD module is a separate lazily loaded chunk |
| Automated tests | 59 passed across route, catalogue, DOM interface, FMD engine parity, numerical-check and FMD interface checks |
| Dependency audit | Zero known vulnerabilities reported by `npm audit`; no dependencies were added |
| FMD engine parity | Bit-identical to the legacy page in 7 scenarios and 3 vaccination-impact comparisons (see below) |
| Browser check under the production CSP | The built site was served with the security headers of `deploy/nginx.conf` and opened in headless Chrome 157: no script errors, CSP violations or failed requests on the home, FMD simulator and FMD model pages; default results, input changes, invalid input, a 3,650-day run, the numerical-instability alert and reset behaved as expected; native mouse-wheel input no longer changes a focused number field; with 412 × 915 device emulation the chart text renders at 11 px and the "Show results" button reaches the results |
| Pages sub-path build | Built with `BASE_PATH=/simulation/` and served under `/simulation/`: the FMD chunk loads and the simulator shows R₀ 1.8875 |
| Peer review | Portal: same-route mobile-menu focus defect corrected and covered by a regression test. FMD port: independent engine-fidelity and UI/accessibility reviews; their findings (input limits and a numerical check, whole-number day-0 counts, environment wording, mouse-wheel edits, phone layout and chart legibility, live-region noise, contrast, colour-only series, label and documentation accuracy) were fixed or documented, with tests |
| Build asset references | Entry assets and all six team portraits present |
| Release file inventory | No PHP, SQL, spreadsheets, scientific data exports, or secret files in `dist/` |
| Docker execution | Not tested; Docker is not installed on the local machine |

## FMD simulator against the legacy page

`tests/fixtures/fmd-legacy-golden.json` holds reference values captured from the legacy `fmd_simulation.php` (13 November 2026) running in headless Chrome. `tools/capture-fmd-legacy-fixtures.mjs` regenerates it from a running legacy site; a second capture produced identical values.

`tests/fmd-engine.test.ts` checks that:

- the default form produces exactly the parameter object that the legacy `runSimulation()` passes to its engine;
- in seven scenarios — district defaults (50 days); farm level in November with vaccination and a clamped environmental factor (180 days); district level in September (365 days); state level in January with population-conserving initial values (200 days); no infected animals at day 0 (120 days); a 3,650-day horizon; and district level in April with vaccination of buffalo, pigs and sheep/goats and other non-default rates (240 days) — every compared value of 15 output series equals the legacy value (largest relative difference 0), as do the seasonal factor, R₀, initial susceptibles and F_env;
- the dashboard's R₀ (1.8875), herd-immunity threshold (47%), environmental factor (1.676) and every daily value of the vaccination-impact series match, including 3,283 cattle infections averted;
- the vaccination-impact comparisons (no vaccination, day-0 stock only, current settings) also match every daily value at farm and state level.

Matching the legacy page shows that the port is faithful. It is not a scientific validation of the model against field data.

DOM tests use a simulated browser environment. The headless-browser check above does not establish real-device behaviour, full accessibility conformance, or production server behaviour. GitHub Pages does not use the nginx configuration. No feedback submissions or emails were sent, and no database is involved.
