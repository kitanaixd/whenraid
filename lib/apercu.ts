// Aperçu public d'un raid : ce qu'on montre aux visiteurs non connectés et dans les
// liens partagés (carte Discord, image). Aucun nom de joueur, seulement les classes et rôles.
import { cache } from "react";
import type { Region, Role } from "@/generated/prisma/enums";
import { Classe } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import type { Dico, Langue } from "@/lib/i18n";
import { nomEnJeu } from "@/lib/jeu";
import { nomRaid } from "@/lib/raids";

const NOMBRE_DE_CLASSES = Object.keys(Classe).length;
const ORDRE_ROLES: Role[] = ["TANK", "SOIGNEUR", "DPS"];

/** Case de la grille du raid (même forme que GrilleRaid, sans nom). */
export type CaseApercu =
  { type: "membre"; classe: Classe; role: Role } | { type: "besoin"; classe?: Classe; role?: Role } | { type: "libre" };

/** Le raid tel qu'on peut le montrer publiquement, ou null s'il n'existe pas ou n'est pas publié. */
export const apercuRaid = cache(async (id: string) => {
  const annonce = await db.annonce.findUnique({
    where: { id },
    include: {
      createur: { select: { pseudo: true } },
      organisateurPersonnage: { select: { nom: true, nomDeFamille: true, classe: true } },
      composition: true,
      places: {
        include: {
          inscriptions: {
            where: { statut: "CONFIRME" },
            orderBy: { inscritLe: "asc" },
            take: 1,
            select: { role: true, personnage: { select: { classe: true } } },
          },
        },
      },
    },
  });
  if (!annonce || annonce.statut === "BROUILLON") return null;

  // Joueurs : la compo déclarée par le RL, puis le titulaire de chaque place pourvue.
  const membres: { classe: Classe; role: Role }[] = [
    ...annonce.composition.flatMap((c) => Array.from({ length: c.nombre }, () => ({ classe: c.classe, role: c.role }))),
    ...annonce.places.flatMap((p) => {
      const t = p.inscriptions[0];
      return t?.personnage && t.role ? [{ classe: t.personnage.classe, role: t.role }] : [];
    }),
  ];
  const ouvertes = annonce.places.filter((p) => p.statut === "OUVERTE");
  const cases: CaseApercu[] = [
    ...membres.map((m) => ({ type: "membre" as const, ...m })),
    ...ouvertes.map((p): CaseApercu =>
      p.classesAcceptees.length >= NOMBRE_DE_CLASSES && !p.role
        ? { type: "libre" }
        : {
            type: "besoin",
            classe: p.classesAcceptees.length === 1 ? p.classesAcceptees[0] : undefined,
            role: p.role ?? undefined,
          },
    ),
  ];
  // Places ouvertes par rôle demandé (null = n'importe quel rôle).
  const recherche = [...ORDRE_ROLES, null].map((role) => ({
    role,
    nombre: ouvertes.filter((p) => p.role === role).length,
  }));

  return {
    id: annonce.id,
    titre: annonce.titre,
    contenu: annonce.contenu,
    taille: annonce.taille,
    statut: annonce.statut,
    debutUtc: annonce.debutUtc,
    dureeEstimee: annonce.dureeEstimee,
    faction: annonce.faction,
    ruleset: annonce.ruleset,
    region: annonce.region,
    reglesLoot: annonce.reglesLoot,
    organisateur: annonce.organisateurPersonnage
      ? { nom: nomEnJeu(annonce.organisateurPersonnage), classe: annonce.organisateurPersonnage.classe }
      : { nom: annonce.createur.pseudo, classe: null },
    joueurs: Math.min(membres.length, annonce.taille),
    ouvertes: ouvertes.length,
    recherche,
    cases,
  };
});

export type ApercuRaid = NonNullable<Awaited<ReturnType<typeof apercuRaid>>>;

/** Fuseau de référence d'un raid pour les visiteurs dont on ne connaît pas le fuseau. */
export const FUSEAU_REGION: Record<Region, string> = { EU: "Europe/Paris", US: "America/New_York" };

/** « sam. 26 sept. · 21:00 UTC+2 » / « Sat, 26 Sep · 21:00 CEST » (heure du serveur de jeu). */
export function dateApercu(instant: Date, region: Region, langue: Langue) {
  const locale = langue === "fr" ? "fr-FR" : region === "US" ? "en-US" : "en-GB";
  const timeZone = FUSEAU_REGION[region];
  const jour = new Intl.DateTimeFormat(locale, { timeZone, weekday: "short", day: "numeric", month: "short" }).format(
    instant,
  );
  const heure = new Intl.DateTimeFormat(locale, {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(instant);
  return `${jour} · ${heure}`;
}

/** Nom affiché : le titre de la session s'il y en a un, sinon le raid. */
export const titreApercu = (a: ApercuRaid, d: Dico) => a.titre ?? nomRaid(a.contenu, d);

/** « 1 Tank, 3 Healers, 12 open spots » : ce que le raid cherche encore. */
export function rechercheApercu(a: ApercuRaid, d: Dico) {
  return a.recherche
    .filter((r) => r.nombre > 0)
    .map((r) =>
      r.role
        ? `${r.nombre} ${r.nombre > 1 ? d.rolesPluriel[r.role] : d.role[r.role]}`
        : d.raid.besoin.placesLibres(r.nombre),
    )
    .join(", ");
}
