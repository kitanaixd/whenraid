import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { Classe } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { exigerUtilisateur } from "@/lib/session";
import { heureLocale, jourLocal, localVersUtc } from "@/lib/dates";
import { nomRaid, raids } from "@/lib/raids";
import { estComplet, STATUTS_EN_ATTENTE } from "@/lib/annonces";
import { placePourRoles, rolesProposes } from "@/lib/eligibilite";
import { prevenirEnMp } from "@/lib/prevenir";
import { BoutonEnvoi } from "@/app/BoutonEnvoi";
import { ErreurFormulaire, messageErreur } from "@/lib/formulaire";
import { dicoCourant, langueCourante } from "@/lib/langue";
import { ChampsOrganisation, ChampTitre, lireCompoEtBesoins, lireOrganisation } from "../../organisation";
import { type Besoin, ChoixCompo } from "../../nouvelle/ChoixCompo";

const TOUTES_LES_CLASSES = Object.keys(Classe).length;

/** Un raid que l'utilisateur organise et qui peut encore être modifié (ni annulé, ni clôturé). */
async function monRaidModifiable(annonceId: string, utilisateurId: string) {
  return db.annonce.findFirst({
    where: { id: annonceId, createurId: utilisateurId, statut: { in: ["PUBLIEE", "COMPLETE"] } },
    include: { composition: true, places: true },
  });
}

/**
 * Remplace la compo et les places ouvertes du raid. Les places pourvues (joueurs
 * acceptés) ne bougent pas ; les places ouvertes en trop sont annulées (l'historique
 * des candidatures reste). Chaque candidat en attente est replacé sur une place qui
 * lui convient encore, sinon refusé. Renvoie les candidatures refusées.
 */
async function remplacerCompo(tx: Prisma.TransactionClient, annonceId: string, form: FormData) {
  const annonce = await tx.annonce.findUniqueOrThrow({
    where: { id: annonceId },
    include: {
      places: {
        include: { inscriptions: { select: { id: true, personnageId: true, statut: true } } },
        orderBy: { id: "asc" },
      },
    },
  });
  const pourvues = annonce.places.filter((p) => p.statut === "POURVUE");
  const disponibles = raids[annonce.contenu].taille - pourvues.length;
  // Compo pleine seulement s'il reste des joueurs acceptés : sinon le raid n'aurait aucune place.
  const { composition, places } = lireCompoEtBesoins(form, disponibles, { pleinAutorise: pourvues.length > 0 });

  await tx.compositionAnnonce.deleteMany({ where: { annonceId } });
  await tx.compositionAnnonce.createMany({ data: composition.map((c) => ({ annonceId, ...c })) });

  // Les places ouvertes (puis annulées) sont réutilisées avant d'en créer de nouvelles.
  const reutilisables = [
    ...annonce.places.filter((p) => p.statut === "OUVERTE"),
    ...annonce.places.filter((p) => p.statut === "ANNULEE"),
  ];
  for (const [n, spec] of places.entries()) {
    const existante = reutilisables[n];
    if (existante) {
      await tx.place.update({ where: { id: existante.id }, data: { ...spec, statut: "OUVERTE" } });
    } else {
      await tx.place.create({ data: { annonceId, ...spec } });
    }
  }
  const enTrop = reutilisables.slice(places.length).map((p) => p.id);
  if (enTrop.length > 0) {
    await tx.place.updateMany({ where: { id: { in: enTrop } }, data: { statut: "ANNULEE" } });
  }

  // Replacement des candidats en attente, en évitant une place où leur personnage a déjà une ligne.
  const placesApres = await tx.place.findMany({ where: { annonceId } });
  const occupees = new Set(
    annonce.places.flatMap((p) => p.inscriptions.filter((i) => i.personnageId).map((i) => `${p.id}.${i.personnageId}`)),
  );
  const enAttente = await tx.inscription.findMany({
    where: { place: { annonceId }, statut: { in: [...STATUTS_EN_ATTENTE] } },
    include: { personnage: true },
    orderBy: { inscritLe: "asc" },
  });
  const refusees: string[] = [];
  for (const i of enAttente) {
    const actuelle = placesApres.find((p) => p.id === i.placeId)!;
    if (!i.personnage) {
      // Groupe : il reste sur sa place si elle existe encore.
      if (actuelle.statut === "ANNULEE") refusees.push(i.id);
      continue;
    }
    const libres = placesApres.filter((p) => p.id === i.placeId || !occupees.has(`${p.id}.${i.personnageId}`));
    const choix = placePourRoles(libres, i.personnage, rolesProposes(i), annonce, i.placeId);
    if (!choix) {
      refusees.push(i.id);
      continue;
    }
    occupees.delete(`${i.placeId}.${i.personnageId}`);
    occupees.add(`${choix.place.id}.${i.personnageId}`);
    await tx.inscription.update({
      where: { id: i.id },
      data: { placeId: choix.place.id, role: choix.role, statut: choix.ouverte ? "INSCRIT" : "LISTE_ATTENTE" },
    });
  }
  if (refusees.length > 0) {
    await tx.inscription.updateMany({ where: { id: { in: refusees } }, data: { statut: "REFUSE" } });
    await tx.notification.createMany({
      data: enAttente
        .filter((i) => refusees.includes(i.id))
        .map((i) => ({ utilisateurId: i.utilisateurId, type: "CANDIDATURE_REFUSEE" as const, annonceId })),
    });
  }

  const statut = estComplet(placesApres) ? "COMPLETE" : "PUBLIEE";
  return { statut, refusees } as const;
}

async function modifierAnnonce(form: FormData) {
  "use server";
  const utilisateur = await exigerUtilisateur();
  const annonce = await monRaidModifiable(String(form.get("annonceId") ?? ""), utilisateur.id);
  if (!annonce) notFound();

  let erreur: string | null = null;
  let refusees: string[] = [];
  try {
    const debutUtc = localVersUtc(
      String(form.get("date") ?? ""),
      String(form.get("heure") ?? ""),
      utilisateur.fuseauHoraire,
    );
    if (!debutUtc) throw new ErreurFormulaire((d) => d.erreur.dateInvalide);
    // Une nouvelle date doit être dans le futur ; garder la date actuelle reste toujours possible.
    if (debutUtc.getTime() !== annonce.debutUtc.getTime() && debutUtc.getTime() <= Date.now()) {
      throw new ErreurFormulaire((d) => d.erreur.datePassee);
    }
    const organisation = lireOrganisation(form);
    try {
      refusees = await db.$transaction(async (tx) => {
        await tx.annonce.update({ where: { id: annonce.id }, data: { debutUtc, ...organisation } });
        const resultat = await remplacerCompo(tx, annonce.id, form);
        await tx.annonce.update({ where: { id: annonce.id }, data: { statut: resultat.statut } });
        return resultat.refusees;
      });
    } catch (e) {
      // Le même raid existe déjà à cette date (index unique des raids actifs du RL).
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new ErreurFormulaire((d) => d.edition.doublon);
      }
      throw e;
    }
  } catch (e) {
    erreur = messageErreur(e, await dicoCourant());
  }

  if (erreur) redirect(`/annonces/${annonce.id}/modifier?erreur=${encodeURIComponent(erreur)}`);
  for (const id of refusees) prevenirEnMp(id, "CANDIDATURE_REFUSEE");
  revalidatePath(`/annonces/${annonce.id}`);
  revalidatePath("/");
  redirect(`/annonces/${annonce.id}`);
}

export default async function PageModifierAnnonce({ params, searchParams }: PageProps<"/annonces/[id]/modifier">) {
  const utilisateur = await exigerUtilisateur();
  const [d, langue] = await Promise.all([dicoCourant(), langueCourante()]);
  const { id } = await params;
  const { erreur } = await searchParams;
  const annonce = await monRaidModifiable(id, utilisateur.id);
  if (!annonce) notFound();
  const fuseau = utilisateur.fuseauHoraire;

  // Pré-remplissage : la compo déclarée, et les besoins précis regroupés depuis les places ouvertes
  // (les places « toute classe, tout rôle » sont le reste libre, pas un besoin).
  const compoInitiale = Object.fromEntries(annonce.composition.map((c) => [`${c.classe}.${c.role}`, c.nombre]));
  const besoins = new Map<string, Besoin>();
  for (const p of annonce.places) {
    if (p.statut !== "OUVERTE") continue;
    const classe = p.classesAcceptees.length >= TOUTES_LES_CLASSES ? "" : (p.classesAcceptees[0] ?? "");
    const role = p.role ?? "";
    if (!classe && !role) continue;
    const cle = `${classe}.${role}`;
    const b = besoins.get(cle) ?? { classe, role, nombre: 0 };
    besoins.set(cle, { ...b, nombre: b.nombre + 1 });
  }
  const dejaPris = annonce.places.filter((p) => p.statut === "POURVUE").length;

  return (
    <main>
      <p>
        <Link href={`/annonces/${annonce.id}`}>{d.edition.retour}</Link>
      </p>
      <h1>{d.edition.titre}</h1>
      <p className="doux">
        {annonce.titre ? `${annonce.titre} · ` : ""}
        {nomRaid(annonce.contenu, d)}
      </p>
      {typeof erreur === "string" && (
        <p className="avertissement grave" role="alert">
          ⚠ {erreur}
        </p>
      )}
      <p className="encadre">{d.edition.aide}</p>
      <form action={modifierAnnonce} className="formulaire">
        <input type="hidden" name="annonceId" value={annonce.id} />
        <div className="rangee">
          <ChampTitre d={d} valeur={annonce.titre} />
        </div>
        <div className="rangee rangee-raid">
          <label className="champ">
            {d.creation.date}
            <input type="date" name="date" required defaultValue={jourLocal(annonce.debutUtc, fuseau)} />
          </label>
          <label className="champ">
            <span>
              {d.creation.heure} <small className="fuseau">({fuseau})</small>
            </span>
            <input type="time" name="heure" required defaultValue={heureLocale(annonce.debutUtc, fuseau)} />
          </label>
          <label className="champ">
            {d.champ.duree}
            <select name="dureeHeures" defaultValue={annonce.dureeEstimee ? String(annonce.dureeEstimee / 60) : "3"}>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((h) => (
                <option key={h} value={h}>
                  {h} h
                </option>
              ))}
            </select>
          </label>
        </div>
        <ChoixCompo
          fuseau={fuseau}
          entete={false}
          contenuInitial={annonce.contenu}
          compoInitiale={compoInitiale}
          besoinsInitiaux={[...besoins.values()]}
          dejaPris={dejaPris}
        />
        <ChampsOrganisation d={d} langueParDefaut={langue} annonce={annonce} />
        <div className="actions-rl">
          <BoutonEnvoi className="principal" enCours={d.commun.enregistrement}>
            {d.edition.enregistrer}
          </BoutonEnvoi>
          <Link href={`/annonces/${annonce.id}`} className="bouton">
            {d.edition.annuler}
          </Link>
        </div>
      </form>
    </main>
  );
}
