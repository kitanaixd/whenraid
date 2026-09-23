import type { Classe, Faction, Region, Role, Ruleset } from "@/generated/prisma/enums";
import { rolePossible } from "@/lib/jeu";

type Perso = {
  classe: Classe;
  rolesJouables: Role[];
  faction: Faction;
  ruleset: Ruleset;
  region: Region;
  niveau: number;
};
type PlacePourEligibilite = { classesAcceptees: Classe[]; role: Role | null };
type AnnoncePourEligibilite = { faction: Faction; ruleset: Ruleset; region: Region; niveauMin: number | null };

/** Les rôles que ce personnage peut tenir sur cette place (vide = non éligible). */
export function rolesPourPlace(perso: Perso, place: PlacePourEligibilite, annonce: AnnoncePourEligibilite): Role[] {
  const compatible =
    perso.faction === annonce.faction &&
    perso.ruleset === annonce.ruleset &&
    perso.region === annonce.region &&
    perso.niveau >= (annonce.niveauMin ?? 1) &&
    place.classesAcceptees.includes(perso.classe);
  if (!compatible) return [];
  return perso.rolesJouables.filter(
    (r) => rolePossible(perso.classe, r) && (place.role === null || place.role === r),
  );
}

type PlaceAvecStatut = PlacePourEligibilite & { id: string; statut: "OUVERTE" | "POURVUE" | "ANNULEE" };

/**
 * Une place pour ce personnage et ce rôle : d'abord une place ouverte, sinon une
 * place pourvue (liste d'attente). `preferee` est choisie en priorité si elle convient.
 */
export function placePour<P extends PlaceAvecStatut>(
  places: P[],
  perso: Perso,
  role: Role,
  annonce: AnnoncePourEligibilite,
  preferee?: string,
): { place: P; ouverte: boolean } | null {
  const compatibles = places.filter((p) => p.statut !== "ANNULEE" && rolesPourPlace(perso, p, annonce).includes(role));
  const ouvertes = compatibles.filter((p) => p.statut === "OUVERTE");
  const ouverte = ouvertes.find((p) => p.id === preferee) ?? ouvertes[0];
  if (ouverte) return { place: ouverte, ouverte: true };
  const pourvue = compatibles.find((p) => p.id === preferee) ?? compatibles[0];
  return pourvue ? { place: pourvue, ouverte: false } : null;
}

/** Les rôles avec lesquels ce personnage peut candidater sur au moins une place du raid. */
export function rolesPourRaid(perso: Perso, places: PlaceAvecStatut[], annonce: AnnoncePourEligibilite): Role[] {
  const roles = new Set<Role>();
  for (const p of places) if (p.statut !== "ANNULEE") for (const r of rolesPourPlace(perso, p, annonce)) roles.add(r);
  return (["TANK", "SOIGNEUR", "DPS"] as Role[]).filter((r) => roles.has(r));
}
