import { db } from "@/lib/db";
import { creneau } from "@/lib/jeu";

// Règle 3 : rien n'est stocké, tout est recalculé à partir des faits
// (raids, dates d'annulation, participations) à chaque affichage.

/** Une annulation à moins de 2 heures du début compte comme « dernière minute ». */
export const DERNIERE_MINUTE_MS = 2 * 3600_000;

/** Le raid commence-t-il dans moins de 2 h (dernière minute) ? */
export const commenceBientot = (debutUtc: Date) => debutUtc.getTime() - Date.now() < DERNIERE_MINUTE_MS;

/** Face RL : raids tenus, annulations de dernière minute et joueurs retirés à moins de 2 h. */
export async function statsRl(utilisateurId: string) {
  const [raids, retraits] = await Promise.all([
    db.annonce.findMany({
      where: { createurId: utilisateurId, statut: { not: "BROUILLON" } },
      select: { statut: true, debutUtc: true, dureeEstimee: true, annuleeLe: true },
    }),
    db.inscription.findMany({
      where: { retireParRlLe: { not: null }, place: { annonce: { createurId: utilisateurId } } },
      select: { retireParRlLe: true, place: { select: { annonce: { select: { debutUtc: true } } } } },
    }),
  ]);
  const maintenant = Date.now();
  const organises = raids.filter((r) => r.statut !== "ANNULEE" && creneau(r).fin <= maintenant).length;
  const annulesDerniereMinute = raids.filter(
    (r) => r.statut === "ANNULEE" && r.annuleeLe && r.debutUtc.getTime() - r.annuleeLe.getTime() < DERNIERE_MINUTE_MS,
  ).length;
  const retiresTard = retraits.filter(
    (r) => r.place.annonce.debutUtc.getTime() - r.retireParRlLe!.getTime() < DERNIERE_MINUTE_MS,
  ).length;
  return { organises, annulesDerniereMinute, retiresTard };
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

/**
 * Raids passés (déjà commencés) d'un joueur, du plus récent au plus ancien : ceux qu'il
 * a organisés et ceux où il a joué (d'après la feuille de présence validée par le RL).
 */
export async function historiqueRaids(utilisateurId: string, limite = 30) {
  const maintenant = new Date();
  const champsRaid = { id: true, contenu: true, titre: true, debutUtc: true } as const;
  const [organises, joues] = await Promise.all([
    db.annonce.findMany({
      where: { createurId: utilisateurId, statut: { not: "BROUILLON" }, debutUtc: { lt: maintenant } },
      orderBy: { debutUtc: "desc" },
      take: limite,
      select: {
        ...champsRaid,
        statut: true,
        _count: { select: { participations: { where: { resultat: { in: ["PRESENT", "PARTI_EN_COURS"] } } } } },
      },
    }),
    db.participation.findMany({
      where: { utilisateurId, annonce: { debutUtc: { lt: maintenant } } },
      orderBy: { annonce: { debutUtc: "desc" } },
      take: limite,
      select: {
        id: true,
        resultat: true,
        distinction: true,
        personnage: { select: { nom: true, nomDeFamille: true, classe: true } },
        annonce: { select: champsRaid },
      },
    }),
  ]);
  return [
    ...organises.map((a) => ({
      type: "organise" as const,
      cle: `o-${a.id}`,
      annonce: a,
      annule: a.statut === "ANNULEE",
      joueurs: a._count.participations,
    })),
    ...joues.map((p) => ({ type: "joue" as const, cle: `j-${p.id}`, ...p })),
  ]
    .sort((a, b) => b.annonce.debutUtc.getTime() - a.annonce.debutUtc.getTime())
    .slice(0, limite);
}
