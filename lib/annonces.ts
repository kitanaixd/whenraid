import type { StatutInscription, StatutPlace } from "@/generated/prisma/enums";

// Une inscription « active » occupe le joueur sur ce raid.
export const STATUTS_ACTIFS = ["INSCRIT", "LISTE_ATTENTE", "CONFIRME"] as const satisfies StatutInscription[];

export function estActive(statut: StatutInscription) {
  return (STATUTS_ACTIFS as readonly string[]).includes(statut);
}

/**
 * Le RL a déjà (taille − places) joueurs : le raid atteint sa taille quand
 * chaque place encore ouverte a au moins un inscrit actif.
 */
export function estComplet(places: { statut: StatutPlace; inscriptions: { statut: StatutInscription }[] }[]) {
  const aPourvoir = places.filter((p) => p.statut !== "ANNULEE");
  return aPourvoir.length > 0 && aPourvoir.every((p) => p.inscriptions.some((i) => estActive(i.statut)));
}
