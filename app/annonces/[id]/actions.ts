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
import { affecterGroupe, placePourRoles, rolesPourRaid, rolesProposes } from "@/lib/eligibilite";
import { monGroupe } from "@/lib/groupes";
import type { Prisma } from "@/generated/prisma/client";
import type { Dico } from "@/lib/i18n";
import { Role, type Faction, type Region, type Ruleset } from "@/generated/prisma/enums";
import { envoyerInvitations } from "@/lib/invitations";
import { carteNotification, carteRaid, COULEUR_OR } from "@/lib/carteDiscord";
import { envoyerMp } from "@/lib/discord";
import { dico } from "@/lib/i18n";
import { prevenirEnMp } from "@/lib/prevenir";
import { ErreurFormulaire, lienWarcraftLogs, messageErreur } from "@/lib/formulaire";
import { dicoCourant } from "@/lib/langue";

const retourVers =
  (annonceId: string) =>
  (erreur?: string): never =>
    redirect(`/annonces/${annonceId}${erreur ? `?erreur=${encodeURIComponent(erreur)}` : ""}`);

/** Retour à la liste des raids, en gardant uniquement les filtres connus (jamais une adresse libre). */
function retourListe(form: FormData) {
  const recue = new URLSearchParams(String(form.get("retour") ?? ""));
  const params = new URLSearchParams();
  for (const nom of ["perso", "groupe", "raid", "jour", "mois", "duree", "masquer", "vue"]) {
    const v = recue.getAll(nom).join(",");
    if (v && /^[\w,-]{1,120}$/.test(v)) params.set(nom, v);
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
  const escouadeId = String(form.get("escouadeId") ?? "");
  if (escouadeId) {
    await candidaterEnGroupe(utilisateur.id, annonce, escouadeId, String(form.get("note") ?? "").trim(), retour, d);
    rafraichir(annonce.id);
    retour();
  }

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

type Transaction = Parameters<Parameters<typeof db.$transaction>[0]>[0];

/**
 * Après une ou plusieurs acceptations : les candidats sans place ouverte passent en liste
 * d'attente, le raid devient complet s'il est plein, et les joueurs pris quittent leurs
 * autres candidatures sur le même créneau.
 */
async function apresConfirmation(
  tx: Transaction,
  annonce: {
    id: string;
    faction: Faction;
    ruleset: Ruleset;
    region: Region;
    niveauMin: number | null;
    debutUtc: Date;
    dureeEstimee: number | null;
  },
  utilisateurIds: string[],
) {
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

  // Les joueurs pris : leurs candidatures sur le même créneau sont retirées.
  const autres = await tx.inscription.findMany({
    where: {
      utilisateurId: { in: utilisateurIds },
      statut: { in: [...STATUTS_EN_ATTENTE] },
      place: { annonceId: { not: annonce.id } },
    },
    include: { place: { include: { annonce: true } } },
  });
  const retirees = autres.filter((a) => seChevauchent(a.place.annonce, annonce));
  if (retirees.length > 0) {
    await tx.inscription.updateMany({ where: { id: { in: retirees.map((a) => a.id) } }, data: { statut: "RETIRE" } });
  }
  // Une candidature de groupe est tout ou rien : le reste du groupe se retire aussi de ces raids.
  for (const a of retirees.filter((a) => a.escouadeId)) {
    await tx.inscription.updateMany({
      where: {
        escouadeId: a.escouadeId,
        statut: { in: [...STATUTS_EN_ATTENTE] },
        place: { annonceId: a.place.annonceId },
      },
      data: { statut: "RETIRE" },
    });
  }
}

export async function accepter(form: FormData) {
  const inscription = await candidaturePourRl(form);
  const d = await dicoCourant();
  const { annonce } = inscription.place;
  const retour = retourVers(annonce.id);

  if (!rlPeutAgir(annonce)) retour(d.erreur.plusModifiable);
  if (!(STATUTS_EN_ATTENTE as readonly string[]).includes(inscription.statut)) retour(d.erreur.plusEnAttente);
  if (inscription.escouadeId) retour(d.erreur.candidatureDeGroupe);
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

    await apresConfirmation(tx, annonce, [inscription.utilisateurId]);
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
  if (inscription.escouadeId) retour(d.erreur.candidatureDeGroupe);
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
    if (!etaitConvie && inscription.escouadeId) {
      // Candidature de groupe (tout ou rien) : si un membre se retire, le groupe entier se retire.
      await tx.inscription.updateMany({
        where: {
          escouadeId: inscription.escouadeId,
          statut: { in: [...STATUTS_EN_ATTENTE] },
          place: { annonceId: annonce.id },
        },
        data: { statut: "RETIRE" },
      });
    }
    if (!etaitConvie) return;
    if (await rouvrirPlace(tx, annonce, inscription.placeId)) {
      await tx.notification.create({
        data: { utilisateurId: annonce.createurId, type: "DESISTEMENT", annonceId: annonce.id },
      });
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

type AnnonceAvecPlaces = Prisma.AnnonceGetPayload<{ include: { places: true } }>;

/**
 * Candidature d'un groupe d'amis, tout ou rien : chaque membre avec son personnage et ses
 * rôles du groupe. S'il y a assez de places ouvertes pour tous en même temps, le groupe est
 * candidat ; sinon il passe entier en liste d'attente. Refusée si un seul membre ne convient pas.
 */
async function candidaterEnGroupe(
  utilisateurId: string,
  annonce: AnnonceAvecPlaces,
  escouadeId: string,
  note: string,
  retour: (erreur?: string) => never,
  d: Dico,
) {
  const groupe = await monGroupe(escouadeId, utilisateurId);
  if (!groupe) return retour(d.erreur.groupeIntrouvable);
  const { membres } = groupe;
  if (membres.length < 2) retour(d.erreur.groupeTropPetit);
  if (membres.some((m) => m.utilisateurId === annonce.createurId)) retour(d.erreur.groupeRl);
  if (!accepteCandidatures(annonce)) retour(d.erreur.plusDeCandidatures);
  if (note.length > 80) retour(d.erreur.noteTropLongue);

  // Pour chacun : les rôles du groupe que son personnage peut tenir dans ce raid.
  const candidats = membres.map((m) => {
    if (m.personnage.supprimeLe) retour(d.erreur.groupePersoManquant(m.utilisateur.pseudo));
    const roles = rolesPourRaid(m.personnage, annonce.places, annonce).filter((r) => m.roles.includes(r));
    if (roles.length === 0) retour(d.erreur.pasCesRoles(nomEnJeu(m.personnage)));
    return { membre: m, perso: m.personnage, roles };
  });

  const dejaActif = await db.inscription.findFirst({
    where: {
      utilisateurId: { in: membres.map((m) => m.utilisateurId) },
      statut: { in: [...STATUTS_ACTIFS] },
      place: { annonceId: annonce.id },
    },
    select: { utilisateurId: true },
  });
  if (dejaActif) {
    const pseudo = membres.find((m) => m.utilisateurId === dejaActif.utilisateurId)!.utilisateur.pseudo;
    retour(d.erreur.groupeDejaCandidat(pseudo));
  }
  for (const m of membres) {
    if (await dejaConfirmeAilleurs(m.utilisateurId, annonce)) retour(d.erreur.groupeDejaConfirme(m.utilisateur.pseudo));
  }
  const dejaRefuse = await db.inscription.findFirst({
    where: {
      personnageId: { in: membres.map((m) => m.personnageId) },
      statut: "REFUSE",
      place: { annonceId: annonce.id },
    },
  });
  if (dejaRefuse) retour(d.erreur.groupeDejaRefuse);

  // Assez de places ouvertes pour tout le groupe ? Sinon, tout le groupe en liste d'attente.
  const ouvertes = affecterGroupe(annonce.places, candidats, annonce);
  const placements = ouvertes
    ? ouvertes.map((o) => ({ ...o, statut: "INSCRIT" as const }))
    : candidats.map((c) => {
        const choix = placePourRoles(annonce.places, c.perso, c.roles, annonce);
        if (!choix) return retour(d.erreur.groupeAucunePlace);
        return { place: choix.place, role: choix.role, statut: "LISTE_ATTENTE" as const };
      });

  await db.$transaction(async (tx) => {
    for (const [n, c] of candidats.entries()) {
      const { place, role, statut } = placements[n];
      const candidature = {
        role,
        rolesProposes: c.roles,
        note: note || null,
        statut,
        escouadeId,
        inscritLe: new Date(),
      };
      // Une seule ligne par personnage et par place : une ancienne candidature retirée est réactivée.
      await tx.inscription.upsert({
        where: { placeId_personnageId: { placeId: place.id, personnageId: c.perso.id } },
        update: candidature,
        create: { ...candidature, placeId: place.id, personnageId: c.perso.id, utilisateurId: c.membre.utilisateurId },
      });
    }
    await tx.notification.createMany({
      data: [
        { utilisateurId: annonce.createurId, type: "NOUVELLE_CANDIDATURE" as const, annonceId: annonce.id },
        ...membres
          .filter((m) => m.utilisateurId !== utilisateurId)
          .map((m) => ({ utilisateurId: m.utilisateurId, type: "CANDIDATURE_GROUPE" as const, annonceId: annonce.id })),
      ],
    });
  });
}

/** Les candidatures en attente d'un groupe sur un raid du RL connecté. */
async function candidatureDeGroupePourRl(form: FormData) {
  const utilisateur = await exigerUtilisateur();
  const annonce = await db.annonce.findFirst({
    where: { id: String(form.get("annonceId") ?? ""), createurId: utilisateur.id },
  });
  if (!annonce) notFound();
  const inscriptions = await db.inscription.findMany({
    where: {
      escouadeId: String(form.get("escouadeId") ?? ""),
      statut: { in: [...STATUTS_EN_ATTENTE] },
      place: { annonceId: annonce.id },
    },
    include: { personnage: true },
  });
  return { annonce, inscriptions };
}

/** Le RL accepte tout le groupe, chacun avec le rôle choisi, sur des places ouvertes distinctes. */
export async function accepterGroupe(form: FormData) {
  const { annonce, inscriptions } = await candidatureDeGroupePourRl(form);
  const d = await dicoCourant();
  const retour = retourVers(annonce.id);
  if (!rlPeutAgir(annonce)) retour(d.erreur.plusModifiable);
  if (inscriptions.length === 0 || inscriptions.some((i) => !i.personnage)) retour(d.erreur.plusEnAttente);
  const choix = inscriptions.map((i) => ({ i, role: String(form.get(`role.${i.id}`) ?? "") as Role }));
  if (choix.some((c) => !rolesProposes(c.i).includes(c.role))) retour(d.erreur.rolePasPropose);
  for (const { i } of choix) {
    if (await dejaConfirmeAilleurs(i.utilisateurId, annonce)) retour(d.erreur.joueurDejaConfirme);
  }

  let erreur: string | null = null;
  try {
    await db.$transaction(async (tx) => {
      const places = await tx.place.findMany({ where: { annonceId: annonce.id } });
      const affectation = affecterGroupe(
        places,
        choix.map((c) => ({ perso: c.i.personnage!, roles: [c.role], preferee: c.i.placeId })),
        annonce,
      );
      if (!affectation) throw new ErreurFormulaire((d) => d.erreur.groupePasAssezOuvertes);
      for (const [n, { i, role }] of choix.entries()) {
        const place = affectation[n].place;
        await tx.inscription.update({ where: { id: i.id }, data: { statut: "CONFIRME", placeId: place.id, role } });
        await tx.place.update({ where: { id: place.id }, data: { statut: "POURVUE" } });
      }
      await tx.notification.createMany({
        data: inscriptions.map((i) => ({
          utilisateurId: i.utilisateurId,
          type: "CANDIDATURE_ACCEPTEE" as const,
          annonceId: annonce.id,
        })),
      });
      await apresConfirmation(
        tx,
        annonce,
        inscriptions.map((i) => i.utilisateurId),
      );
    });
  } catch (e) {
    erreur = messageErreur(e, d);
  }
  if (erreur) retour(erreur);
  for (const i of inscriptions) prevenirEnMp(i.id, "CANDIDATURE_ACCEPTEE");
  rafraichir(annonce.id);
  retour();
}

/** Le RL refuse tout le groupe. */
export async function refuserGroupe(form: FormData) {
  const { annonce, inscriptions } = await candidatureDeGroupePourRl(form);
  const d = await dicoCourant();
  const retour = retourVers(annonce.id);
  if (!rlPeutAgir(annonce)) retour(d.erreur.plusModifiable);
  if (inscriptions.length === 0) retour(d.erreur.plusEnAttente);
  await db.$transaction([
    db.inscription.updateMany({ where: { id: { in: inscriptions.map((i) => i.id) } }, data: { statut: "REFUSE" } }),
    db.notification.createMany({
      data: inscriptions.map((i) => ({
        utilisateurId: i.utilisateurId,
        type: "CANDIDATURE_REFUSEE" as const,
        annonceId: annonce.id,
      })),
    }),
  ]);
  for (const i of inscriptions) prevenirEnMp(i.id, "CANDIDATURE_REFUSEE");
  rafraichir(annonce.id);
  retour();
}

/**
 * Un joueur convié quitte sa place (désistement ou retrait par le RL). Un remplaçant sur
 * la même place devient titulaire ; sinon la place se rouvre, le raid n'est plus complet, et
 * les joueurs en liste d'attente qui peuvent la prendre redeviennent candidats.
 * Renvoie true si la place s'est rouverte.
 */
async function rouvrirPlace(
  tx: Transaction,
  annonce: { id: string; faction: Faction; ruleset: Ruleset; region: Region; niveauMin: number | null },
  placeId: string,
) {
  const remplacant = await tx.inscription.findFirst({ where: { placeId, statut: "CONFIRME" } });
  if (remplacant) return false;
  await tx.place.update({ where: { id: placeId }, data: { statut: "OUVERTE" } });
  await tx.annonce.updateMany({ where: { id: annonce.id, statut: "COMPLETE" }, data: { statut: "PUBLIEE" } });
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
  return true;
}

/**
 * Le RL retire un joueur convié. Le joueur est prévenu ; à moins de 2 h du début,
 * le retrait compte contre la fiabilité du RL (voir fiabiliteRls).
 */
export async function retirerJoueur(form: FormData) {
  const inscription = await candidaturePourRl(form);
  const d = await dicoCourant();
  const { annonce } = inscription.place;
  const retour = retourVers(annonce.id);
  if (!rlPeutAgir(annonce)) retour(d.erreur.plusModifiable);
  if (inscription.statut !== "CONFIRME") retour(d.erreur.plusConvie);

  await db.$transaction(async (tx) => {
    // Le filtre sur le statut évite un double retrait simultané.
    const retire = await tx.inscription.updateMany({
      where: { id: inscription.id, statut: "CONFIRME" },
      data: { statut: "RETIRE", retireParRlLe: new Date() },
    });
    if (retire.count === 0) return;
    await tx.notification.create({
      data: { utilisateurId: inscription.utilisateurId, type: "RETIRE_PAR_RL", annonceId: annonce.id },
    });
    await rouvrirPlace(tx, annonce, inscription.placeId);
  });
  prevenirEnMp(inscription.id, "RETIRE_PAR_RL");
  rafraichir(annonce.id);
  retour();
}

/** Le RL écrit à un joueur de son raid (candidat ou convié) : le bot le lui envoie en MP Discord. */
export async function envoyerMessage(form: FormData) {
  const inscription = await candidaturePourRl(form);
  const d = await dicoCourant();
  const { annonce } = inscription.place;
  const retour = retourVers(annonce.id);
  if (!estActive(inscription.statut)) retour(d.erreur.plusInscrit);
  const texte = String(form.get("texte") ?? "")
    .trim()
    .slice(0, 500);
  if (!texte) retour(d.erreur.messageVide);

  const [rl, joueur] = await Promise.all([
    db.utilisateur.findUniqueOrThrow({ where: { id: annonce.createurId }, select: { pseudo: true } }),
    db.utilisateur.findUniqueOrThrow({
      where: { id: inscription.utilisateurId },
      select: { discordId: true, langueSite: true },
    }),
  ]);
  // Dans la langue du joueur ; le texte du RL est envoyé tel quel (sans mention possible).
  const dj = dico(joueur.langueSite);
  const envoye = await envoyerMp(
    joueur.discordId,
    carteRaid({ annonce, d: dj, titre: dj.retrait.carteTitre(rl.pseudo), couleur: COULEUR_OR, description: texte }),
  );
  if (!envoye) retour(d.retrait.echec);
  redirect(`/annonces/${annonce.id}?info=message`);
}
