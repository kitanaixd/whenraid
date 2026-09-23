import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

/** L'utilisateur connecté, ou null. */
export async function utilisateurConnecte() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return db.utilisateur.findUnique({ where: { id: session.user.id } });
}

/** À utiliser dans chaque page ou action réservée aux connectés. */
export async function exigerUtilisateur() {
  const utilisateur = await utilisateurConnecte();
  if (!utilisateur) redirect("/");
  return utilisateur;
}
