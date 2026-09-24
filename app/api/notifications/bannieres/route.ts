import { createHash } from "node:crypto";
import type { TypeNotification } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { utilisateurConnecte } from "@/lib/session";
import { texteNotification } from "@/lib/notifications";
import { STATUTS_ACTIFS } from "@/lib/annonces";
import { dicoCourant } from "@/lib/langue";

/** Types de notification affichés en bannière (les autres restent dans la cloche). */
const EN_BANNIERE: TypeNotification[] = [
  "CANDIDATURE_ACCEPTEE",
  "CANDIDATURE_REFUSEE",
  "NOUVELLE_CANDIDATURE",
  "DESISTEMENT",
  "RAID_ANNULE",
  "RAID_COMPLET",
];

/**
 * Interrogée régulièrement par la page (onglet visible). Renvoie :
 * - les notifications récentes non lues à afficher en bannière ;
 * - une empreinte de tout ce qui concerne l'utilisateur (ses candidatures, celles de
 *   ses raids, ses notifications) : quand elle change, la page se met à jour d'elle-même.
 */
export async function GET() {
  const utilisateur = await utilisateurConnecte();
  if (!utilisateur) return Response.json({ bannieres: [], empreinte: "" }, { status: 401 });

  const d = await dicoCourant();
  const actifs = { statut: { in: ["PUBLIEE" as const, "COMPLETE" as const] } };
  const [notifications, derniere, miennes, surMesRaids, mesRaids] = await Promise.all([
    db.notification.findMany({
      where: {
        utilisateurId: utilisateur.id,
        lue: false,
        type: { in: EN_BANNIERE },
        // Seulement les récentes : pas de pluie de bannières pour de vieilles notifications.
        creeLe: { gt: new Date(Date.now() - 24 * 3600_000) },
      },
      orderBy: { creeLe: "desc" },
      take: 5,
      include: { annonce: { select: { id: true, contenu: true, debutUtc: true } } },
    }),
    db.notification.findFirst({
      where: { utilisateurId: utilisateur.id },
      orderBy: { creeLe: "desc" },
      select: { id: true },
    }),
    db.inscription.findMany({
      where: { utilisateurId: utilisateur.id, statut: { in: [...STATUTS_ACTIFS] }, place: { annonce: actifs } },
      select: { id: true, statut: true, placeId: true, role: true },
      orderBy: { id: "asc" },
    }),
    db.inscription.findMany({
      where: { place: { annonce: { createurId: utilisateur.id, ...actifs } } },
      select: { id: true, statut: true, placeId: true, role: true },
      orderBy: { id: "asc" },
    }),
    db.annonce.findMany({
      where: { createurId: utilisateur.id, ...actifs },
      select: { id: true, statut: true },
      orderBy: { id: "asc" },
    }),
  ]);

  const empreinte = createHash("sha1")
    .update(
      JSON.stringify([
        derniere?.id ?? "",
        miennes.map((i) => `${i.id}:${i.statut}:${i.placeId}:${i.role}`),
        surMesRaids.map((i) => `${i.id}:${i.statut}:${i.placeId}:${i.role}`),
        mesRaids.map((a) => `${a.id}:${a.statut}`),
      ]),
    )
    .digest("hex")
    .slice(0, 16);

  return Response.json({
    empreinte,
    bannieres: notifications.map((n) => ({
      id: n.id,
      type: n.type,
      // Le symbole de tête (✔…) est déjà dans la bannière.
      texte: texteNotification(n.type, n.annonce, utilisateur.fuseauHoraire, d).replace(/^[^\p{L}]+/u, ""),
      // Ouvrir la bannière marque la notification comme lue.
      lien: `/notifications/${n.id}`,
    })),
  });
}
