import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { utilisateurConnecte } from "@/lib/session";

/**
 * Ouvrir une notification : elle passe en « lue », puis on va au raid concerné.
 * Seul son destinataire peut la marquer (sinon, simple retour aux notifications).
 * Les liens vers cette adresse sont de simples <a> : pas de préchargement qui la marquerait trop tôt.
 */
export async function GET(_requete: NextRequest, ctx: RouteContext<"/notifications/[id]">) {
  const { id } = await ctx.params;
  const utilisateur = await utilisateurConnecte();
  if (!utilisateur) redirect("/");

  const notification = await db.notification.findFirst({ where: { id, utilisateurId: utilisateur.id } });
  if (!notification) redirect("/notifications");
  if (!notification.lue) {
    await db.notification.update({ where: { id: notification.id }, data: { lue: true } });
    revalidatePath("/", "layout"); // compteur de la cloche
  }
  redirect(notification.annonceId ? `/annonces/${notification.annonceId}` : "/notifications");
}
