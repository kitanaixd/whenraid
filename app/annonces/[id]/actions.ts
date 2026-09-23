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
import { placePourRoles, rolesPourRaid, rolesProposes } from "@/lib/eligibilite";
import { Role } from "@/generated/prisma/enums";
import { envoyerMp } from "@/lib/discord";
import { texteNotification } from "@/lib/notifications";
import { libelleRole } from "@/lib/libelles";
import { envoyerInvitation, envoyerInvitations, URL_SITE } from "@/lib/invitations";
import { nomEnJeu } from "@/lib/jeu";

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
        ? ` Personnage : ${nomEnJeu(i.personnage)}${i.role ? ` (${libelleRole[i.role]})` : ""}.`
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
  const annonce = await db.annonce.findUnique({
    where: { id: String(form.get("annonceId") ?? "") },
    include: { places: true },
  });
  if (!annonce) notFound();
  const retour = retourVers(annonce.id);

  const personnageId = String(form.get("personnageId") ?? "");
  const personnage = await db.personnage.findFirst({
    where: { id: personnageId, utilisateurId: utilisateur.id, supprimeLe: null },
  });
  // Rôles coches, dans l'ordre Tank, Soigneur, DPS ; le RL choisira à l'acceptation.
  const coches = new Set(form.getAll("roles").map(String));
  const roles = (Object.keys(Role) as Role[]).filter((r) => coches.has(r));
  const note = String(form.get("note") ?? "").trim();

  if (annonce.createurId === utilisateur.id) retour("Tu organises ce raid, tu ne peux pas y candidater.");
  if (!accepteCandidatures(annonce)) retour("Ce raid n'accepte plus de candidatures.");
  if (!personnage) retour("Choisis un de tes personnages.");
  if (roles.length === 0) retour("Coche au moins un rôle.");
  const possibles = rolesPourRaid(personnage!, annonce.places, annonce);
  if (roles.some((r) => !possibles.includes(r))) retour("Ce personnage ne peut pas tenir ce rôle dans ce raid.");
  // Le site choisit la place : une place ouverte compatible, sinon la liste d'attente.
  const choix = placePourRoles(annonce.places, personnage!, roles, annonce);
  if (!choix) retour("Ce personnage ne correspond à aucune place de ce raid.");
  const place = choix!.place;
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
        role: choix!.role,
        rolesProposes: roles,
        note: note || null,
        // Aucune place compatible encore ouverte : directement en liste d'attente.
        statut: choix!.ouverte ? "INSCRIT" : "LISTE_ATTENTE",
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
    include: { personnage: true, place: { include: { annonce: true } } },
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
  const role = String(form.get("role") ?? "") as Role;
  if (!rolesProposes(inscription).includes(role)) retour("Ce joueur n'a pas proposé ce rôle.");

  await db.$transaction(async (tx) => {
    // Le joueur prend n'importe quelle place ouverte compatible (la sienne en priorité).
    // S'il n'en reste aucune, il est confirmé comme remplaçant sur sa place d'origine.
    const places = await tx.place.findMany({ where: { annonceId: annonce.id } });
    const choix = inscription.personnage
      ? placePourRoles(places, inscription.personnage, [role], annonce, inscription.placeId)
      : null;
    const cible = choix?.ouverte ? choix.place.id : (choix?.place.id ?? inscription.placeId);
    await tx.inscription.update({
      where: { id: inscription.id },
      data: { statut: "CONFIRME", placeId: cible, role },
    });
    await tx.place.updateMany({ where: { id: cible, statut: "OUVERTE" }, data: { statut: "POURVUE" } });
    await tx.notification.create({
      data: { utilisateurId: inscription.utilisateurId, type: "CANDIDATURE_ACCEPTEE", annonceId: annonce.id },
    });

    // Les autres candidats passent en liste d'attente seulement s'il ne reste
    // plus aucune place ouverte compatible avec leur personnage et l'un de leurs rôles.
    const placesApres = await tx.place.findMany({ where: { annonceId: annonce.id } });
    const enAttente = await tx.inscription.findMany({
      where: { place: { annonceId: annonce.id }, statut: "INSCRIT" },
      include: { personnage: true },
    });
    const sansPlace = enAttente
      .filter((i) => !i.personnage || !placePourRoles(placesApres, i.personnage, rolesProposes(i), annonce)?.ouverte)
      .map((i) => i.id);
    if (sansPlace.length > 0) {
      await tx.inscription.updateMany({ where: { id: { in: sansPlace } }, data: { statut: "LISTE_ATTENTE" } });
    }

    // Raid plein : il passe « complet » et tous les candidats restants en liste d'attente.
    if (estComplet(placesApres)) {
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
