// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import App from "../src/App";

beforeEach(() => {
  window.history.replaceState({}, "", "/");
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("React portal interface", () => {
  it("moves focus out of the menu when its current route is selected", () => {
    window.history.replaceState({}, "", "/#/team");
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /Menu/ }));
    const navigation = screen.getByRole("navigation", {
      name: "Main navigation",
    });
    const currentLink = within(navigation).getByRole("link", { name: "Team" });
    currentLink.focus();
    fireEvent.click(currentLink);
    expect(document.activeElement).toBe(screen.getByRole("main"));
    expect(
      screen
        .getByRole("button", { name: /Menu/ })
        .getAttribute("aria-expanded"),
    ).toBe("false");
  });
  it("shows scope accurately and has no feedback form or embedded legacy page", () => {
    render(<App />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain(
      "disease research",
    );
    const availability = screen.getByLabelText("Availability").textContent;
    expect(availability).toContain(
      "Foot & Mouth Disease simulator is available",
    );
    expect(availability).toContain("engines are not included");
    expect(screen.queryByRole("link", { name: /feedback/i })).toBeNull();
    expect(document.querySelector("iframe, form")).toBeNull();
  });
  it("filters the catalogue by group and query, and clears empty results", () => {
    window.history.replaceState({}, "", "/#/modules");
    render(<App />);
    expect(screen.getByRole("status").textContent).toContain("9 entries");
    fireEvent.click(screen.getByRole("radio", { name: /^Swine/ }));
    expect(screen.getByRole("status").textContent).toContain("2 entries");
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "classical" },
    });
    expect(screen.getByRole("status").textContent).toContain("1 entry");
    expect(
      screen.getByRole("heading", { name: "Classical Swine Fever" }),
    ).toBeDefined();
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "<script>" },
    });
    expect(
      screen.getByRole("heading", { name: "No matching modules" }),
    ).toBeDefined();
    expect(document.querySelector("script")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByRole("status").textContent).toContain("9 entries");
  });
  it("applies group links from the home page", () => {
    window.history.replaceState({}, "", "/#/modules?group=swine");
    render(<App />);
    expect(screen.getByRole("status").textContent).toContain("2 entries");
  });
  it("shows availability rather than a fabricated result for modules without a simulator", () => {
    window.history.replaceState({}, "", "/#/modules/asf");
    render(<App />);
    expect(
      screen.getByRole("heading", { level: 1, name: "African Swine Fever" }),
    ).toBeDefined();
    expect(
      screen.getByRole("heading", {
        name: "Simulation not available in this version",
      }),
    ).toBeDefined();
    expect(screen.queryByRole("button", { name: /run/i })).toBeNull();
    expect(screen.queryByLabelText("Simulation parameters")).toBeNull();
  });
  it("labels only the FMD card as a simulator in the directory", () => {
    window.history.replaceState({}, "", "/#/modules");
    render(<App />);
    const cards = document.querySelectorAll<HTMLAnchorElement>(".module-card");
    const simulators = [...cards].filter((card) =>
      card.textContent?.includes("Open simulator"),
    );
    expect(simulators.map((card) => card.getAttribute("href"))).toEqual([
      "#/modules/fmd",
    ]);
  });
  it("handles hash navigation and an unknown module", () => {
    render(<App />);
    window.history.replaceState({}, "", "/#/modules/unknown");
    fireEvent(window, new HashChangeEvent("hashchange"));
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain(
      "back on track",
    );
    window.history.replaceState({}, "", "/#/contact");
    fireEvent(window, new HashChangeEvent("hashchange"));
    expect(
      screen.getByRole("heading", { level: 1, name: "Contact Information" }),
    ).toBeDefined();
    expect(document.querySelectorAll('a[href^="mailto:"]')).toHaveLength(3);
    expect(document.querySelector("form")).toBeNull();
  });
  it("renders all six team members with local portraits", () => {
    window.history.replaceState({}, "", "/#/team");
    render(<App />);
    expect(document.querySelectorAll(".person-card")).toHaveLength(6);
    for (const portrait of document.querySelectorAll<HTMLImageElement>(
      ".portrait-wrap img",
    )) {
      expect(portrait.getAttribute("src")).toContain("assets/people/");
      expect(portrait.alt.length).toBeGreaterThan(0);
    }
  });
  it("supports menu Escape and marks the active navigation link", () => {
    render(<App />);
    const toggle = screen.getByRole("button", { name: /Menu/ });
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(toggle);
    const navigation = screen.getByRole("navigation", {
      name: "Main navigation",
    });
    expect(
      within(navigation)
        .getByRole("link", { name: "Home" })
        .getAttribute("aria-current"),
    ).toBe("page");
  });
});
