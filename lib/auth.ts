import NextAuth, { type DefaultSession } from "next-auth";
import Discord from "next-auth/providers/discord";
import { db } from "@/lib/db";
import { ajouterAuServeur } from "@/lib/discord";

declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    utilisateurId?: string;
  }
}

function urlAvatarDiscord(id: string, avatar: string | null) {
  if (avatar) return `https://cdn.discordapp.com/avatars/${id}/${avatar}.png`;
  // Avatar par défaut de Discord pour les comptes sans image.
  const index = Number((BigInt(id) >> BigInt(22)) % BigInt(6));
  return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Pas d'adaptateur : la session vit dans un cookie signé (JWT),
  // et on gère nous-mêmes la table Utilisateur.
  session: { strategy: "jwt" },
  providers: [
    // Pseudo et avatar (pas l'email), et l'ajout au serveur Discord WhenRaid,
    // qui permet au bot d'envoyer les convocations en MP.
    Discord({ authorization: { params: { scope: "identify guilds.join" } } }),
  ],
  callbacks: {
    async jwt({ token, profile, account }) {
      // `profile` n'est présent qu'au moment de la connexion.
      if (profile) {
        const discordId = String(profile.id);
        const pseudo = String(profile.global_name ?? profile.username);
        const avatarUrl = urlAvatarDiscord(discordId, (profile.avatar as string | null) ?? null);
        const utilisateur = await db.utilisateur.upsert({
          where: { discordId },
          create: { discordId, pseudo, avatarUrl },
          update: { pseudo, avatarUrl },
        });
        token.utilisateurId = utilisateur.id;
        // Le jeton d'accès Discord sert uniquement ici et n'est pas conservé.
        if (account?.access_token) await ajouterAuServeur(discordId, account.access_token);
      }
      return token;
    },
    session({ session, token }) {
      if (token.utilisateurId) session.user.id = token.utilisateurId;
      return session;
    },
  },
});
