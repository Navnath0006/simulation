import { describe, expect, it } from "vitest";
import golden from "./fixtures/fmd-legacy-golden.json";
import {
  COMPARTMENTS,
  calculateR0,
  environmentalFactor,
  findPeak,
  herdImmunityThreshold,
  seasonFactor,
  simulateFmdCore,
  vaccinationImpact,
  type ContactLevel,
  type FmdParams,
  type R0Input,
  type Species,
} from "../src/fmd/engine";
import {
  DEFAULT_INPUTS,
  FIELDS,
  buildParams,
  buildSpecies,
  derivedCattle,
  parametersCsv,
  parseForm,
  resultsCsv,
  runFmdScenario,
  toFormValues,
  type FmdInputs,
} from "../src/fmd/model";

// Series stored by the legacy simulationData object.
const LEGACY_SERIES = [
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
] as const;

const relativeDifference = (a: number, b: number) => {
  const scale = Math.max(Math.abs(a), Math.abs(b));
  return scale === 0 ? 0 : Math.abs(a - b) / scale;
};
const displayedNumber = (text: string) => Number(text.replace(/[,−]/g, ""));

describe("FMD engine parity with the legacy fmd_simulation.php", () => {
  it("assembles the legacy parameter object from the default form", () => {
    expect(buildParams(DEFAULT_INPUTS)).toEqual(golden.dashboard.params);
    expect(buildSpecies(DEFAULT_INPUTS)).toEqual(golden.dashboard.species);
  });

  for (const variant of golden.variants) {
    it(`reproduces every legacy trajectory value: ${variant.id}`, () => {
      const result = simulateFmdCore(
        variant.params as FmdParams,
        variant.species as Species,
        variant.T,
      );
      expect(result.days).toBe(variant.length);
      expect(result.SB0).toBe(variant.SB0);
      expect(result.SP0).toBe(variant.SP0);
      expect(result.SS0).toBe(variant.SS0);
      expect(result.F_env).toBe(variant.F_env);
      let worst = 0;
      for (const name of LEGACY_SERIES) {
        const expected = variant.series[name];
        variant.days.forEach((day, index) => {
          worst = Math.max(
            worst,
            relativeDifference(result.series[name][day], expected[index]),
          );
        });
      }
      // Same operations in the same order: identical doubles are expected.
      expect(worst).toBe(0);
    });

    it(`reproduces the legacy seasonality and R₀: ${variant.id}`, () => {
      const level = variant.level as ContactLevel;
      expect(seasonFactor(level, variant.month)).toBe(variant.seasonFactor);
      expect(
        calculateR0(variant.r0Input as R0Input, level, variant.seasonFactor),
      ).toBe(variant.R0);
    });
  }

  it("reproduces the dashboard tiles, herd immunity and vaccination impact", () => {
    const result = runFmdScenario(DEFAULT_INPUTS);
    const shown = golden.dashboard.displayed;
    expect(result.R0).toBe(golden.dashboard.R0);
    expect(result.R0.toFixed(4)).toBe(shown.r0Value);
    expect(`${result.herdImmunity?.toFixed(0)}%`).toBe(shown.herdValue);
    expect(result.environment.F_env.toFixed(3)).toBe(shown.fenvValue);

    const impact = result.vaccination;
    const legacy = golden.dashboard.vaccination;
    expect(impact.lastDay).toBe(legacy.last);
    expect(impact.cattlePopulation).toBe(legacy.NC);
    for (const key of [
      "withVaccination",
      "noVaccination",
      "stockOnly",
    ] as const)
      for (const flow of ["infections", "deaths", "vaccinated"] as const)
        expect(Array.from(impact[key][flow])).toEqual(legacy[key][flow]);

    expect(Math.round(impact.saved)).toBe(displayedNumber(shown.vsaveValue));
    expect(Math.round(impact.infectionsWithout)).toBe(
      displayedNumber(shown.vsaveInfNo),
    );
    expect(Math.round(impact.infectionsWith)).toBe(
      displayedNumber(shown.vsaveInfYes),
    );
    expect(Math.round(impact.deathsAverted)).toBe(
      displayedNumber(shown.vsaveDeathAvert),
    );
    expect(Math.round(impact.fromStock)).toBe(
      displayedNumber(shown.vsaveFromStock),
    );
    expect(Math.round(impact.fromCampaign)).toBe(
      displayedNumber(shown.vsaveFromCampaign),
    );
    expect(Math.round(impact.vaccinated)).toBe(
      displayedNumber(shown.vsaveVaccinated),
    );
    expect(impact.numberNeededToVaccinate?.toFixed(1)).toBe(shown.vsaveNNV);
    expect(
      `${impact.percentFewer.toFixed(1)}% fewer infections • ${((impact.saved / impact.cattlePopulation) * 100).toFixed(2)}% of cattle`,
    ).toBe(shown.vsavePct);
  });

  for (const variant of golden.vaccinationVariants) {
    it(`reproduces the legacy vaccination counterfactuals: ${variant.id}`, () => {
      const params = variant.params as FmdParams;
      const species = variant.species as Species;
      const core = simulateFmdCore(params, species, variant.T);
      const impact = vaccinationImpact(
        params,
        species,
        variant.T,
        core.series,
        species.NC,
      );
      expect(impact.lastDay).toBe(variant.last);
      expect(impact.cattlePopulation).toBe(variant.NC);
      for (const key of [
        "withVaccination",
        "noVaccination",
        "stockOnly",
      ] as const)
        for (const flow of ["infections", "deaths", "vaccinated"] as const)
          expect(Array.from(impact[key][flow])).toEqual(variant[key][flow]);
    });
  }
});

describe("FMD engine behaviour", () => {
  it("uses the cardinal environmental response with clamping", () => {
    expect(environmentalFactor(20, 60, 7).F_env).toBeCloseTo(1, 12);
    expect(environmentalFactor(-5, 60, 7).F_env).toBe(0);
    expect(environmentalFactor(35, 80, 7.5).F_env).toBe(2);
  });

  it("applies additive seasonality at district/state level and multiplicative at farm level", () => {
    expect(seasonFactor("farm", 0)).toBe(1);
    expect(seasonFactor("district", 0)).toBe(0);
    expect(seasonFactor("state", 0)).toBe(0);
    expect(seasonFactor("farm", 1)).toBe(1.59);
    expect(seasonFactor("district", 9)).toBe(0.16213);
    expect(seasonFactor("state", 1)).toBe(0.120605);
  });

  it("reports herd immunity only when R₀ exceeds 1", () => {
    expect(herdImmunityThreshold(0.9)).toBeNull();
    expect(herdImmunityThreshold(1)).toBeNull();
    expect(herdImmunityThreshold(2)).toBe(50);
    expect(findPeak([1, 5, 5, 2])).toEqual({ peak: 5, peakDay: 1 });
    expect(findPeak([])).toEqual({ peak: 0, peakDay: 0 });
  });

  it("derives day-0 susceptible and recovered cattle as the legacy form does", () => {
    const district = derivedCattle(DEFAULT_INPUTS);
    expect(district).toEqual({
      N: 592366,
      R_C0: 372,
      S_C0: 257944,
      cattleOverflow: 0,
    });
    const farm = derivedCattle({ ...DEFAULT_INPUTS, level: "farm" });
    expect(farm.R_C0).toBe(0);
    expect(farm.S_C0).toBe(258316);
    const crowded = derivedCattle({ ...DEFAULT_INPUTS, NC: 1000 });
    expect(crowded.S_C0).toBe(0);
    expect(crowded.cattleOverflow).toBeGreaterThan(0);
    expect(runFmdScenario({ ...DEFAULT_INPUTS, NC: 1000 }).warnings[0]).toMatch(
      /exceed the cattle population/,
    );
  });

  it("stays finite and non-negative for long, intense and seasonal scenarios", () => {
    const scenarios: FmdInputs[] = [
      { ...DEFAULT_INPUTS, days: 3650 },
      {
        ...DEFAULT_INPUTS,
        level: "farm",
        month: 1,
        beta_C: 10,
        beta_B: 10,
        days: 365,
      },
      { ...DEFAULT_INPUTS, level: "state", month: 11, V_B10: 25000, days: 400 },
      {
        ...DEFAULT_INPUTS,
        temperature: -10,
        humidity: 0,
        pH: 0,
        F: 0,
        days: 30,
      },
    ];
    for (const inputs of scenarios) {
      const result = runFmdScenario(inputs);
      expect(result.core.days).toBe(inputs.days);
      for (const name of COMPARTMENTS)
        for (const value of result.core.series[name]) {
          expect(Number.isFinite(value)).toBe(true);
          expect(value).toBeGreaterThanOrEqual(0);
        }
      expect(Number.isFinite(result.R0)).toBe(true);
    }
  });
});

describe("FMD form and exports", () => {
  it("round-trips the default form and rejects invalid values", () => {
    const values = toFormValues(DEFAULT_INPUTS);
    expect(parseForm(values, "district", 0).inputs).toEqual(DEFAULT_INPUTS);
    const invalid = parseForm(
      { ...values, days: "5", beta_C: "abc", NC: "12.5", phi: "" },
      "district",
      0,
    );
    expect(invalid.inputs).toBeNull();
    expect(invalid.errors).toEqual({
      days: "Must be between 10 and 3650.",
      beta_C: "Enter a number.",
      NC: "Enter a whole number.",
      phi: "Enter a number.",
    });
  });

  it("documents every editable field once", () => {
    const keys = FIELDS.map((field) => field.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.sort()).toEqual(
      Object.keys(DEFAULT_INPUTS)
        .filter((key) => key !== "level" && key !== "month")
        .sort(),
    );
  });

  it("exports one CSV row per day and the full parameter set", () => {
    const result = runFmdScenario(DEFAULT_INPUTS);
    const rows = resultsCsv(result).trim().split("\n");
    expect(rows).toHaveLength(DEFAULT_INPUTS.days + 1);
    expect(rows[0].split(",")).toEqual(["day", ...COMPARTMENTS, "I_total"]);
    expect(parametersCsv(result)).toContain("beta_C,0.21");
    expect(parametersCsv(result)).toContain(`R0,${result.R0}`);
  });
});
