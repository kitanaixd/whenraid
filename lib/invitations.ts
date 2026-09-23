import { db } from "@/lib/db";
import { afficherDate } from "@/lib/dates";
import { envoyerMp } from "@/lib/discord";
import { nomRaid } from "@/lib/raids";

export const URL_SITE = process.env.SITE_URL ?? "https://www.whenraid.com";

/** « Swallow Deesnuts » : le nom complet à utiliser dans un /w en jeu. */
export function nomEnJeu(perso: { nom: string; nomDeFamille: string | null }) {
  return [perso.nom, perso.nomDeFamille].filter(Boolean).join(" ");
}

/** Charge un raid avec tout ce qu'il faut pour écrire les invitations. */
async function chargerRaid(annonceId: string) {
  const annonce = await db.annonce.findUnique({
    where: { id: annonceId },
    include: { organisateurPersonnage: true, createur: true },
  });
  if (!annonce) return null;
  // Raids créés avant l'enregistrement du personnage du RL : on prend son principal.
  const perso =
    annonce.organisateurPersonnage ??
    (await db.personnage.findFirst({
      where: { utilisateurId: annonce.createurId, faction: annonce.faction },
      orderBy: [{ estPrincipal: "desc" }, { nom: "asc" }],
    }));
  return { annonce, perso };
}

type Raid = NonNullable<Awaited<ReturnType<typeof chargerRaid>>>;

function texteInvitation({ annonce, perso }: Raid, fuseau: string) {
  const lignes = [`🎮 **${nomRaid(annonce.contenu)}** commence le ${afficherDate(annonce.debutUtc, fuseau)} !`];
  if (annonce.vocal === "DISCORD" && annonce.vocalDiscordLien) {
    lignes.push(`Vocal Discord : ${annonce.vocalDiscordLien}`);
  } else if (annonce.vocal === "TEAMSPEAK" && annonce.vocalTsAdresse) {
    lignes.push(
      `Vocal TeamSpeak : ${annonce.vocalTsAdresse}` +
        (annonce.vocalTsMotDePasse ? ` — mot de passe : ${annonce.vocalTsMotDePasse}` : ""),
    );
  }
  if (perso) {
    lignes.push(`Ton RL : **${nomEnJeu(perso)}**. Pour recevoir ton invitation, copie-colle en jeu :`);
    lignes.push("```\n/w " + nomEnJeu(perso) + " inv\n```");
  }
  lignes.push(`${URL_SITE}/annonces/${annonce.id}`);
  return lignes.join("\n");
}

/** Envoie l'invitation (vocal + /w) à un joueur confirmé. */
export async function envoyerInvitation(inscriptionId: string) {
  const inscription = await db.inscription.findUnique({
    where: { id: inscriptionId },
    include: { utilisateur: true, place: true },
  });
  if (!inscription || inscription.statut !== "CONFIRME") return;
  const raid = await chargerRaid(inscription.place.annonceId);
  if (!raid) return;
  await envoyerMp(inscription.utilisateur.discordId, texteInvitation(raid, inscription.utilisateur.fuseauHoraire));
}

/** Envoie l'invitation à tous les joueurs confirmés du raid. Renvoie le nombre de destinataires. */
export async function envoyerInvitations(annonceId: string) {
  const confirmes = await db.inscription.findMany({
    where: { statut: "CONFIRME", place: { annonceId } },
    select: { id: true },
  });
  // Un par un : on reste loin des limites de débit de Discord.
  for (const c of confirmes) await envoyerInvitation(c.id);
  return confirmes.length;
}

/** Rappel au RL, 15 minutes avant le raid, avec le lien vers la page du raid. */
export async function envoyerRappelRl(annonceId: string) {
  const raid = await chargerRaid(annonceId);
  if (!raid) return;
  const { annonce } = raid;
  const confirmes = await db.inscription.count({ where: { statut: "CONFIRME", place: { annonceId } } });
  await envoyerMp(
    annonce.createur.discordId,
    `⏰ Ton raid **${nomRaid(annonce.contenu)}** commence le ${afficherDate(annonce.debutUtc, annonce.createur.fuseauHoraire)}.\n` +
      `${confirmes} joueur${confirmes > 1 ? "s" : ""} confirmé${confirmes > 1 ? "s" : ""}. ` +
      `Envoie-leur les invitations (vocal et /w) ici :\n${URL_SITE}/annonces/${annonce.id}`,
  );
}

/** Fin du raid : on demande au RL de valider les présences (MP + notification sur le site). */
export async function envoyerRappelFin(annonceId: string) {
  const raid = await chargerRaid(annonceId);
  if (!raid) return;
  const { annonce } = raid;
  await db.notification.create({
    data: { utilisateurId: annonce.createurId, type: "VALIDER_PRESENCES", annonceId: annonce.id },
  });
  await envoyerMp(
    annonce.createur.discordId,
    `✅ Ton raid **${nomRaid(annonce.contenu)}** est terminé !\n` +
      `Valide les présences (et qui s'est distingué) ici :\n${URL_SITE}/annonces/${annonce.id}#presences`,
  );
}
