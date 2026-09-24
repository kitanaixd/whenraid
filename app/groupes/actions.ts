"use server";

import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { exigerUtilisateur } from "@/lib/session";
import { ErreurFormulaire, messageErreur, texte } from "@/lib/formulaire";
import { dicoCourant } from "@/lib/langue";
import { lireMembre, MAX_MEMBRES, nouveauCode } from "@/lib/groupes";

/** Exécute une modification ; une erreur de saisie revient sur `page` avec son message. */
async function tenter(page: string, action: () => Promise<string | void>) {
  let destination: string | void;
  try {
    destination = await action();
  } catch (e) {
    redirect(`${page}?erreur=${encodeURIComponent(messageErreur(e, await dicoCourant()))}`);
  }
  revalidatePath("/groupes");
  revalidatePath("/");
  redirect(destination ?? page);
}

export async function creerGroupe(form: FormData) {
  const utilisateur = await exigerUtilisateur();
  await tenter("/groupes", async () => {
    const nom = texte(form, "nom", { requis: true, max: 24, champ: "nomGroupe" })!;
    const membre = await lireMembre(form, utilisateur.id);
    const groupe = await db.escouade.create({
      data: {
        nom,
        chefId: utilisateur.id,
        code: nouveauCode(),
        membres: { create: { utilisateurId: utilisateur.id, ...membre } },
      },
    });
    return `/groupes/${groupe.id}`;
  });
}

export async function rejoindreGroupe(form: FormData) {
  const utilisateur = await exigerUtilisateur();
  const code = String(form.get("code") ?? "");
  const groupe = await db.escouade.findUnique({ where: { code }, include: { membres: true } });
  if (!groupe) notFound();
  if (groupe.membres.some((m) => m.utilisateurId === utilisateur.id)) redirect(`/groupes/${groupe.id}`);
  await tenter(`/groupes/rejoindre/${code}`, async () => {
    const membre = await lireMembre(form, utilisateur.id);
    await db.$transaction(async (tx) => {
      // Recompté dans la transaction : deux amis qui rejoignent en même temps ne dépassent pas 5.
      const nombre = await tx.membreEscouade.count({ where: { escouadeId: groupe.id } });
      if (nombre >= MAX_MEMBRES) throw new ErreurFormulaire((d) => d.erreur.groupePlein);
      await tx.membreEscouade.create({ data: { escouadeId: groupe.id, utilisateurId: utilisateur.id, ...membre } });
    });
    return `/groupes/${groupe.id}`;
  });
}

/** Le membre change son personnage ou ses rôles dans le groupe. */
export async function modifierMonPerso(form: FormData) {
  const utilisateur = await exigerUtilisateur();
  const escouadeId = String(form.get("escouadeId") ?? "");
  const moi = await db.membreEscouade.findUnique({
    where: { escouadeId_utilisateurId: { escouadeId, utilisateurId: utilisateur.id } },
  });
  if (!moi) notFound();
  await tenter(`/groupes/${escouadeId}`, async () => {
    const membre = await lireMembre(form, utilisateur.id);
    await db.membreEscouade.update({ where: { id: moi.id }, data: membre });
  });
}

/** Le chef retire un membre (pas lui-même : il supprime le groupe s'il veut partir). */
export async function retirerMembre(form: FormData) {
  const utilisateur = await exigerUtilisateur();
  const membre = await db.membreEscouade.findUnique({
    where: { id: String(form.get("membreId") ?? "") },
    include: { escouade: true },
  });
  if (!membre || membre.escouade.chefId !== utilisateur.id || membre.utilisateurId === utilisateur.id) notFound();
  await db.membreEscouade.delete({ where: { id: membre.id } });
  await tenter(`/groupes/${membre.escouadeId}`, async () => {});
}

/** Un membre (hors chef) quitte le groupe. */
export async function quitterGroupe(form: FormData) {
  const utilisateur = await exigerUtilisateur();
  const escouadeId = String(form.get("escouadeId") ?? "");
  const supprime = await db.membreEscouade.deleteMany({
    where: { escouadeId, utilisateurId: utilisateur.id, escouade: { chefId: { not: utilisateur.id } } },
  });
  if (supprime.count === 0) notFound();
  await tenter("/groupes", async () => {});
}

/** Le chef supprime le groupe ; les candidatures déjà envoyées restent (sans lien de groupe). */
export async function supprimerGroupe(form: FormData) {
  const utilisateur = await exigerUtilisateur();
  const supprime = await db.escouade.deleteMany({
    where: { id: String(form.get("escouadeId") ?? ""), chefId: utilisateur.id },
  });
  if (supprime.count === 0) notFound();
  await tenter("/groupes", async () => {});
}
