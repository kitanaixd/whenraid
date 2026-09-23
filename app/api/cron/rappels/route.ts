import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { envoyerRappelRl } from "@/lib/invitations";

// Appelée toutes les 5 minutes par cron-job.org. Envoie au RL un MP de rappel
// pour chaque raid qui commence dans les 15 prochaines minutes.
const AVANCE_MINUTES = 15;

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
  return Response.json({ rappels: envoyes });
}
