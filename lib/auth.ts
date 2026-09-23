import NextAuth, { type DefaultSession } from "next-auth";
import Discord from "next-auth/providers/discord";
import { db } from "@/lib/db";

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
    // On ne demande que le pseudo et l'avatar, pas l'email.
    Discord({ authorization: { params: { scope: "identify" } } }),
  ],
  callbacks: {
    async jwt({ token, profile }) {
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
      }
      return token;
    },
    session({ session, token }) {
      if (token.utilisateurId) session.user.id = token.utilisateurId;
      return session;
    },
  },
});
