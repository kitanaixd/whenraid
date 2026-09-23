"use server";

import { notFound, redirect } from "next/navigation";
import { after } from "next/server";
import type { TypeNotification } from "@/generated/prisma/enums";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { exigerUtilisateur } from "@/lib/session";
import {
  accepteCandidatures,
  estActive,
  estComplet,
  etatPresences,
  rlPeutAgir,
  STATUTS_ACTIFS,
  STATUTS_EN_ATTENTE,
} from "@/lib/annonces";
import { seChevauchent } from "@/lib/jeu";
import { rolesPourPlace } from "./eligibilite";
import { envoyerMp } from "@/lib/discord";
import { texteNotification } from "@/lib/notifications";
import { libelleRole } from "@/lib/libelles";
import { envoyerInvitation, envoyerInvitations, URL_SITE } from "@/lib/invitations";

/** Envoie en MP Discord, après la réponse, la même information que la notification du site. */
function prevenirEnMp(inscriptionId: string, type: TypeNotification) {
  after(async () => {
    const i = await db.inscription.findUnique({
      where: { id: inscriptionId },
      include: { utilisateur: true, personnage: true, place: { include: { annonce: true } } },
    });
    if (!i) return;
    const { annonce } = i.place;
    const avec =
      type === "CANDIDATURE_ACCEPTEE" && i.personnage
        ? ` Personnage : ${i.personnage.nom}${i.role ? ` (${libelleRole[i.role]})` : ""}.`
        : "";
    const texte = texteNotification(type, annonce, i.utilisateur.fuseauHoraire);
    await envoyerMp(i.utilisateur.discordId, `${texte}${avec}
${URL_SITE}/annonces/${annonce.id}`);
    // Accepté après l'envoi des invitations (ex. remplaçant) : il reçoit la sienne tout de suite.
    if (type === "CANDIDATURE_ACCEPTEE" && annonce.invitationsEnvoyeesLe) await envoyerInvitation(i.id);
  });
}

const retourVers =
  (annonceId: string) =>
  (erreur?: string): never =>
    redirect(`/annonces/${annonceId}${erreur ? `?erreur=${encodeURIComponent(erreur)}` : ""}`);

function rafraichir(annonceId: string) {
  revalidatePath(`/annonces/${annonceId}`);
  revalidatePath("/");
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

  await db.$transaction([
    db.inscription.create({
      data: {
        placeId: place.id,
      personnageId: personnage!.id,
      utilisateurId: utilisateur.id,
      role: role as never,
      note: note || null,
        // Place déjà pourvue (raid plein) : directement en liste d'attente.
        statut: place.statut === "OUVERTE" ? "INSCRIT" : "LISTE_ATTENTE",
      },
    }),
    db.notification.create({
      data: { utilisateurId: annonce.createurId, type: "NOUVELLE_CANDIDATURE", annonceId: annonce.id },
    }),
  ]);
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
    await tx.notification.create({
      data: { utilisateurId: inscription.utilisateurId, type: "CANDIDATURE_ACCEPTEE", annonceId: annonce.id },
    });

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
      const devientComplet = await tx.annonce.updateMany({
        where: { id: annonce.id, statut: "PUBLIEE" },
        data: { statut: "COMPLETE" },
      });
      await tx.inscription.updateMany({
        where: { place: { annonceId: annonce.id }, statut: "INSCRIT" },
        data: { statut: "LISTE_ATTENTE" },
      });
      // Une seule fois, au moment où le raid devient complet : on prévient ceux qui attendent.
      if (devientComplet.count === 1) {
        const enAttente = await tx.inscription.findMany({
          where: { place: { annonceId: annonce.id }, statut: "LISTE_ATTENTE" },
          select: { utilisateurId: true },
        });
        const destinataires = [...new Set(enAttente.map((i) => i.utilisateurId))];
        await tx.notification.createMany({
          data: destinataires.map((utilisateurId) => ({ utilisateurId, type: "RAID_COMPLET" as const, annonceId: annonce.id })),
        });
      }
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
  prevenirEnMp(inscription.id, "CANDIDATURE_ACCEPTEE");

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
  await db.$transaction([
    db.inscription.update({ where: { id: inscription.id }, data: { statut: "REFUSE" } }),
    db.notification.create({
      data: { utilisateurId: inscription.utilisateurId, type: "CANDIDATURE_REFUSEE", annonceId: annonce.id },
    }),
  ]);
  prevenirEnMp(inscription.id, "CANDIDATURE_REFUSEE");
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
  await db.$transaction(async (tx) => {
    const annulee = await tx.annonce.updateMany({
      where: { id: annonce.id, statut: { in: ["PUBLIEE", "COMPLETE"] } },
      data: { statut: "ANNULEE", annuleeLe: new Date(), annuleeComplete: estComplet(annonce.places) },
    });
    if (annulee.count === 0) return;
    const concernes = await tx.inscription.findMany({
      where: { place: { annonceId: annonce.id }, statut: { in: [...STATUTS_ACTIFS] } },
      select: { utilisateurId: true },
    });
    await tx.notification.createMany({
      data: [...new Set(concernes.map((i) => i.utilisateurId))].map((utilisateurId) => ({
        utilisateurId,
        type: "RAID_ANNULE" as const,
        annonceId: annonce.id,
      })),
    });
  });
  rafraichir(annonce.id);
  retour();
}

export async function envoyerLesInvitations(form: FormData) {
  const utilisateur = await exigerUtilisateur();
  const annonceId = String(form.get("annonceId") ?? "");
  const retour = retourVers(annonceId);

  if (form.get("confirmation") !== "on") retour("Coche la case de confirmation pour envoyer les invitations.");
  const annonce = await db.annonce.findFirst({ where: { id: annonceId, createurId: utilisateur.id } });
  if (!annonce) notFound();
  if (!rlPeutAgir(annonce)) retour("Ce raid n'est plus modifiable.");

  await db.annonce.update({ where: { id: annonce.id }, data: { invitationsEnvoyeesLe: new Date() } });
  after(() => envoyerInvitations(annonce.id));
  rafraichir(annonce.id);
  retour();
}

const RESULTATS = ["PRESENT", "ABSENT", "PARTI_EN_COURS"] as const;

export async function enregistrerPresences(form: FormData) {
  const utilisateur = await exigerUtilisateur();
  const annonceId = String(form.get("annonceId") ?? "");
  const retour = retourVers(annonceId);
  const valider = form.get("valider") === "1";

  const annonce = await db.annonce.findFirst({
    where: { id: annonceId, createurId: utilisateur.id },
    include: { places: { include: { inscriptions: { where: { statut: "CONFIRME" } } } } },
  });
  if (!annonce) notFound();
  const etat = etatPresences(annonce);
  if (!etat.modifiable) retour("La feuille de présence n'est pas modifiable.");
  if (valider && !etat.validable) retour("Tu pourras valider la fin du raid une fois l'heure de fin passée.");

  const confirmes = annonce.places.flatMap((p) => p.inscriptions).filter((i) => i.personnageId);
  await db.$transaction(async (tx) => {
    for (const i of confirmes) {
      const brut = String(form.get(`presence.${i.id}`) ?? "PRESENT");
      const resultat = (RESULTATS as readonly string[]).includes(brut) ? (brut as (typeof RESULTATS)[number]) : "PRESENT";
      // On ne peut pas se distinguer en étant absent.
      const distinction = resultat !== "ABSENT" && form.get(`distinction.${i.id}`) === "on";
      await tx.participation.upsert({
        where: { annonceId_personnageId: { annonceId: annonce.id, personnageId: i.personnageId! } },
        create: {
          annonceId: annonce.id,
          personnageId: i.personnageId!,
          utilisateurId: i.utilisateurId,
          resultat,
          distinction,
          source: "VALIDATION_MANUELLE",
        },
        update: { resultat, distinction, enregistreLe: new Date() },
      });
    }
    if (valider) {
      await tx.annonce.update({
        where: { id: annonce.id },
        data: { presencesValideesLe: new Date(), statut: "CLOTUREE" },
      });
    }
  });
  rafraichir(annonce.id);
  retour();
}
