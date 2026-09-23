import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { envoyerRappelFin, envoyerRappelRl } from "@/lib/invitations";
import { creneau } from "@/lib/jeu";

// Appelée toutes les 5 minutes par cron-job.org. Envoie au RL :
// - un MP de rappel pour chaque raid qui commence dans les 15 prochaines minutes ;
// - un MP pour valider les présences de chaque raid terminé ;
// - la clôture automatique des raids terminés depuis 24 h sans validation.
const AVANCE_MINUTES = 15;
const DELAI_VALIDATION_MS = 24 * 3600_000;

/**
 * 24 h après la fin sans validation du RL : les confirmés sans présence enregistrée
 * sont comptés présents (source VALIDATION_AUTOMATIQUE) et le raid est clôturé.
 * Les absences et départs signalés par le RL pendant le raid sont conservés.
 */
async function cloturerAutomatiquement(annonceId: string) {
  return db.$transaction(async (tx) => {
    // On « réserve » la clôture : un seul appel du cron peut la faire.
    const reserve = await tx.annonce.updateMany({
      where: { id: annonceId, presencesValideesLe: null, statut: { in: ["PUBLIEE", "COMPLETE"] } },
      data: { presencesValideesLe: new Date(), statut: "CLOTUREE" },
    });
    if (reserve.count === 0) return false;
    const confirmes = await tx.inscription.findMany({
      where: { statut: "CONFIRME", personnageId: { not: null }, place: { annonceId } },
      select: { personnageId: true, utilisateurId: true },
    });
    await tx.participation.createMany({
      data: confirmes.map((c) => ({
        annonceId,
        personnageId: c.personnageId!,
        utilisateurId: c.utilisateurId,
        resultat: "PRESENT" as const,
        source: "VALIDATION_AUTOMATIQUE" as const,
      })),
      skipDuplicates: true,
    });
    return true;
  });
}

function autorise(request: Request) {
  const secret = process.env.CRON_SECRET;
  const recu = request.headers.get("authorization") ?? "";
  if (!secret) return false;
  const attendu = Buffer.from(`Bearer ${secret}`);
  const donne = Buffer.from(recu);
  return donne.length === attendu.length && timingSafeEqual(donne, attendu);
}

export async function GET(request: Request) {
  if (!autorise(request)) return new Response("Non autorisé", { status: 401 });

  const maintenant = new Date();
  const limite = new Date(maintenant.getTime() + AVANCE_MINUTES * 60_000);
  const raids = await db.annonce.findMany({
    where: {
      statut: { in: ["PUBLIEE", "COMPLETE"] },
      rappelRlEnvoyeLe: null,
      debutUtc: { gt: maintenant, lte: limite },
    },
    select: { id: true },
  });

  let envoyes = 0;
  for (const { id } of raids) {
    // On « réserve » le rappel avant d'envoyer : deux appels simultanés
    // ne peuvent pas envoyer deux fois le même rappel.
    const reserve = await db.annonce.updateMany({
      where: { id, rappelRlEnvoyeLe: null },
      data: { rappelRlEnvoyeLe: maintenant },
    });
    if (reserve.count === 1) {
      await envoyerRappelRl(id);
      envoyes++;
    }
  }

  // Raids terminés (fin prévue dépassée), présences pas encore validées.
  const enCours = await db.annonce.findMany({
    where: {
      statut: { in: ["PUBLIEE", "COMPLETE"] },
      rappelFinEnvoyeLe: null,
      presencesValideesLe: null,
      debutUtc: { lte: maintenant, gt: new Date(maintenant.getTime() - 7 * 24 * 3600_000) },
    },
    select: { id: true, debutUtc: true, dureeEstimee: true },
  });
  let fins = 0;
  for (const raid of enCours.filter((r) => creneau(r).fin <= maintenant.getTime())) {
    const reserve = await db.annonce.updateMany({
      where: { id: raid.id, rappelFinEnvoyeLe: null },
      data: { rappelFinEnvoyeLe: maintenant },
    });
    if (reserve.count === 1) {
      await envoyerRappelFin(raid.id);
      fins++;
    }
  }
  // Raids terminés depuis plus de 24 h et jamais validés : clôture automatique.
  const aCloturer = (
    await db.annonce.findMany({
      where: { statut: { in: ["PUBLIEE", "COMPLETE"] }, presencesValideesLe: null, debutUtc: { lte: maintenant } },
      select: { id: true, debutUtc: true, dureeEstimee: true },
    })
  ).filter((r) => creneau(r).fin + DELAI_VALIDATION_MS <= maintenant.getTime());
  let clotures = 0;
  for (const raid of aCloturer) {
    if (await cloturerAutomatiquement(raid.id)) clotures++;
  }

  return Response.json({ rappels: envoyes, fins, clotures });
}
