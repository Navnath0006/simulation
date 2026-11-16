#!/usr/bin/env node
// Captures golden-master values from the legacy FMD page (fmd_simulation.php) for
// tests/fmd-engine.test.ts. Optional developer tool: it needs the legacy PHP site running
// locally and Google Chrome; CI only reads the committed fixture.
//
//   node tools/capture-fmd-legacy-fixtures.mjs [legacy-url] [output-file]
//
// Defaults: http://localhost/simulation-new/fmd_simulation.php and
// tests/fixtures/fmd-legacy-golden.json. Set CHROME_PATH if Chrome is not found.
// Uses only Node.js 22 built-ins (global WebSocket) and the Chrome DevTools protocol.
import { spawn } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const legacyUrl =
  process.argv[2] || "http://localhost/simulation-new/fmd_simulation.php";
const output = process.argv[3] || "tests/fixtures/fmd-legacy-golden.json";
const chromePath =
  process.env.CHROME_PATH ||
  [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ].find((path) => existsSync(path));
if (!chromePath) throw new Error("Chrome not found; set CHROME_PATH.");

// Runs inside the legacy page. Re-runs the dashboard with the engine entry points wrapped,
// then runs the legacy engine directly for a set of variant scenarios.
async function legacyCapture() {
  const clone = (v) =>
    JSON.parse(
      JSON.stringify(v, (k, x) =>
        x instanceof Float64Array ? Array.from(x) : x,
      ),
    );
  const byId = (id) => document.getElementById(id);
  const calls = [];
  const r0Calls = [];
  const origCore = window.simulateFMDCore;
  const origR0 = window.calculateR0;
  window.simulateFMDCore = function (p, o) {
    const input = clone(p);
    const options = o ? clone(o) : null;
    const res = origCore.apply(this, arguments);
    calls.push({ p: input, opts: options, SB0: res.SB0 });
    return res;
  };
  window.calculateR0 = function (params) {
    const value = origR0.apply(this, arguments);
    r0Calls.push({ params: clone(params), R0: value });
    return value;
  };
  try {
    runSimulation();
  } finally {
    window.simulateFMDCore = origCore;
    window.calculateR0 = origR0;
  }
  const text = (id) =>
    byId(id) ? byId(id).textContent.replace(/\s+/g, " ").trim() : null;
  const displayed = Object.fromEntries(
    [
      "r0Value",
      "herdValue",
      "fenvValue",
      "vsaveValue",
      "vsavePct",
      "vsaveInfNo",
      "vsaveInfYes",
      "vsaveInfAvert",
      "vsaveDeathAvert",
      "vsaveFromStock",
      "vsaveFromCampaign",
      "vsaveVaccinated",
      "vsaveNNV",
      "vsaveSummary",
    ].map((id) => [id, text(id)]),
  );
  const species = clone(readSpecies());
  const vi = clone(window.vaccImpact);
  const base = calls[0].p;
  const setSelect = (id, value) => {
    if (byId(id)) byId(id).value = String(value);
  };
  const keepMode = byId("contactType") ? byId("contactType").value : null;
  const keepMonth = byId("seasonMonth") ? byId("seasonMonth").value : null;
  const series = [
    "S_C",
    "E_C",
    "I_C1",
    "I_C2",
    "R_C",
    "I_B",
    "I_P",
    "I_S",
    "q_C",
    "E_B",
    "S_B",
    "S_P",
    "S_S",
    "V_C1",
    "V_C2",
  ];
  const scenarios = [
    {
      id: "dashboard-default",
      mode: keepMode,
      month: keepMonth,
      T: T_GLOBAL,
      every: 1,
      patch: {},
      sp: {},
    },
    {
      id: "farm-november-vaccination-env",
      mode: "farm",
      month: 11,
      T: 180,
      every: 1,
      patch: { alpha_C: 0.2, temperature: 32, humidity: 75, pH: 7.2, F: 1.2 },
      sp: {},
    },
    {
      id: "district-september-additive",
      mode: "district",
      month: 9,
      T: 365,
      every: 5,
      patch: { beta_C: 0.12, beta_B: 0.07 },
      sp: {},
    },
    {
      id: "state-january-conserved",
      mode: "state",
      month: 1,
      T: 200,
      every: 1,
      patch: { conservePopulation: true, V_B10: 100, V_P0: 50, V_S0: 200 },
      sp: {},
    },
    {
      id: "farm-no-initial-cases",
      mode: "farm",
      month: 0,
      T: 120,
      every: 1,
      patch: { E_C0: 0, I_C10: 0, I_C20: 0, I_B20: 0, I_P0: 0, I_S0: 0 },
      sp: { I_B20: 0, I_P0: 0, I_S0: 0 },
    },
    {
      id: "farm-ten-year-horizon",
      mode: "farm",
      month: 0,
      T: 3650,
      every: 50,
      patch: {},
      sp: {},
    },
    {
      // Exercises vaccination of buffalo, pigs and sheep/goats and other non-default rates.
      id: "district-all-host-vaccination",
      mode: "district",
      month: 4,
      T: 240,
      every: 1,
      patch: {
        alpha_B: 0.05,
        alpha_P: 0.04,
        alpha_S: 0.03,
        I_P0: 6,
        phi: 0.05,
        theta: 0.01,
        mu_B: 0.03,
        D_C: 0.04,
      },
      sp: { I_P0: 6 },
    },
  ];
  const variants = [];
  for (const v of scenarios) {
    setSelect("contactType", v.mode);
    setSelect("seasonMonth", v.month);
    const seasonFactor = getSeasonFactor();
    const p = Object.assign(clone(base), v.patch, {
      contactMode: v.mode,
      seasonFactor,
    });
    if (!("conservePopulation" in v.patch))
      p.conservePopulation = v.mode === "state";
    const sp = Object.assign(clone(species), v.sp);
    const res = origCore(clone(p), { silent: true, species: sp, T: v.T });
    const sim = res.simulationData;
    const r0Input = {
      beta_C: p.beta_C,
      beta_B: p.beta_B,
      beta_BC: +(byId("beta_BC") ? byId("beta_BC").value || 0 : 0),
      beta_CB: +(byId("beta_CB") ? byId("beta_CB").value || 0 : 0),
      beta_PC: +(byId("beta_PC") ? byId("beta_PC").value || 0 : 0),
      beta_SC: +(byId("beta_SC") ? byId("beta_SC").value || 0 : 0),
      S_C0: p.S_C0,
      S_B0: res.SB0,
      rho_1: p.rho_1,
      rho_2: p.rho_2,
      gamma_3: p.gamma_3,
      mu_C: p.mu_C,
      mu_B: p.mu_B,
      D_C: p.D_C,
      phi: p.phi,
      N: p.N,
      B_N: p.B_N,
      sigma_1: p.sigma_1,
      F: p.F,
      temperature: p.temperature,
      humidity: p.humidity,
      pH: p.pH,
    };
    const days = [];
    for (let t = 0; t < sim.S_C.length; t += v.every) days.push(t);
    if (days[days.length - 1] !== sim.S_C.length - 1)
      days.push(sim.S_C.length - 1);
    const picked = {};
    for (const name of series) picked[name] = days.map((t) => sim[name][t]);
    variants.push({
      id: v.id,
      level: v.mode,
      month: +v.month,
      T: v.T,
      seasonFactor,
      params: p,
      species: sp,
      r0Input,
      R0: origR0(r0Input),
      SB0: res.SB0,
      SP0: res.SP0,
      SS0: res.SS0,
      F_env: res.F_env,
      length: sim.S_C.length,
      days,
      series: picked,
    });
  }
  // Vaccination-impact counterfactuals at farm and state level (the dashboard run is district).
  const flows = (c) => ({
    infections: c.inf,
    deaths: c.dth,
    vaccinated: c.vac,
  });
  const vaccinationVariants = [];
  for (const v of [
    {
      id: "farm-vaccination-impact",
      mode: "farm",
      month: 0,
      patch: { alpha_C: 0.15 },
    },
    {
      id: "state-vaccination-impact",
      mode: "state",
      month: 3,
      patch: { V_B10: 100, V_P0: 50, V_S0: 200 },
    },
  ]) {
    setSelect("contactType", v.mode);
    setSelect("seasonMonth", v.month);
    const p = Object.assign(clone(base), v.patch, {
      contactMode: v.mode,
      seasonFactor: getSeasonFactor(),
      conservePopulation: v.mode === "state",
    });
    const sim = origCore(clone(p), { silent: true }).simulationData;
    computeVaccinationImpact(p, sim);
    const w = clone(window.vaccImpact);
    vaccinationVariants.push({
      id: v.id,
      level: v.mode,
      month: v.month,
      T: T_GLOBAL,
      params: p,
      species,
      NC: w.NC,
      last: w.last,
      withVaccination: flows(w.cW),
      noVaccination: flows(w.cN),
      stockOnly: flows(w.cS),
    });
  }
  setSelect("contactType", keepMode);
  setSelect("seasonMonth", keepMonth);
  return {
    integrator: { T_GLOBAL, dt, EULER_SUBSTEPS },
    vaccinationVariants,
    dashboard: {
      params: calls[0].p,
      species,
      r0Input: r0Calls[0].params,
      R0: r0Calls[0].R0,
      displayed,
      vaccination: {
        NC: vi.NC,
        last: vi.last,
        withVaccination: {
          infections: vi.cW.inf,
          deaths: vi.cW.dth,
          vaccinated: vi.cW.vac,
        },
        noVaccination: {
          infections: vi.cN.inf,
          deaths: vi.cN.dth,
          vaccinated: vi.cN.vac,
        },
        stockOnly: {
          infections: vi.cS.inf,
          deaths: vi.cS.dth,
          vaccinated: vi.cS.vac,
        },
      },
    },
    variants,
  };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const profile = mkdtempSync(join(tmpdir(), "fmd-capture-"));
const chrome = spawn(
  chromePath,
  [
    "--headless=new",
    "--remote-debugging-port=0",
    `--user-data-dir=${profile}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-extensions",
    "about:blank",
  ],
  { stdio: "ignore" },
);

try {
  let port = 0;
  for (let i = 0; i < 80 && !port; i++) {
    try {
      port = parseInt(
        readFileSync(join(profile, "DevToolsActivePort"), "utf8"),
        10,
      );
    } catch {
      await sleep(250);
    }
  }
  if (!port) throw new Error("Chrome did not start.");
  const targets = await (
    await fetch(`http://127.0.0.1:${port}/json/list`)
  ).json();
  const socket = new WebSocket(
    targets.find((t) => t.type === "page").webSocketDebuggerUrl,
  );
  await new Promise((resolve, reject) => {
    socket.onopen = resolve;
    socket.onerror = reject;
  });
  let nextId = 0;
  const pending = new Map();
  const exceptions = [];
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(JSON.stringify(message.error)));
      else resolve(message.result);
    } else if (message.method === "Runtime.exceptionThrown") {
      exceptions.push(message.params.exceptionDetails.text);
    }
  };
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++nextId;
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });
  await send("Runtime.enable");
  await send("Page.enable");
  await send("Page.navigate", { url: legacyUrl });
  await sleep(12000);
  const evaluation = await send("Runtime.evaluate", {
    expression: `(${legacyCapture.toString()})()`,
    awaitPromise: true,
    returnByValue: true,
    timeout: 120000,
  });
  if (evaluation.exceptionDetails)
    throw new Error(
      evaluation.exceptionDetails.exception?.description ||
        evaluation.exceptionDetails.text,
    );
  const { result: version } = await send("Runtime.evaluate", {
    expression: "navigator.userAgent",
    returnByValue: true,
  });
  const captured = evaluation.result.value;
  const fixture = {
    source: {
      description:
        "Golden-master values captured from the legacy FMD ODE page (fmd_simulation.php) running in headless Chrome. Regenerate with tools/capture-fmd-legacy-fixtures.mjs.",
      page: legacyUrl,
      capturedAt: new Date().toISOString(),
      browser: String(version.value).replace(
        /.*(HeadlessChrome\/[0-9.]+).*/,
        "$1",
      ),
      integrator: captured.integrator,
      pageExceptions: exceptions,
    },
    dashboard: captured.dashboard,
    variants: captured.variants,
    vaccinationVariants: captured.vaccinationVariants,
  };
  writeFileSync(output, JSON.stringify(fixture));
  console.log(
    `Wrote ${output} (${fixture.variants.length} scenarios, ${fixture.vaccinationVariants.length} vaccination-impact scenarios, legacy R0 ${fixture.dashboard.R0}).`,
  );
  socket.close();
} finally {
  chrome.kill();
  await sleep(500);
  rmSync(profile, { recursive: true, force: true });
}
