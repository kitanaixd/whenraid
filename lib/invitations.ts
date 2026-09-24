import { db } from "@/lib/db";
import { afficherDate } from "@/lib/dates";
import { envoyerMp } from "@/lib/discord";
import { nomRaid } from "@/lib/raids";
import { dico, type Dico } from "@/lib/i18n";

export const URL_SITE = process.env.SITE_URL ?? "https://www.whenraid.com";

import { nomEnJeu } from "@/lib/jeu";

export { nomEnJeu };

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
      where: { utilisateurId: annonce.createurId, faction: annonce.faction, supprimeLe: null },
      orderBy: [{ estPrincipal: "desc" }, { nom: "asc" }],
    }));
  return { annonce, perso };
}

type Raid = NonNullable<Awaited<ReturnType<typeof chargerRaid>>>;

/** Texte de l'invitation, dans la langue (d) et le fuseau du joueur qui la reçoit. */
function texteInvitation({ annonce, perso }: Raid, fuseau: string, d: Dico) {
  const t = d.discord.invitation;
  const lignes = [t.commence(nomRaid(annonce.contenu, d), afficherDate(annonce.debutUtc, fuseau, d))];
  if (annonce.vocal === "DISCORD" && annonce.vocalDiscordLien) {
    lignes.push(t.vocalDiscord(annonce.vocalDiscordLien));
  } else if (annonce.vocal === "TEAMSPEAK" && annonce.vocalTsAdresse) {
    lignes.push(t.vocalTs(annonce.vocalTsAdresse, annonce.vocalTsMotDePasse));
  }
  if (perso) {
    lignes.push(t.tonRl(nomEnJeu(perso)));
    lignes.push("```\n/w " + nomEnJeu(perso) + " inv\n```");
  }
  lignes.push(`${URL_SITE}/annonces/${annonce.id}`);
  return lignes.join("\n");
}

/**
 * Envoie l'invitation (vocal + /w) à un joueur confirmé, une seule fois : l'envoi est
 * « réservé » avant de partir, et libéré si le MP échoue (le joueur pourra la recevoir plus tard).
 */
export async function envoyerInvitation(inscriptionId: string) {
  const reservee = await db.inscription.updateMany({
    where: { id: inscriptionId, statut: "CONFIRME", invitationEnvoyeeLe: null },
    data: { invitationEnvoyeeLe: new Date() },
  });
  if (reservee.count === 0) return; // déjà invité, ou plus confirmé
  const inscription = await db.inscription.findUnique({
    where: { id: inscriptionId },
    include: { utilisateur: true, place: true },
  });
  if (!inscription) return;
  const raid = await chargerRaid(inscription.place.annonceId);
  const { utilisateur } = inscription;
  const envoye =
    raid !== null &&
    (await envoyerMp(
      utilisateur.discordId,
      texteInvitation(raid, utilisateur.fuseauHoraire, dico(utilisateur.langueSite)),
    ));
  if (!envoye) await db.inscription.update({ where: { id: inscriptionId }, data: { invitationEnvoyeeLe: null } });
}

/** Envoie l'invitation aux joueurs confirmés qui ne l'ont pas encore reçue. Renvoie leur nombre. */
export async function envoyerInvitations(annonceId: string) {
  const confirmes = await db.inscription.findMany({
    where: { statut: "CONFIRME", invitationEnvoyeeLe: null, place: { annonceId } },
    select: { id: true },
  });
  // Un par un : on reste loin des limites de débit de Discord.
  for (const c of confirmes) await envoyerInvitation(c.id);
  return confirmes.length;
}

/** Rappel au RL, 15 minutes avant le raid, avec le lien vers la page du raid (dans sa langue). */
export async function envoyerRappelRl(annonceId: string) {
  const raid = await chargerRaid(annonceId);
  if (!raid) return;
  const { annonce } = raid;
  const d = dico(annonce.createur.langueSite);
  const confirmes = await db.inscription.count({ where: { statut: "CONFIRME", place: { annonceId } } });
  await envoyerMp(
    annonce.createur.discordId,
    d.discord.rappelRl(
      nomRaid(annonce.contenu, d),
      afficherDate(annonce.debutUtc, annonce.createur.fuseauHoraire, d),
      confirmes,
      `${URL_SITE}/annonces/${annonce.id}`,
    ),
  );
}

/** Fin du raid : on demande au RL de valider les présences (MP dans sa langue + notification sur le site). */
export async function envoyerRappelFin(annonceId: string) {
  const raid = await chargerRaid(annonceId);
  if (!raid) return;
  const { annonce } = raid;
  const d = dico(annonce.createur.langueSite);
  await db.notification.create({
    data: { utilisateurId: annonce.createurId, type: "VALIDER_PRESENCES", annonceId: annonce.id },
  });
  await envoyerMp(
    annonce.createur.discordId,
    d.discord.rappelFin(nomRaid(annonce.contenu, d), `${URL_SITE}/annonces/${annonce.id}#presences`),
  );
}
