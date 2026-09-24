import type { Region, Ruleset } from "@/generated/prisma/enums";

// Icônes dessinées pour WhenRaid : tête de dragon (PvE), épées croisées (PvP), chope (RP).
export const ICONES_RULESET: Partial<Record<Ruleset, string>> = {
  NORMAL: "/rulesets/NORMAL.svg",
  PVP: "/rulesets/PVP.svg",
  RP: "/rulesets/RP.svg",
};
export const DRAPEAUX: Partial<Record<Region, string>> = { EU: "/regions/EU.svg" };
