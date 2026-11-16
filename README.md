# Simulation portal

A standalone React 19, TypeScript, and Vite 8 frontend for the informational portal. It provides the home page, a searchable module catalogue, and team/contact information.

**This is a partial portal migration, not a full conversion of the legacy simulations.** Catalogue entries describe modules; they do not execute scientific simulations. Scientific engines, datasets, manuscripts, and legacy embedded pages are not part of this repository. See [migration status](docs/MIGRATION_STATUS.md).

The app has no feedback form, backend, database, server credentials, iframe integration, or legacy proxy. The production output is static files in `dist/`.

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

- `src/`: React portal source and informational catalogue.
- `public/`: local assets copied to the static build.
- `tests/`: automated portal checks.
- `.github/workflows/`: validation and optional manual Pages deployment.
- `deploy/`: nginx configuration and packaging for an existing build artifact.

No environment secrets are required. Values placed in frontend source or build-time environment variables can become public in the generated site.

Recorded checks and verification limits are in [validation](docs/VALIDATION.md).
