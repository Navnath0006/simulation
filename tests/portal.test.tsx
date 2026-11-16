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
  it("shows scope accurately and has no feedback or simulation runner", () => {
    render(<App />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain(
      "disease research",
    );
    expect(screen.getByLabelText("Availability").textContent).toContain(
      "engines are not included",
    );
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
  it("shows module availability rather than a fabricated result", () => {
    window.history.replaceState({}, "", "/#/modules/fmd");
    render(<App />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Foot & Mouth Disease" }),
    ).toBeDefined();
    expect(
      screen.getByRole("heading", {
        name: "Simulation not available in this version",
      }),
    ).toBeDefined();
    expect(screen.queryByRole("button", { name: /run/i })).toBeNull();
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
