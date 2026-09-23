"use server";

import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { exigerUtilisateur } from "@/lib/session";
import { accepteCandidatures, estActive, estComplet, STATUTS_ACTIFS, STATUTS_EN_ATTENTE } from "@/lib/annonces";
import { creneau, seChevauchent } from "@/lib/jeu";
import { rolesPourPlace } from "./eligibilite";

const retourVers =
  (annonceId: string) =>
  (erreur?: string): never =>
    redirect(`/annonces/${annonceId}${erreur ? `?erreur=${encodeURIComponent(erreur)}` : ""}`);

function rafraichir(annonceId: string) {
  revalidatePath(`/annonces/${annonceId}`);
  revalidatePath("/");
}

/** Le RL garde la main sur ses candidats jusqu'à la fin prévue du raid (remplaçants). */
function rlPeutAgir(annonce: { statut: string; debutUtc: Date; dureeEstimee: number | null }) {
  return ["PUBLIEE", "COMPLETE"].includes(annonce.statut) && Date.now() < creneau(annonce).fin;
}

/** Le joueur est-il déjà confirmé dans un autre raid sur ce créneau ? */
async function dejaConfirmeAilleurs(
  utilisateurId: string,
  annonce: { id: string; debutUtc: Date; dureeEstimee: number | null },
) {
  const confirmations = await db.inscription.findMany({
    where: {
      utilisateurId,
      statut: "CONFIRME",
      place: { annonceId: { not: annonce.id }, annonce: { statut: { in: ["PUBLIEE", "COMPLETE"] } } },
    },
    include: { place: { include: { annonce: true } } },
  });
  return confirmations.some((c) => seChevauchent(c.place.annonce, annonce));
}

export async function candidater(form: FormData) {
  const utilisateur = await exigerUtilisateur();
  const place = await db.place.findUnique({
    where: { id: String(form.get("placeId") ?? "") },
    include: { annonce: true },
  });
  if (!place) notFound();
  const { annonce } = place;
  const retour = retourVers(annonce.id);

  const [personnageId, role] = String(form.get("choix") ?? "").split(":");
  const personnage = await db.personnage.findFirst({ where: { id: personnageId, utilisateurId: utilisateur.id } });
  const note = String(form.get("note") ?? "").trim();

  if (annonce.createurId === utilisateur.id) retour("Tu organises ce raid, tu ne peux pas y candidater.");
  if (!accepteCandidatures(annonce)) retour("Ce raid n'accepte plus de candidatures.");
  if (place.statut === "ANNULEE") retour("Cette place a été retirée.");
  if (!personnage || !rolesPourPlace(personnage, place, annonce).includes(role as never)) {
    retour("Ce personnage ne correspond pas à cette place.");
  }
  if (note.length > 80) retour("Ta note doit faire 80 caractères maximum.");

  const dejaCandidat = await db.inscription.findFirst({
    where: { utilisateurId: utilisateur.id, statut: { in: [...STATUTS_ACTIFS] }, place: { annonceId: annonce.id } },
  });
  if (dejaCandidat) retour("Tu as déjà une candidature sur ce raid.");
  if (await dejaConfirmeAilleurs(utilisateur.id, annonce)) {
    retour("Tu es déjà confirmé dans un autre raid sur ce créneau.");
  }

  await db.inscription.create({
    data: {
      placeId: place.id,
      personnageId: personnage!.id,
      utilisateurId: utilisateur.id,
      role: role as never,
      note: note || null,
      // Place déjà pourvue (raid plein) : directement en liste d'attente.
      statut: place.statut === "OUVERTE" ? "INSCRIT" : "LISTE_ATTENTE",
    },
  });
  rafraichir(annonce.id);
  retour();
}

/** Charge une candidature et vérifie que l'utilisateur connecté en est le RL. */
async function candidaturePourRl(form: FormData) {
  const utilisateur = await exigerUtilisateur();
  const inscription = await db.inscription.findUnique({
    where: { id: String(form.get("inscriptionId") ?? "") },
    include: { place: { include: { annonce: true } } },
  });
  if (!inscription || inscription.place.annonce.createurId !== utilisateur.id) notFound();
  return inscription;
}

export async function accepter(form: FormData) {
  const inscription = await candidaturePourRl(form);
  const { annonce } = inscription.place;
  const retour = retourVers(annonce.id);

  if (!rlPeutAgir(annonce)) retour("Ce raid n'est plus modifiable.");
  if (!(STATUTS_EN_ATTENTE as readonly string[]).includes(inscription.statut)) {
    retour("Cette candidature n'est plus en attente.");
  }
  if (await dejaConfirmeAilleurs(inscription.utilisateurId, annonce)) {
    retour("Ce joueur a déjà été confirmé dans un autre raid sur ce créneau.");
  }

  await db.$transaction(async (tx) => {
    await tx.inscription.update({ where: { id: inscription.id }, data: { statut: "CONFIRME" } });

    // Première acceptation sur la place : elle devient pourvue, les autres candidats
    // de cette place passent en liste d'attente. Sinon, c'est un remplaçant.
    const pourvue = await tx.place.updateMany({
      where: { id: inscription.placeId, statut: "OUVERTE" },
      data: { statut: "POURVUE" },
    });
    if (pourvue.count === 1) {
      await tx.inscription.updateMany({
        where: { placeId: inscription.placeId, statut: "INSCRIT" },
        data: { statut: "LISTE_ATTENTE" },
      });
    }

    // Raid plein : il passe « complet » et tous les candidats restants en liste d'attente.
    const places = await tx.place.findMany({ where: { annonceId: annonce.id }, select: { statut: true } });
    if (estComplet(places)) {
      await tx.annonce.updateMany({ where: { id: annonce.id, statut: "PUBLIEE" }, data: { statut: "COMPLETE" } });
      await tx.inscription.updateMany({
        where: { place: { annonceId: annonce.id }, statut: "INSCRIT" },
        data: { statut: "LISTE_ATTENTE" },
      });
    }

    // Le joueur est pris : ses candidatures sur le même créneau sont retirées.
    const autres = await tx.inscription.findMany({
      where: {
        utilisateurId: inscription.utilisateurId,
        statut: { in: [...STATUTS_EN_ATTENTE] },
        place: { annonceId: { not: annonce.id } },
      },
      include: { place: { include: { annonce: true } } },
    });
    const aRetirer = autres.filter((a) => seChevauchent(a.place.annonce, annonce)).map((a) => a.id);
    if (aRetirer.length > 0) {
      await tx.inscription.updateMany({ where: { id: { in: aRetirer } }, data: { statut: "RETIRE" } });
    }
  });

  rafraichir(annonce.id);
  retour();
}

export async function refuser(form: FormData) {
  const inscription = await candidaturePourRl(form);
  const { annonce } = inscription.place;
  const retour = retourVers(annonce.id);

  if (!rlPeutAgir(annonce)) retour("Ce raid n'est plus modifiable.");
  if (!estActive(inscription.statut) || inscription.statut === "CONFIRME") {
    retour("Cette candidature n'est plus en attente.");
  }
  await db.inscription.update({ where: { id: inscription.id }, data: { statut: "REFUSE" } });
  rafraichir(annonce.id);
  retour();
}

export async function annuler(form: FormData) {
  const utilisateur = await exigerUtilisateur();
  const annonceId = String(form.get("annonceId") ?? "");
  const retour = retourVers(annonceId);

  if (form.get("confirmation") !== "on") retour("Coche la case de confirmation pour annuler le raid.");

  const annonce = await db.annonce.findFirst({
    where: { id: annonceId, createurId: utilisateur.id },
    include: { places: { select: { statut: true } } },
  });
  if (!annonce) notFound();
  if (!accepteCandidatures(annonce)) retour("Ce raid ne peut plus être annulé.");

  // On enregistre les faits ; la réputation se calculera à la lecture (règle 3).
  // Le filtre sur le statut évite une double annulation simultanée.
  await db.annonce.updateMany({
    where: { id: annonce.id, statut: { in: ["PUBLIEE", "COMPLETE"] } },
    data: { statut: "ANNULEE", annuleeLe: new Date(), annuleeComplete: estComplet(annonce.places) },
  });
  rafraichir(annonce.id);
  retour();
}
