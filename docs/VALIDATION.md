# Validation

Checked locally on 16 November 2026 using Node.js 22.19.0.

| Check | Result |
| --- | --- |
| TypeScript and production build | Passed with `npm run build` |
| Automated tests | 13 passed across route, catalogue, and DOM interface checks |
| Dependency audit | Zero known vulnerabilities reported by `npm audit` at review time |
| Build asset references | Entry assets and all six team portraits present |
| Release file inventory | No PHP, SQL, spreadsheets, scientific data exports, or secret files in `dist/` |
| Local HTTP | Home, logo, and a representative portrait returned HTTP 200 |
| Peer review | Same-route mobile-menu focus defect corrected and covered by a regression test |
| Visual browser inspection | Unavailable because the browser access host was unavailable |
| Docker execution | Not tested; Docker is not installed on the local machine |

DOM tests use a simulated browser environment. They do not establish real-device layout, full accessibility conformance, or production server behavior. The nginx configuration has been reviewed but not executed here. GitHub Pages does not use that nginx configuration.

These checks cover only the informational React portal. No scientific engines were ported, executed, or validated. No feedback submissions or emails were sent, and no database is involved.
