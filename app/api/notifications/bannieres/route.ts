import { db } from "@/lib/db";
import { utilisateurConnecte } from "@/lib/session";
import { texteNotification } from "@/lib/notifications";

/**
 * Notifications non lues à afficher en bannière : « tu es convié » et « nouvelle
 * candidature sur ton raid ». Interrogée régulièrement par la page (onglet visible).
 */
export async function GET() {
  const utilisateur = await utilisateurConnecte();
  if (!utilisateur) return Response.json([], { status: 401 });

  const notifications = await db.notification.findMany({
    where: {
      utilisateurId: utilisateur.id,
      lue: false,
      type: { in: ["CANDIDATURE_ACCEPTEE", "NOUVELLE_CANDIDATURE"] },
      // Seulement les récentes : pas de pluie de bannières pour de vieilles notifications.
      creeLe: { gt: new Date(Date.now() - 24 * 3600_000) },
    },
    orderBy: { creeLe: "desc" },
    take: 5,
    include: { annonce: { select: { id: true, contenu: true, debutUtc: true } } },
  });

  return Response.json(
    notifications.map((n) => ({
      id: n.id,
      type: n.type,
      // Le symbole de tête (✔…) est déjà dans la bannière.
      texte: texteNotification(n.type, n.annonce, utilisateur.fuseauHoraire).replace(/^[^\p{L}]+/u, ""),
      // Ouvrir la bannière marque la notification comme lue.
      lien: `/notifications/${n.id}`,
    })),
  );
}
