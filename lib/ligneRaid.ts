import type { Prisma } from "@/generated/prisma/client";
import type { Classe, Role } from "@/generated/prisma/enums";
import { compoActuelle, compoParRole, estEnAttente, STATUTS_ACTIFS } from "@/lib/annonces";

const NOMBRE_DE_CLASSES = 9;

/** Ce qu'il faut charger d'un raid pour l'afficher en ligne (liste, « Tes raids »). */
export const includeLigneRaid = {
  createur: { select: { pseudo: true } },
  composition: true,
  places: {
    select: {
      id: true,
      statut: true,
      role: true,
      classesAcceptees: true,
      inscriptions: {
        where: { statut: { in: [...STATUTS_ACTIFS] } },
        orderBy: { inscritLe: "asc" },
        select: { statut: true, role: true, escouadeId: true, personnage: { select: { classe: true } } },
      },
    },
  },
} satisfies Prisma.AnnonceInclude;

export type AnnonceLigne = Prisma.AnnonceGetPayload<{ include: typeof includeLigneRaid }>;

/** Compo actuelle, places ouvertes, classes recherchées et candidatures en attente d'un raid. */
export function resumeLigneRaid(a: AnnonceLigne) {
  const ouvertes = a.places.filter((p) => p.statut === "OUVERTE");
  // Par place, le premier confirmé est titulaire (les suivants sont des remplaçants).
  const titulaires = a.places.flatMap((p) => {
    const t = p.inscriptions.find((i) => i.statut === "CONFIRME");
    return t?.role && t.personnage ? [{ classe: t.personnage.classe, role: t.role }] : [];
  });
  const compo = compoActuelle(a.composition, titulaires);
  // Tant qu'une place est ouverte à tous (toute classe, tout rôle), on n'affiche que « Toutes classes » ;
  // les classes et rôles précis n'apparaissent que lorsqu'il ne reste plus qu'eux à pourvoir.
  const toutesClasses = (p: { classesAcceptees: Classe[] }) => p.classesAcceptees.length >= NOMBRE_DE_CLASSES;
  const placeLibre = ouvertes.some((p) => toutesClasses(p) && !p.role);
  const classesRecherchees = placeLibre
    ? []
    : ([...new Set(ouvertes.filter((p) => !toutesClasses(p)).flatMap((p) => p.classesAcceptees))] as Classe[]);
  const rolesRecherches = placeLibre
    ? []
    : ([...new Set(ouvertes.filter((p) => toutesClasses(p) && p.role).map((p) => p.role!))] as Role[]);
  return {
    ouvertes: ouvertes.length,
    total: compo.total,
    lignes: compo.lignes,
    roles: compoParRole(compo.lignes),
    classesRecherchees,
    rolesRecherches,
    placeLibre,
    enAttente: a.places.reduce((n, p) => n + p.inscriptions.filter((i) => estEnAttente(i.statut)).length, 0),
  };
}
