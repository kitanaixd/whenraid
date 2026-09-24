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
  return perso.rolesJouables.filter((r) => rolePossible(perso.classe, r) && (place.role === null || place.role === r));
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

/**
 * La meilleure place parmi plusieurs rôles proposés : une place ouverte pour le
 * premier rôle qui en a une, sinon une place pourvue (liste d'attente).
 */
export function placePourRoles<P extends PlaceAvecStatut>(
  places: P[],
  perso: Perso,
  roles: Role[],
  annonce: AnnoncePourEligibilite,
  preferee?: string,
): { place: P; ouverte: boolean; role: Role } | null {
  let repli: { place: P; ouverte: boolean; role: Role } | null = null;
  for (const role of roles) {
    const choix = placePour(places, perso, role, annonce, preferee);
    if (choix?.ouverte) return { ...choix, role };
    if (choix && !repli) repli = { ...choix, role };
  }
  return repli;
}

/** Les rôles proposés par une candidature (les anciennes n'en portaient qu'un). */
export function rolesProposes(i: { rolesProposes: Role[]; role: Role | null }): Role[] {
  return i.rolesProposes.length > 0 ? i.rolesProposes : i.role ? [i.role] : [];
}

/**
 * Place chaque membre d'un groupe sur une place distincte, avec l'un de ses rôles
 * (tout ou rien) : renvoie l'affectation, ou null s'il n'y en a aucune. Seules les places
 * `statuts` comptent (par défaut les places ouvertes). La place `preferee` de chacun est essayée d'abord.
 */
export function affecterGroupe<P extends PlaceAvecStatut>(
  places: P[],
  membres: { perso: Perso; roles: Role[]; preferee?: string }[],
  annonce: AnnoncePourEligibilite,
  statuts: PlaceAvecStatut["statut"][] = ["OUVERTE"],
): { place: P; role: Role }[] | null {
  const utilisables = places.filter((p) => statuts.includes(p.statut));
  // Pour chaque membre, ses options (place, rôle), sa place préférée en tête.
  const options = membres.map((m) =>
    utilisables
      .flatMap((p) =>
        rolesPourPlace(m.perso, p, annonce)
          .filter((r) => m.roles.includes(r))
          .map((role) => ({ place: p, role })),
      )
      .sort((a, b) => Number(b.place.id === m.preferee) - Number(a.place.id === m.preferee)),
  );
  const prises = new Set<string>();
  const resultat: { place: P; role: Role }[] = [];
  // Recherche en profondeur : au plus 5 membres, donc rapide.
  const placer = (n: number): boolean => {
    if (n === membres.length) return true;
    for (const o of options[n]) {
      if (prises.has(o.place.id)) continue;
      prises.add(o.place.id);
      resultat[n] = o;
      if (placer(n + 1)) return true;
      prises.delete(o.place.id);
    }
    return false;
  };
  return placer(0) ? resultat : null;
}
