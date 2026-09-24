// Groupes d'amis (« Mes groupes ») : jusqu'à 5 joueurs qui candidatent ensemble, tout ou rien.
import { randomBytes } from "node:crypto";
import type { Role } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { ErreurFormulaire } from "@/lib/formulaire";
import { rolePossible } from "@/lib/jeu";

export const MAX_MEMBRES = 5;

/** Code du lien d'invitation : 12 caractères impossibles à deviner. */
export const nouveauCode = () => randomBytes(9).toString("base64url");

/** Les rôles qu'un personnage peut vraiment tenir (jouables et possibles pour sa classe). */
export function rolesDuPerso(perso: { classe: Parameters<typeof rolePossible>[0]; rolesJouables: Role[] }) {
  return perso.rolesJouables.filter((r) => rolePossible(perso.classe, r));
}

/** Lit le personnage (du joueur, non supprimé) et les rôles qu'il jouera dans le groupe. */
export async function lireMembre(form: FormData, utilisateurId: string) {
  const personnage = await db.personnage.findFirst({
    where: { id: String(form.get("personnageId") ?? ""), utilisateurId, supprimeLe: null },
  });
  if (!personnage) throw new ErreurFormulaire((d) => d.erreur.choisisPerso);
  const coches = new Set(form.getAll("roles").map(String));
  const roles = rolesDuPerso(personnage).filter((r) => coches.has(r));
  if (roles.length === 0) throw new ErreurFormulaire((d) => d.erreur.unRole);
  return { personnageId: personnage.id, roles };
}

const includeMembres = {
  membres: {
    orderBy: { rejointLe: "asc" },
    include: {
      personnage: true,
      utilisateur: { select: { id: true, pseudo: true, avatarUrl: true } },
    },
  },
} as const;

/** Les groupes dont le joueur fait partie, avec leurs membres. */
export function mesGroupes(utilisateurId: string) {
  return db.escouade.findMany({
    where: { membres: { some: { utilisateurId } } },
    orderBy: { creeLe: "asc" },
    include: includeMembres,
  });
}

/** Un groupe, seulement si le joueur en fait partie. */
export function monGroupe(escouadeId: string, utilisateurId: string) {
  return db.escouade.findFirst({
    where: { id: escouadeId, membres: { some: { utilisateurId } } },
    include: { ...includeMembres, chef: { select: { pseudo: true } } },
  });
}

export type GroupeAvecMembres = NonNullable<Awaited<ReturnType<typeof monGroupe>>>;

/** Tous les personnages du groupe peuvent-ils faire le même raid (faction, ruleset, région) ? */
export function groupeHomogene(membres: { personnage: { faction: string; ruleset: string; region: string } }[]) {
  const [premier] = membres;
  return membres.every(
    (m) =>
      m.personnage.faction === premier.personnage.faction &&
      m.personnage.ruleset === premier.personnage.ruleset &&
      m.personnage.region === premier.personnage.region,
  );
}
