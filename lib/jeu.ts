import type { Classe, Role } from "@/generated/prisma/enums";

/** Les rôles qu'une classe peut tenir en raid. */
export const rolesParClasse: Record<Classe, Role[]> = {
  GUERRIER: ["TANK", "DPS_MELEE"],
  PALADIN: ["TANK", "SOIGNEUR", "DPS_MELEE"],
  CHASSEUR: ["DPS_DISTANCE"],
  VOLEUR: ["DPS_MELEE"],
  PRETRE: ["SOIGNEUR", "DPS_DISTANCE"],
  CHAMAN: ["SOIGNEUR", "DPS_MELEE", "DPS_DISTANCE"],
  MAGE: ["DPS_DISTANCE"],
  DEMONISTE: ["DPS_DISTANCE"],
  DRUIDE: ["TANK", "SOIGNEUR", "DPS_MELEE", "DPS_DISTANCE"],
};

export function rolePossible(classe: Classe, role: Role) {
  return rolesParClasse[classe].includes(role);
}

/** Durée retenue quand le RL n'en indique pas, pour détecter les chevauchements. */
export const DUREE_PAR_DEFAUT_MINUTES = 180;

/** Créneau [début, fin[ d'un raid, en millisecondes UTC. */
export function creneau(annonce: { debutUtc: Date; dureeEstimee: number | null }) {
  const debut = annonce.debutUtc.getTime();
  return { debut, fin: debut + (annonce.dureeEstimee ?? DUREE_PAR_DEFAUT_MINUTES) * 60_000 };
}

export function seChevauchent(
  a: { debutUtc: Date; dureeEstimee: number | null },
  b: { debutUtc: Date; dureeEstimee: number | null },
) {
  const x = creneau(a);
  const y = creneau(b);
  return x.debut < y.fin && y.debut < x.fin;
}

/** Nombre de lignes « besoins précis » dans le formulaire de création. */
export const LIGNES_EXIGENCES = [0, 1, 2, 3];
