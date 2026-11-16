import { describe, expect, it } from "vitest";
import { parseRoute } from "../src/navigation";
import {
  filterModules,
  findModule,
  groups,
  modules,
} from "../src/data/modules";
describe("portal routes", () => {
  it("recognizes public pages and valid module routes", () => {
    expect(parseRoute("#/")).toEqual({ page: "home" });
    expect(parseRoute("#/modules")).toEqual({ page: "modules" });
    expect(parseRoute("#/team")).toEqual({ page: "team" });
    expect(parseRoute("#/contact")).toEqual({ page: "contact" });
    for (const entry of modules)
      expect(parseRoute(`#/modules/${entry.id}`)).toEqual({
        page: "module",
        id: entry.id,
      });
  });
  it("safely rejects unknown or malformed routes", () => {
    for (const hash of [
      "#/modules/unknown",
      "#/modules/__proto__",
      "#/modules/../../config.php",
      "#/modules/%3Cscript%3E",
      "#/feedback",
    ])
      expect(parseRoute(hash)).toEqual({ page: "not-found" });
  });
  it("reads known legacy module selections without executing the old PHP page", () => {
    expect(parseRoute("", "?d=fmd&v=sim")).toEqual({
      page: "module",
      id: "fmd",
    });
    expect(parseRoute("", "?d[]=fmd")).toEqual({ page: "home" });
    expect(parseRoute("", "?d=__proto__")).toEqual({ page: "home" });
    expect(parseRoute("#/team", "?d=fmd")).toEqual({ page: "team" });
    expect(parseRoute("#/", "?d=fmd")).toEqual({ page: "home" });
  });
});
describe("public module directory", () => {
  it("filters by search and group together without mutating the registry", () => {
    expect(filterModules("  fMd  ", "all").map((entry) => entry.id)).toEqual([
      "fmd",
    ]);
    expect(filterModules("fmd", "swine")).toEqual([]);
    expect(filterModules("", "swine").map((entry) => entry.id)).toEqual([
      "asf",
      "csf",
    ]);
    expect(filterModules("<script>", "all")).toEqual([]);
    expect(modules).toHaveLength(9);
  });
  it("has unique known identifiers and no executable module content", () => {
    expect(new Set(modules.map((entry) => entry.id)).size).toBe(modules.length);
    for (const entry of modules) {
      expect(groups[entry.group]).toBeDefined();
      expect(findModule(entry.id)).toBe(entry);
      expect(Object.keys(entry).sort()).toEqual([
        "description",
        "group",
        "id",
        "name",
        "shortName",
      ]);
    }
  });
});
