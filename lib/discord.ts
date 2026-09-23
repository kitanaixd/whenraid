// Appels à l'API Discord avec le bot WhenRaid. Ces fonctions ne lèvent jamais
// d'erreur : un MP ou un ajout au serveur raté ne doit pas bloquer le site
// (la notification sur le site existe toujours).

const API = "https://discord.com/api/v10";

async function appel(chemin: string, init: RequestInit) {
  const jeton = process.env.DISCORD_BOT_TOKEN;
  if (!jeton) return null;
  try {
    const reponse = await fetch(`${API}${chemin}`, {
      ...init,
      headers: { Authorization: `Bot ${jeton}`, "Content-Type": "application/json", ...init.headers },
      signal: AbortSignal.timeout(5000),
    });
    if (!reponse.ok) {
      console.warn(`[discord] ${init.method} ${chemin} → ${reponse.status}`);
      return null;
    }
    return reponse.status === 204 ? {} : await reponse.json();
  } catch (e) {
    console.warn(`[discord] ${init.method} ${chemin} → ${(e as Error).message}`);
    return null;
  }
}

/**
 * Ajoute le joueur au serveur WhenRaid grâce au jeton d'accès reçu à la connexion
 * (permission « guilds.join »). Sans effet s'il en est déjà membre.
 */
export async function ajouterAuServeur(discordId: string, jetonAcces: string) {
  const serveur = process.env.DISCORD_GUILD_ID;
  if (!serveur) return;
  await appel(`/guilds/${serveur}/members/${discordId}`, {
    method: "PUT",
    body: JSON.stringify({ access_token: jetonAcces }),
  });
}

/** Envoie un message privé. Échoue silencieusement si le joueur bloque les MP. */
export async function envoyerMp(discordId: string, contenu: string) {
  const canal = await appel("/users/@me/channels", {
    method: "POST",
    body: JSON.stringify({ recipient_id: discordId }),
  });
  if (!canal?.id) return;
  await appel(`/channels/${canal.id}/messages`, {
    method: "POST",
    body: JSON.stringify({ content: contenu.slice(0, 2000), allowed_mentions: { parse: [] } }),
  });
}
