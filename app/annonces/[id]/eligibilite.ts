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
