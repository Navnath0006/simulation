import { findModule } from "./data/modules";
export type ModuleView = "simulator" | "model";
/** Modules with interactive content in this application, and their views (first = default). */
export const MODULE_VIEWS: Readonly<Record<string, readonly ModuleView[]>> = {
  fmd: ["simulator", "model"],
};
export function moduleViews(id: string): readonly ModuleView[] {
  return Object.prototype.hasOwnProperty.call(MODULE_VIEWS, id)
    ? MODULE_VIEWS[id]
    : [];
}
export type Route =
  | { page: "home" | "modules" | "team" | "contact" | "not-found" }
  | { page: "module"; id: string; view?: ModuleView };
// Legacy dashboard.php views (?d=<module>&v=<view>) mapped to views of this application.
const LEGACY_VIEWS: Readonly<Record<string, ModuleView>> = {
  sim: "simulator",
  guide: "model",
  theory: "model",
};
export function parseRoute(hash: string, search = ""): Route {
  if (!hash || hash === "#") {
    const params = new URLSearchParams(search);
    const legacyId = params.get("d");
    if (!legacyId || !findModule(legacyId)) return { page: "home" };
    const legacyView = params.get("v");
    const view =
      legacyView &&
      Object.prototype.hasOwnProperty.call(LEGACY_VIEWS, legacyView)
        ? LEGACY_VIEWS[legacyView]
        : undefined;
    const views = moduleViews(legacyId);
    return view && view !== views[0] && views.includes(view)
      ? { page: "module", id: legacyId, view }
      : { page: "module", id: legacyId };
  }
  if (hash === "#/") return { page: "home" };
  const path = hash.replace(/^#/, "").replace(/\/$/, "");
  if (path === "/modules") return { page: "modules" };
  if (path === "/team") return { page: "team" };
  if (path === "/contact") return { page: "contact" };
  const match = /^\/modules\/([a-z]+)(?:\/([a-z]+))?$/.exec(path);
  if (match && findModule(match[1])) {
    const [, id, view] = match;
    if (!view) return { page: "module", id };
    if ((moduleViews(id) as readonly string[]).includes(view))
      return { page: "module", id, view: view as ModuleView };
  }
  return { page: "not-found" };
}
export function assetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, "")}`;
}
