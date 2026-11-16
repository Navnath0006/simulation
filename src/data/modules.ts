export type ModuleGroup = "livestock" | "swine" | "zoonotic";
export interface PortalModule {
  id: string;
  name: string;
  shortName: string;
  group: ModuleGroup;
  description: string;
}
export const groups: Record<
  ModuleGroup,
  { label: string; description: string }
> = {
  livestock: {
    label: "Livestock",
    description: "Cattle, sheep and goat research",
  },
  swine: { label: "Swine", description: "Pig health research" },
  zoonotic: {
    label: "Zoonotic & vector-borne",
    description: "Animal and human health research",
  },
};
// Public directory metadata only. No model parameters, engines or datasets.
export const modules: readonly PortalModule[] = [
  {
    id: "fmd",
    name: "Foot & Mouth Disease",
    shortName: "FMD",
    group: "livestock",
    description:
      "A livestock disease research module in the ICAR-NIVEDI portal.",
  },
  {
    id: "ppr",
    name: "Peste des Petits Ruminants",
    shortName: "PPR",
    group: "livestock",
    description: "A research module focused on sheep and goat health.",
  },
  {
    id: "asf",
    name: "African Swine Fever",
    shortName: "ASF",
    group: "swine",
    description: "An African swine fever research module in the portal.",
  },
  {
    id: "csf",
    name: "Classical Swine Fever",
    shortName: "CSF",
    group: "swine",
    description: "A classical swine fever research module in the portal.",
  },
  {
    id: "je",
    name: "Japanese Encephalitis",
    shortName: "JE",
    group: "zoonotic",
    description: "A vector-borne disease research module in the portal.",
  },
  {
    id: "kfd",
    name: "Kyasanur Forest Disease",
    shortName: "KFD",
    group: "zoonotic",
    description: "A forest-associated disease research module in the portal.",
  },
  {
    id: "scrub",
    name: "Scrub Typhus",
    shortName: "ST",
    group: "zoonotic",
    description: "A scrub typhus research module in the portal.",
  },
  {
    id: "nipah",
    name: "Nipah Virus",
    shortName: "NiV",
    group: "zoonotic",
    description: "A Nipah research entry in the existing portal directory.",
  },
  {
    id: "lepto",
    name: "Leptospirosis",
    shortName: "Lep",
    group: "zoonotic",
    description: "A leptospirosis research module in the portal.",
  },
];
export function findModule(id: string): PortalModule | undefined {
  return modules.find((entry) => entry.id === id);
}
export function filterModules(
  query: string,
  group: ModuleGroup | "all",
): readonly PortalModule[] {
  const term = query.trim().toLocaleLowerCase();
  return modules.filter(
    (entry) =>
      (group === "all" || entry.group === group) &&
      (!term ||
        `${entry.name} ${entry.shortName} ${entry.description}`
          .toLocaleLowerCase()
          .includes(term)),
  );
}
