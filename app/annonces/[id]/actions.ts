"use server";

import { notFound, redirect } from "next/navigation";
import { after } from "next/server";
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
import { nomEnJeu, seChevauchent } from "@/lib/jeu";
import { placePourRoles, rolesPourRaid, rolesProposes } from "@/lib/eligibilite";
import { Role } from "@/generated/prisma/enums";
import { envoyerInvitations } from "@/lib/invitations";
import { carteNotification } from "@/lib/carteDiscord";
import { envoyerMp } from "@/lib/discord";
import { dico } from "@/lib/i18n";
import { prevenirEnMp } from "@/lib/prevenir";
import { lienWarcraftLogs, messageErreur } from "@/lib/formulaire";
import { dicoCourant } from "@/lib/langue";

const retourVers =
  (annonceId: string) =>
  (erreur?: string): never =>
    redirect(`/annonces/${annonceId}${erreur ? `?erreur=${encodeURIComponent(erreur)}` : ""}`);

/** Retour à la liste des raids, en gardant uniquement les filtres connus (jamais une adresse libre). */
function retourListe(form: FormData) {
  const recue = new URLSearchParams(String(form.get("retour") ?? ""));
  const params = new URLSearchParams();
  for (const nom of ["perso", "raid", "jour", "mois", "duree"]) {
    const v = recue.get(nom);
    if (v && /^[\w-]{1,40}$/.test(v)) params.set(nom, v);
  }
  // Recherche par titre : lettres, chiffres, espaces et tirets seulement.
  const q = recue.get("q");
  if (q && /^[\p{L}\p{N} '’-]{1,40}$/u.test(q)) params.set("q", q);
  return (erreur?: string): never => {
    if (erreur) params.set("erreur", erreur);
    const requete = params.toString();
    return redirect(`/${requete ? `?${requete}` : ""}#titre-raids`);
  };
}

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
  const d = await dicoCourant();
  const annonce = await db.annonce.findUnique({
    where: { id: String(form.get("annonceId") ?? "") },
    include: { places: true },
  });
  if (!annonce) notFound();
  // Candidature rapide depuis la liste : on y revient (mêmes filtres), sinon sur la page du raid.
  const retour = form.get("depuis") === "liste" ? retourListe(form) : retourVers(annonce.id);

  const personnageId = String(form.get("personnageId") ?? "");
  const personnage = await db.personnage.findFirst({
    where: { id: personnageId, utilisateurId: utilisateur.id, supprimeLe: null },
  });
  const coches = new Set(form.getAll("roles").map(String));
  const note = String(form.get("note") ?? "").trim();

  if (annonce.createurId === utilisateur.id) retour(d.erreur.organisateur);
  if (!accepteCandidatures(annonce)) retour(d.erreur.plusDeCandidatures);
  if (!personnage) retour(d.erreur.choisisPerso);
  if (coches.size === 0) retour(d.erreur.unRole);
  // Rôles cochés que ce personnage peut tenir dans ce raid, dans l'ordre Tank, Soigneur, DPS.
  // Le RL choisira à l'acceptation.
  const possibles = rolesPourRaid(personnage!, annonce.places, annonce);
  const roles = possibles.filter((r) => coches.has(r));
  if (roles.length === 0) retour(d.erreur.pasCesRoles(nomEnJeu(personnage!)));
  // Le site choisit la place : une place ouverte compatible, sinon la liste d'attente.
  const choix = placePourRoles(annonce.places, personnage!, roles, annonce);
  if (!choix) retour(d.erreur.aucunePlace);
  const place = choix!.place;
  if (note.length > 80) retour(d.erreur.noteTropLongue);

  const dejaCandidat = await db.inscription.findFirst({
    where: { utilisateurId: utilisateur.id, statut: { in: [...STATUTS_ACTIFS] }, place: { annonceId: annonce.id } },
  });
  if (dejaCandidat) retour(d.erreur.dejaCandidat);
  if (await dejaConfirmeAilleurs(utilisateur.id, annonce)) retour(d.erreur.dejaConfirme);

  // Une seule ligne par personnage et par place : une ancienne candidature retirée est réactivée.
  const ancienne = await db.inscription.findUnique({
    where: { placeId_personnageId: { placeId: place.id, personnageId: personnage!.id } },
  });
  if (ancienne?.statut === "REFUSE") retour(d.erreur.dejaRefuse);
  const candidature = {
    role: choix!.role,
    rolesProposes: roles,
    note: note || null,
    // Aucune place compatible encore ouverte : directement en liste d'attente.
    statut: choix!.ouverte ? ("INSCRIT" as const) : ("LISTE_ATTENTE" as const),
  };

  await db.$transaction([
    ancienne
      ? db.inscription.update({ where: { id: ancienne.id }, data: { ...candidature, inscritLe: new Date() } })
      : db.inscription.create({
          data: { ...candidature, placeId: place.id, personnageId: personnage!.id, utilisateurId: utilisateur.id },
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
  const d = await dicoCourant();
  const { annonce } = inscription.place;
  const retour = retourVers(annonce.id);

  if (!rlPeutAgir(annonce)) retour(d.erreur.plusModifiable);
  if (!(STATUTS_EN_ATTENTE as readonly string[]).includes(inscription.statut)) retour(d.erreur.plusEnAttente);
  if (await dejaConfirmeAilleurs(inscription.utilisateurId, annonce)) retour(d.erreur.joueurDejaConfirme);
  const role = String(form.get("role") ?? "") as Role;
  if (!rolesProposes(inscription).includes(role)) retour(d.erreur.rolePasPropose);

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
          data: destinataires.map((utilisateurId) => ({
            utilisateurId,
            type: "RAID_COMPLET" as const,
            annonceId: annonce.id,
          })),
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
  const d = await dicoCourant();
  const { annonce } = inscription.place;
  const retour = retourVers(annonce.id);

  if (!rlPeutAgir(annonce)) retour(d.erreur.plusModifiable);
  if (!estActive(inscription.statut) || inscription.statut === "CONFIRME") retour(d.erreur.plusEnAttente);
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
  const d = await dicoCourant();
  const annonceId = String(form.get("annonceId") ?? "");
  const retour = retourVers(annonceId);

  if (form.get("confirmation") !== "on") retour(d.erreur.confirmerAnnulation);

  const annonce = await db.annonce.findFirst({
    where: { id: annonceId, createurId: utilisateur.id },
    include: { places: { select: { statut: true } } },
  });
  if (!annonce) notFound();
  if (!accepteCandidatures(annonce)) retour(d.erreur.plusAnnulable);

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
  const d = await dicoCourant();
  const annonceId = String(form.get("annonceId") ?? "");
  const retour = retourVers(annonceId);

  if (form.get("confirmation") !== "on") retour(d.erreur.confirmerInvitations);
  const annonce = await db.annonce.findFirst({ where: { id: annonceId, createurId: utilisateur.id } });
  if (!annonce) notFound();
  if (!rlPeutAgir(annonce)) retour(d.erreur.plusModifiable);
  const aInviter = await db.inscription.count({
    where: { statut: "CONFIRME", invitationEnvoyeeLe: null, place: { annonceId: annonce.id } },
  });
  if (aInviter === 0) retour(d.erreur.tousInvites);

  // Date du premier envoi ; ensuite, seuls les joueurs pas encore invités reçoivent un MP.
  if (!annonce.invitationsEnvoyeesLe) {
    await db.annonce.update({ where: { id: annonce.id }, data: { invitationsEnvoyeesLe: new Date() } });
  }
  after(() => envoyerInvitations(annonce.id));
  rafraichir(annonce.id);
  retour();
}

const RESULTATS = ["PRESENT", "ABSENT", "PARTI_EN_COURS"] as const;

export async function enregistrerPresences(form: FormData) {
  const utilisateur = await exigerUtilisateur();
  const d = await dicoCourant();
  const annonceId = String(form.get("annonceId") ?? "");
  const retour = retourVers(annonceId);
  const valider = form.get("valider") === "1";

  const annonce = await db.annonce.findFirst({
    where: { id: annonceId, createurId: utilisateur.id },
    include: { places: { include: { inscriptions: { where: { statut: "CONFIRME" } } } } },
  });
  if (!annonce) notFound();
  const etat = etatPresences(annonce);
  if (!etat.modifiable) retour(d.erreur.presencesFigees);
  if (valider && !etat.validable) retour(d.erreur.finPasPassee);

  const confirmes = annonce.places.flatMap((p) => p.inscriptions).filter((i) => i.personnageId);
  await db.$transaction(async (tx) => {
    for (const i of confirmes) {
      const brut = String(form.get(`presence.${i.id}`) ?? "PRESENT");
      const resultat = (RESULTATS as readonly string[]).includes(brut)
        ? (brut as (typeof RESULTATS)[number])
        : "PRESENT";
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

/**
 * Le joueur se désinscrit d'un raid qui n'a pas commencé. S'il était convié, sa
 * place se rouvre, le RL est prévenu, et les joueurs en liste d'attente qui
 * peuvent la prendre redeviennent candidats.
 */
export async function seDesinscrire(form: FormData) {
  const utilisateur = await exigerUtilisateur();
  const d = await dicoCourant();
  const inscription = await db.inscription.findFirst({
    where: { id: String(form.get("inscriptionId") ?? ""), utilisateurId: utilisateur.id },
    include: { place: { include: { annonce: { include: { createur: true } } } } },
  });
  if (!inscription) notFound();
  const { annonce } = inscription.place;
  const retour = form.get("depuis") === "liste" ? retourListe(form) : retourVers(annonce.id);

  if (!estActive(inscription.statut)) retour(d.erreur.plusInscrit);
  if (!accepteCandidatures(annonce)) retour(d.erreur.tropTardPourPartir);
  const etaitConvie = inscription.statut === "CONFIRME";

  await db.$transaction(async (tx) => {
    await tx.inscription.update({ where: { id: inscription.id }, data: { statut: "RETIRE" } });
    if (!etaitConvie) return;

    // Un remplaçant sur la même place devient titulaire ; sinon la place se rouvre.
    const remplacant = await tx.inscription.findFirst({ where: { placeId: inscription.placeId, statut: "CONFIRME" } });
    if (remplacant) return;
    await tx.place.update({ where: { id: inscription.placeId }, data: { statut: "OUVERTE" } });
    await tx.annonce.updateMany({ where: { id: annonce.id, statut: "COMPLETE" }, data: { statut: "PUBLIEE" } });
    await tx.notification.create({
      data: { utilisateurId: annonce.createurId, type: "DESISTEMENT", annonceId: annonce.id },
    });

    // Les joueurs en liste d'attente qui peuvent prendre une place ouverte redeviennent candidats.
    const places = await tx.place.findMany({ where: { annonceId: annonce.id } });
    const enAttente = await tx.inscription.findMany({
      where: { place: { annonceId: annonce.id }, statut: "LISTE_ATTENTE" },
      include: { personnage: true },
    });
    const repris = enAttente
      .filter((i) => i.personnage && placePourRoles(places, i.personnage, rolesProposes(i), annonce)?.ouverte)
      .map((i) => i.id);
    if (repris.length > 0) {
      await tx.inscription.updateMany({ where: { id: { in: repris } }, data: { statut: "INSCRIT" } });
    }
  });

  // Le RL est prévenu en MP Discord, comme sur le site (dans sa langue).
  if (etaitConvie) {
    after(async () => {
      const place = await db.place.findUnique({ where: { id: inscription.placeId } });
      if (place?.statut !== "OUVERTE") return; // un remplaçant a pris la place : rien à signaler
      const dRl = dico(annonce.createur.langueSite);
      await envoyerMp(annonce.createur.discordId, carteNotification("DESISTEMENT", annonce, dRl));
    });
  }
  rafraichir(annonce.id);
  retour();
}

/** Le RL ajoute, change ou retire (champ vide) le lien Warcraft Logs du raid. */
export async function enregistrerLogsRaid(form: FormData) {
  const utilisateur = await exigerUtilisateur();
  const d = await dicoCourant();
  const annonce = await db.annonce.findFirst({
    where: { id: String(form.get("annonceId") ?? ""), createurId: utilisateur.id, statut: { not: "BROUILLON" } },
  });
  if (!annonce) notFound();
  const retour = retourVers(annonce.id);

  let lienLogs: string | null;
  try {
    lienLogs = lienWarcraftLogs(form, "lienLogs");
  } catch (e) {
    return retour(messageErreur(e, d));
  }
  await db.annonce.update({ where: { id: annonce.id }, data: { lienLogs } });
  revalidatePath(`/annonces/${annonce.id}`);
  retour();
}
