import { db } from "@/lib/db";
import { creneau } from "@/lib/jeu";

// Règle 3 : rien n'est stocké, tout est recalculé à partir des faits
// (raids, dates d'annulation, participations) à chaque affichage.

/** Une annulation à moins de 2 heures du début compte comme « dernière minute ». */
export const DERNIERE_MINUTE_MS = 2 * 3600_000;

/** Face RL : raids tenus et annulations de dernière minute. */
export async function statsRl(utilisateurId: string) {
  const raids = await db.annonce.findMany({
    where: { createurId: utilisateurId, statut: { not: "BROUILLON" } },
    select: { statut: true, debutUtc: true, dureeEstimee: true, annuleeLe: true },
  });
  const maintenant = Date.now();
  const organises = raids.filter((r) => r.statut !== "ANNULEE" && creneau(r).fin <= maintenant).length;
  const annulesDerniereMinute = raids.filter(
    (r) => r.statut === "ANNULEE" && r.annuleeLe && r.debutUtc.getTime() - r.annuleeLe.getTime() < DERNIERE_MINUTE_MS,
  ).length;
  return { organises, annulesDerniereMinute };
}

/** Face Mercenaire : présences, absences, départs en cours et distinctions constatés par les RL. */
export async function statsMercenaire(utilisateurId: string) {
  const participations = await db.participation.groupBy({
    by: ["resultat"],
    where: { utilisateurId },
    _count: true,
  });
  const nombre = (resultat: string) => participations.find((p) => p.resultat === resultat)?._count ?? 0;
  const distinctions = await db.participation.count({ where: { utilisateurId, distinction: true } });
  return {
    participes: nombre("PRESENT") + nombre("PARTI_EN_COURS"),
    absences: nombre("ABSENT"),
    partisEnCours: nombre("PARTI_EN_COURS"),
    distinctions,
  };
}
