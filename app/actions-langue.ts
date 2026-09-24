"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { estLangue } from "@/lib/i18n";
import { COOKIE_LANGUE } from "@/lib/langue";
import { utilisateurConnecte } from "@/lib/session";

/** Change la langue du site : mémorisée dans le navigateur et sur le compte (pour les MP Discord). */
export async function changerLangue(form: FormData) {
  const langue = form.get("langue");
  if (!estLangue(langue)) return;
  (await cookies()).set(COOKIE_LANGUE, langue, {
    maxAge: 365 * 24 * 3600,
    sameSite: "lax",
    path: "/",
  });
  const utilisateur = await utilisateurConnecte();
  if (utilisateur && utilisateur.langueSite !== langue) {
    await db.utilisateur.update({ where: { id: utilisateur.id }, data: { langueSite: langue } });
  }
  revalidatePath("/", "layout");
}
