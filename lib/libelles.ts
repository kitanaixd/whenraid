import type {
  Classe,
  Faction,
  ReglesLoot,
  Region,
  Role,
  Ruleset,
  StatutAnnonce,
  StatutInscription,
  StatutPlace,
} from "@/generated/prisma/enums";

export const libelleClasse: Record<Classe, string> = {
  GUERRIER: "Guerrier",
  PALADIN: "Paladin",
  CHASSEUR: "Chasseur",
  VOLEUR: "Voleur",
  PRETRE: "Prêtre",
  CHAMAN: "Chaman",
  MAGE: "Mage",
  DEMONISTE: "Démoniste",
  DRUIDE: "Druide",
};

export const libelleRole: Record<Role, string> = {
  TANK: "Tank",
  SOIGNEUR: "Soigneur",
  DPS_MELEE: "DPS corps à corps",
  DPS_DISTANCE: "DPS distance",
};

export const libelleFaction: Record<Faction, string> = {
  ALLIANCE: "Alliance",
  HORDE: "Horde",
};

export const libelleRuleset: Record<Ruleset, string> = {
  NORMAL: "Normal",
  PVP: "JcJ",
  HARDCORE: "Hardcore",
};

export const libelleRegion: Record<Region, string> = {
  EU: "Europe",
  US: "Amérique",
};

export const libelleReglesLoot: Record<ReglesLoot, string> = {
  ROLL: "Roll",
  LOOT_COUNCIL: "Loot council",
  DKP: "DKP",
  RESERVE: "Réservations",
};

export const libelleStatutAnnonce: Record<StatutAnnonce, string> = {
  BROUILLON: "Brouillon",
  PUBLIEE: "Publiée",
  COMPLETE: "Complète",
  ANNULEE: "Annulée",
  PASSEE: "Passée",
  CLOTUREE: "Clôturée",
};

export const libelleStatutPlace: Record<StatutPlace, string> = {
  OUVERTE: "Ouverte",
  POURVUE: "Pourvue",
  ANNULEE: "Annulée",
};

export const libelleStatutInscription: Record<StatutInscription, string> = {
  INSCRIT: "Inscrit",
  LISTE_ATTENTE: "Liste d'attente",
  CONFIRME: "Confirmé",
  RETIRE: "Retiré",
  REFUSE: "Refusé",
};

/** Les clés d'un dictionnaire de libellés, dans l'ordre, pour les <select>. */
export function options<T extends string, V>(libelles: Record<T, V>) {
  return Object.entries(libelles) as [T, V][];
}
