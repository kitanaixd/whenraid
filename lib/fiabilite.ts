import { db } from "@/lib/db";
import { creneau } from "@/lib/jeu";
import { DERNIERE_MINUTE_MS } from "@/lib/profil";

// Score de fiabilité, recalculé à chaque lecture à partir des faits (règle 3).
// Il mesure « vient-il quand il s'engage », pas le niveau de jeu : les
// distinctions restent affichées à part.

/** Lissage : on part comme si le joueur avait déjà 3 raids à 80 %. */
const RAIDS_VIRTUELS = 3;
const SCORE_DE_DEPART = 0.8;
/** Un raid perd la moitié de son poids tous les 6 mois. */
const DEMI_VIE_MS = 182 * 24 * 3600_000;
/** En dessous, on affiche « Nouveau » plutôt qu'un score. */
const RAIDS_MINIMUM = 3;

type Evenement = { points: number; date: Date };

export function calculer(evenements: Evenement[], maintenant: number) {
  let points = 0;
  let poids = 0;
  for (const e of evenements) {
    const w = Math.pow(0.5, Math.max(0, maintenant - e.date.getTime()) / DEMI_VIE_MS);
    points += w * e.points;
    poids += w;
  }
  const score = (points + RAIDS_VIRTUELS * SCORE_DE_DEPART) / (poids + RAIDS_VIRTUELS);
  return { score, nombre: evenements.length };
}

export type Fiabilite = ReturnType<typeof calculer>;

export function badge({ score, nombre }: Fiabilite) {
  if (nombre < RAIDS_MINIMUM) return { icone: "🆕", niveau: "nouveau", libelle: "Nouveau", pourcent: null };
  const pourcent = Math.round(score * 100);
  if (pourcent >= 90) return { icone: "🟢", niveau: "tres-fiable", libelle: "Très fiable", pourcent };
  if (pourcent >= 75) return { icone: "🔵", niveau: "fiable", libelle: "Fiable", pourcent };
  if (pourcent >= 60) return { icone: "🟠", niveau: "irregulier", libelle: "Irrégulier", pourcent };
  return { icone: "🔴", niveau: "peu-fiable", libelle: "Peu fiable", pourcent };
}

/** « 🟢 Très fiable 92 % » ou « 🆕 Nouveau ». */
export function texteBadge(f: Fiabilite) {
  const b = badge(f);
  return `${b.icone} ${b.libelle}${b.pourcent === null ? "" : ` ${b.pourcent} %`}`;
}

/**
 * Mercenaire : présent = 1, parti en cours = 0,5, absent = 0, par raid.
 * Présences constatées ou déduites automatiquement comptent de la même façon.
 */
export async function fiabiliteMercenaires(utilisateurIds: string[]) {
  const maintenant = Date.now();
  const participations = await db.participation.findMany({
    where: { utilisateurId: { in: utilisateurIds }, resultat: { in: ["PRESENT", "PARTI_EN_COURS", "ABSENT"] } },
    select: { utilisateurId: true, resultat: true, annonce: { select: { debutUtc: true } } },
  });
  const points = { PRESENT: 1, PARTI_EN_COURS: 0.5, ABSENT: 0 } as Record<string, number>;
  return new Map(
    utilisateurIds.map((id) => [
      id,
      calculer(
        participations
          .filter((p) => p.utilisateurId === id)
          .map((p) => ({ points: points[p.resultat], date: p.annonce.debutUtc })),
        maintenant,
      ),
    ]),
  );
}

/**
 * Raid Leader : raid tenu = 1 (validé ou clôturé automatiquement), annulé à moins
 * de 2 h du début = 0. Une annulation faite à l'avance ne compte pas.
 */
export async function fiabiliteRls(utilisateurIds: string[]) {
  const maintenant = Date.now();
  const raids = await db.annonce.findMany({
    where: { createurId: { in: utilisateurIds }, statut: { not: "BROUILLON" } },
    select: { createurId: true, statut: true, debutUtc: true, dureeEstimee: true, annuleeLe: true },
  });
  return new Map(
    utilisateurIds.map((id) => [
      id,
      calculer(
        raids
          .filter((r) => r.createurId === id)
          .flatMap((r): Evenement[] => {
            if (r.statut === "ANNULEE") {
              const tardive = r.annuleeLe && r.debutUtc.getTime() - r.annuleeLe.getTime() < DERNIERE_MINUTE_MS;
              return tardive ? [{ points: 0, date: r.debutUtc }] : [];
            }
            return creneau(r).fin <= maintenant ? [{ points: 1, date: r.debutUtc }] : [];
          }),
        maintenant,
      ),
    ]),
  );
}
