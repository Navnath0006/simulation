# Deployment

The deployable product is the informational React portal described in [migration status](MIGRATION_STATUS.md). It contains no runnable scientific engines, feedback service, backend, or database. Node.js is needed to build it; the resulting site needs only a static file server.

## Static files or a CI artifact

Run `npm ci`, `npm test`, `npm audit --audit-level=high`, and `npm run build` with Node.js 22.19.0 or later on the Node 22 line. Publish only the contents of `dist/` to your chosen static document root.

Alternatively, download `simulation-dist-<commit SHA>` from a successful **CI** run for the reviewed commit and extract its contents into `dist/`. Verify that `dist/index.html` exists. The workflow retains these artifacts for 14 days. No workflow copies files to an external server, configures SSH, or manages a hosting account.

The default asset base is `./`, suitable for a root site or a site served beneath a directory. Hash routes stay in the browser, so unknown server paths and missing JavaScript/CSS files should return HTTP 404 instead of the application HTML. Serve the deployment directory with its trailing slash when mounting it beneath a path.

To build an explicit project path in PowerShell:

```powershell
$env:BASE_PATH = '/simulation/'
npm run build
Remove-Item Env:BASE_PATH
```

`BASE_PATH` is a public build setting, not a runtime secret. Local assets must use the Vite base path when referenced from application code.

## Container from source

With Docker available, run from the repository root:

```sh
docker build --pull -t simulation:local .
docker run --rm --name simulation -p 127.0.0.1:8080:8080 --read-only --tmpfs /tmp:rw,noexec,nosuid,size=64m --cap-drop ALL --security-opt no-new-privileges simulation:local
```

Open `http://localhost:8080`. The build runs the locked npm install, tests, and production build. The final image contains nginx and static files, runs as the nginx user on port 8080, and needs writable temporary space only in `/tmp`. Its health check requests the home page. The loopback binding is for local inspection; configure your own HTTPS reverse proxy or hosting platform for public serving.

Container base images are pinned to registry manifest digests. `--pull` verifies the selected digest; it does not advance a pinned image. Review upstream updates and deliberately refresh both nginx references and the Node reference when rebuilding for new security releases.

## Container from the exact CI artifact

Extract the successful CI artifact into `dist/`, then package that build without reinstalling dependencies or rebuilding source:

```sh
docker build --pull -f deploy/Dockerfile.artifact -t simulation:artifact .
docker run --rm --name simulation -p 127.0.0.1:8080:8080 --read-only --tmpfs /tmp:rw,noexec,nosuid,size=64m --cap-drop ALL --security-opt no-new-privileges simulation:artifact
```

The artifact-specific Docker ignore file admits only `dist/` and the nginx configuration. The source-build Docker ignore file excludes local dependencies, build output, Git metadata, environment files, and common key files.

The supplied nginx configuration disables directory listings, returns real 404s for missing files, applies a same-origin content security policy without inline script/style exceptions, and adds framing and MIME-type protections. It does not provide TLS itself. When using another static host, configure equivalent headers if that host supports them. GitHub Pages does not apply this nginx configuration.

## Optional manual GitHub Pages publication

Pushing this repository does **not** publish it. To use Pages:

1. In the GitHub repository, open **Settings → Pages** and set the build source to **GitHub Actions**.
2. Configure the `github-pages` environment and any required reviewers or deployment-branch restrictions you need.
3. Open **Actions → Deploy GitHub Pages (manual) → Run workflow** and select the default branch.

The workflow only accepts the default branch, reads existing Pages configuration with automatic enablement disabled, runs tests and the dependency audit, builds with `BASE_PATH` from the configured Pages site, and publishes the resulting artifact. An unconfigured Pages site causes the workflow to fail before building or publishing. For a repository named `simulation`, the usual project-site path is `/simulation/`; a configured custom domain can instead use `/`.

The deploy job uses the built-in GitHub token with Pages write permission and OIDC. No personal access token, SSH key, or copied credential is required. CI has read-only repository permission and never runs `npm audit fix` or commits dependency changes.

Workflow actions are pinned to full commit SHAs verified against their official `actions/*` repositories. Update pins through review when upstream releases change. See GitHub's [custom Pages workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages), the official [Pages configuration action](https://github.com/actions/configure-pages), and [artifact upload action](https://github.com/actions/upload-artifact) for the hosting and artifact contracts.

## Deployment checks

After choosing a host, verify the home page, catalogue search, team/contact navigation, and browser refresh on a hash route. Confirm a missing asset returns HTTP 404, inspect the browser console for blocked or missing resources, and check the deployed build matches the intended commit. These checks cover the informational portal only.
