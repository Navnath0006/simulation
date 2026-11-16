# Simulation portal

A standalone React 19, TypeScript, and Vite 8 frontend for the portal. It provides the home page, a searchable module catalogue, team/contact information, and the **Foot & Mouth Disease (FMD) ODE simulator**.

**This is a partial migration, not a full conversion of the legacy simulations.** The FMD simulator is a TypeScript port of the core engine of the legacy `fmd_simulation.php`, tested to give identical results; several legacy FMD panels and the other FMD pages are not migrated yet. Other catalogue entries describe modules and do not execute simulations. Datasets, manuscripts, and legacy embedded pages are not part of this repository. See [migration status](docs/MIGRATION_STATUS.md).

The app has no feedback form, backend, database, server credentials, iframe integration, or legacy proxy. Simulations run in the browser. The production output is static files in `dist/`.

## Develop and verify

Use Node.js 22 (22.19.0 or later) and npm. From this repository:

```sh
npm ci
npm run dev
```

In Windows PowerShell, use `npm.cmd` in place of `npm` if the shell blocks `npm.ps1`; no execution-policy change is needed. Vite prints the local preview address, normally `http://127.0.0.1:5173/`.

```sh
npm test
npm audit --audit-level=high
npm run build
npm run preview
```

`npm run preview` is a local build preview. Use a static web server for deployment. Routes use URL hashes, so deployment does not require a server-side route fallback. Vite reads the optional build-time `BASE_PATH` environment variable and otherwise uses relative asset paths (`./`).

## Build and deployment

GitHub Actions runs tests, a non-mutating dependency audit, and a production build on pull requests and pushes to `main`, then retains the static artifact for 14 days. The audit fails on high or critical vulnerabilities; dependency changes should be reviewed and committed separately.

The repository includes a non-root nginx container and a manual GitHub Pages workflow. Neither establishes a server destination or publishes on push. Follow [deployment instructions](docs/DEPLOYMENT.md) for static hosting, container packaging, or explicitly enabling Pages.

## Main files

- `src/`: React portal source and catalogue.
- `src/fmd/`: FMD simulator — `engine.ts` (model equations, R₀, vaccination impact), `model.ts` (form fields, defaults, parameter assembly, CSV export) and the React views.
- `public/`: local assets copied to the static build.
- `tests/`: automated checks, including FMD parity tests against `tests/fixtures/fmd-legacy-golden.json`.
- `tools/capture-fmd-legacy-fixtures.mjs`: optional; regenerates the FMD reference values from a running legacy site with headless Chrome (`node tools/capture-fmd-legacy-fixtures.mjs [legacy-url]`). Not used by CI.
- `.github/workflows/`: validation and optional manual Pages deployment.
- `deploy/`: nginx configuration and packaging for an existing build artifact.

No environment secrets are required. Values placed in frontend source or build-time environment variables can become public in the generated site.

Recorded checks and verification limits are in [validation](docs/VALIDATION.md).
