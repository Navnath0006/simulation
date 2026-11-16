import { findModule } from "./data/modules";
export type Route =
  | { page: "home" | "modules" | "team" | "contact" | "not-found" }
  | { page: "module"; id: string };
export function parseRoute(hash: string, search = ""): Route {
  if (!hash || hash === "#") {
    const legacyId = new URLSearchParams(search).get("d");
    return legacyId && findModule(legacyId)
      ? { page: "module", id: legacyId }
      : { page: "home" };
  }
  if (hash === "#/") return { page: "home" };
  const path = hash.replace(/^#/, "").replace(/\/$/, "");
  if (path === "/modules") return { page: "modules" };
  if (path === "/team") return { page: "team" };
  if (path === "/contact") return { page: "contact" };
  const match = /^\/modules\/([a-z]+)$/.exec(path);
  if (match && findModule(match[1])) return { page: "module", id: match[1] };
  return { page: "not-found" };
}
export function assetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, "")}`;
}
