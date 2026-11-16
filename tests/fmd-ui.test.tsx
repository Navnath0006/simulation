// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import App from "../src/App";
import { COMPARTMENTS } from "../src/fmd/engine";
import { DEFAULT_INPUTS, runFmdScenario } from "../src/fmd/model";

beforeEach(() => {
  window.history.replaceState({}, "", "/#/modules/fmd");
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const kpi = (label: string) =>
  screen
    .getByText(label, { selector: "dt" })
    .parentElement?.querySelector(".fmd-kpi-value")?.textContent;

async function openSimulator() {
  render(<App />);
  await screen.findByLabelText("Simulation parameters");
}

const setValue = (label: RegExp | string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe("FMD simulator", () => {
  it("shows the legacy dashboard figures for the default inputs", async () => {
    await openSimulator();
    expect(
      screen.getByRole("heading", { level: 1, name: "Foot & Mouth Disease" }),
    ).toBeDefined();
    expect(kpi("Basic reproduction number R₀")).toBe("1.8875");
    expect(kpi("Herd immunity threshold")).toBe("47%");
    expect(kpi("Environmental factor F_env")).toBe("1.676");
    expect(kpi("Cattle infections averted by vaccination")).toBe("3,283");
    expect(document.title).toBe("Foot & Mouth Disease simulator | ICAR-NIVEDI");
    // CSP: form-action 'none'; no legacy page is embedded.
    expect(document.querySelector("form, iframe")).toBeNull();
  });

  it("recalculates on input and keeps the last valid results while a value is invalid", async () => {
    await openSimulator();
    setValue(/Cattle transmission rate/, "0.3");
    const expected = runFmdScenario({
      ...DEFAULT_INPUTS,
      beta_C: 0.3,
    }).R0.toFixed(4);
    await waitFor(() =>
      expect(kpi("Basic reproduction number R₀")).toBe(expected),
    );

    setValue(/Simulation days/, "5");
    expect(screen.getByText("Must be between 10 and 3650.")).toBeDefined();
    expect(
      screen.getByLabelText(/Simulation days/).getAttribute("aria-invalid"),
    ).toBe("true");
    expect(screen.getByText(/1 value needs correction/)).toBeDefined();
    expect(kpi("Basic reproduction number R₀")).toBe(expected);

    fireEvent.click(screen.getByRole("button", { name: "Reset to defaults" }));
    await waitFor(() =>
      expect(kpi("Basic reproduction number R₀")).toBe("1.8875"),
    );
    expect(
      (screen.getByLabelText(/Simulation days/) as HTMLInputElement).value,
    ).toBe("50");
  });

  it("applies the level and seasonality like the legacy page", async () => {
    await openSimulator();
    setValue("Level", "farm");
    const month = screen.getByLabelText(
      "Seasonality (month)",
    ) as HTMLSelectElement;
    expect(month.options[11].text).toBe("November (1.51×)");
    setValue("Seasonality (month)", "11");
    const expected = runFmdScenario({
      ...DEFAULT_INPUTS,
      level: "farm",
      month: 11,
    }).R0.toFixed(4);
    await waitFor(() =>
      expect(kpi("Basic reproduction number R₀")).toBe(expected),
    );
    expect(screen.getByText(/Susceptible cattle S_C =/).textContent).toContain(
      "2,58,316",
    );
  });

  it("warns when state-level day-0 compartments exceed a population", async () => {
    await openSimulator();
    setValue("Level", "state");
    setValue("Vaccinated buffalo", "30000");
    expect(
      await screen.findByText(
        /State level: day-0 buffalo compartments exceed the population by 10,378/,
      ),
    ).toBeDefined();
  });

  it("toggles chart series and scale and moves the day shown", async () => {
    await openSimulator();
    const legend = screen.getByRole("group", { name: "Series shown" });
    const susceptible = within(legend).getByRole("button", {
      name: "Susceptible cattle",
    });
    const lines = () => document.querySelectorAll(".fmd-chart polyline").length;
    const before = lines();
    expect(susceptible.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(susceptible);
    expect(susceptible.getAttribute("aria-pressed")).toBe("true");
    expect(lines()).toBe(before + 1);

    fireEvent.click(screen.getByRole("checkbox", { name: "Log scale" }));
    expect(document.querySelector(".fmd-chart")?.textContent).toContain(
      "Animals (log scale)",
    );

    const peakDay = runFmdScenario(DEFAULT_INPUTS).peak.peakDay;
    fireEvent.click(
      screen.getByRole("button", { name: `Go to peak (day ${peakDay})` }),
    );
    expect(
      screen.getByRole("heading", { name: `Animals on day ${peakDay}` }),
    ).toBeDefined();
    setValue("Day shown in the table", "10");
    expect(
      screen.getByRole("heading", { name: "Animals on day 10" }),
    ).toBeDefined();
  });

  it("keeps simulator inputs when switching to the model view and back", async () => {
    await openSimulator();
    setValue(/Cattle transmission rate/, "0.25");
    window.history.replaceState({}, "", "/#/modules/fmd/model");
    fireEvent(window, new HashChangeEvent("hashchange"));
    expect(
      await screen.findByRole("heading", {
        name: "Validation against the legacy page",
      }),
    ).toBeDefined();
    const tabs = screen.getByRole("navigation", {
      name: "Foot & Mouth Disease views",
    });
    expect(
      within(tabs)
        .getByRole("link", { name: "Model & validation" })
        .getAttribute("aria-current"),
    ).toBe("page");
    expect(document.title).toBe("Foot & Mouth Disease model | ICAR-NIVEDI");

    window.history.replaceState({}, "", "/#/modules/fmd");
    fireEvent(window, new HashChangeEvent("hashchange"));
    expect(
      (screen.getByLabelText(/Cattle transmission rate/) as HTMLInputElement)
        .value,
    ).toBe("0.25");
  });

  it("creates CSV downloads in the browser", async () => {
    const blobs: Blob[] = [];
    const original = {
      create: URL.createObjectURL,
      revoke: URL.revokeObjectURL,
    };
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: (blob: Blob) => {
        blobs.push(blob);
        return "blob:fmd-test";
      },
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: () => {},
    });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    try {
      await openSimulator();
      fireEvent.click(
        screen.getByRole("button", { name: "Download daily results (CSV)" }),
      );
      fireEvent.click(
        screen.getByRole("button", { name: "Download parameters (CSV)" }),
      );
      expect(click).toHaveBeenCalledTimes(2);
      const results = await blobs[0].text();
      expect(results.split("\n")[0]).toBe(
        ["day", ...COMPARTMENTS, "I_total"].join(","),
      );
      expect(results.trim().split("\n")).toHaveLength(DEFAULT_INPUTS.days + 1);
      expect(await blobs[1].text()).toContain("contactMode,district");
    } finally {
      Object.defineProperty(URL, "createObjectURL", {
        configurable: true,
        writable: true,
        value: original.create,
      });
      Object.defineProperty(URL, "revokeObjectURL", {
        configurable: true,
        writable: true,
        value: original.revoke,
      });
    }
  });

  it("opens from a legacy dashboard link", async () => {
    window.history.replaceState({}, "", "/?d=fmd&v=sim");
    render(<App />);
    expect(await screen.findByLabelText("Simulation parameters")).toBeDefined();
  });
});
