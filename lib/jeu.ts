import type { Classe, Role } from "@/generated/prisma/enums";

/** Les rôles qu'une classe peut tenir en raid. */
export const rolesParClasse: Record<Classe, Role[]> = {
  GUERRIER: ["TANK", "DPS"],
  PALADIN: ["TANK", "SOIGNEUR", "DPS"],
  CHASSEUR: ["DPS"],
  VOLEUR: ["DPS"],
  PRETRE: ["SOIGNEUR", "DPS"],
  CHAMAN: ["TANK", "SOIGNEUR", "DPS"], // WoW Forever : le Chaman peut tanker
  MAGE: ["DPS"],
  DEMONISTE: ["DPS"],
  DRUIDE: ["TANK", "SOIGNEUR", "DPS"],
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

/** Nombre maximum de lignes « besoins précis » dans le formulaire de création. */
export const MAX_EXIGENCES = 10;
