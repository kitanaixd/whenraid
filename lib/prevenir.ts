import { after } from "next/server";
import type { TypeNotification } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { envoyerMp } from "@/lib/discord";
import { dico } from "@/lib/i18n";
import { envoyerInvitation } from "@/lib/invitations";
import { carteNotification } from "@/lib/carteDiscord";

/** Envoie en MP Discord, après la réponse, la même information que la notification du site (dans la langue du joueur). */
export function prevenirEnMp(inscriptionId: string, type: TypeNotification) {
  after(async () => {
    const i = await db.inscription.findUnique({
      where: { id: inscriptionId },
      include: { utilisateur: true, personnage: true, place: { include: { annonce: true } } },
    });
    if (!i) return;
    const { annonce } = i.place;
    const d = dico(i.utilisateur.langueSite);
    await envoyerMp(i.utilisateur.discordId, carteNotification(type, annonce, d, i.personnage, i.role));
    // Accepté après l'envoi des invitations (ex. remplaçant) : il reçoit la sienne tout de suite.
    if (type === "CANDIDATURE_ACCEPTEE" && annonce.invitationsEnvoyeesLe) await envoyerInvitation(i.id);
  });
}
