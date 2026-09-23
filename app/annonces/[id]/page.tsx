import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { Personnage, Place } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { exigerUtilisateur } from "@/lib/session";
import { afficherDate } from "@/lib/dates";
import { nomRaid } from "@/lib/raids";
import { estActive, estComplet, STATUTS_ACTIFS } from "@/lib/annonces";
import { BoutonAnnuler } from "./BoutonAnnuler";
import {
  libelleClasse,
  libelleFaction,
  libelleReglesLoot,
  libelleRole,
  libelleRuleset,
  libelleStatutAnnonce,
  libelleStatutInscription,
  libelleStatutPlace,
  libelleVocal,
} from "@/lib/libelles";

type AnnoncePourEligibilite = { faction: string; ruleset: string; region: string; niveauMin: number | null };

function estEligible(perso: Personnage, place: Place, annonce: AnnoncePourEligibilite) {
  return (
    perso.faction === annonce.faction &&
    perso.ruleset === annonce.ruleset &&
    perso.region === annonce.region &&
    place.classesAcceptees.includes(perso.classe) &&
    perso.rolesJouables.includes(place.role) &&
    perso.niveau >= (annonce.niveauMin ?? 1)
  );
}

function accepteInscriptions(annonce: { statut: string; debutUtc: Date }) {
  return annonce.statut === "PUBLIEE" && annonce.debutUtc.getTime() > Date.now();
}

function peutEtreAnnulee(annonce: { statut: string; debutUtc: Date }) {
  return ["PUBLIEE", "COMPLETE"].includes(annonce.statut) && annonce.debutUtc.getTime() > Date.now();
}

async function annulerAnnonce(form: FormData) {
  "use server";
  const utilisateur = await exigerUtilisateur();
  const annonceId = String(form.get("annonceId") ?? "");
  const retour = (erreur?: string) =>
    redirect(`/annonces/${annonceId}${erreur ? `?erreur=${encodeURIComponent(erreur)}` : ""}`);

  if (form.get("confirmation") !== "on") retour("Coche la case de confirmation pour annuler le raid.");

  const annonce = await db.annonce.findFirst({
    where: { id: annonceId, createurId: utilisateur.id },
    include: { places: { include: { inscriptions: { select: { statut: true } } } } },
  });
  if (!annonce) notFound();
  if (!peutEtreAnnulee(annonce)) retour("Ce raid ne peut plus être annulé.");

  // On enregistre les faits ; la réputation se calculera à la lecture (règle 3).
  // Le filtre sur le statut évite une double annulation simultanée.
  await db.annonce.updateMany({
    where: { id: annonce.id, statut: { in: ["PUBLIEE", "COMPLETE"] } },
    data: { statut: "ANNULEE", annuleeLe: new Date(), annuleeComplete: estComplet(annonce.places) },
  });
  revalidatePath(`/annonces/${annonce.id}`);
  revalidatePath("/");
  retour();
}

async function sInscrire(form: FormData) {
  "use server";
  const utilisateur = await exigerUtilisateur();
  const placeId = String(form.get("placeId") ?? "");
  const personnageId = String(form.get("personnageId") ?? "");

  const place = await db.place.findUnique({ where: { id: placeId }, include: { annonce: true } });
  if (!place) notFound();
  const { annonce } = place;
  const retour = (erreur?: string) =>
    redirect(`/annonces/${annonce.id}${erreur ? `?erreur=${encodeURIComponent(erreur)}` : ""}`);

  const personnage = await db.personnage.findFirst({ where: { id: personnageId, utilisateurId: utilisateur.id } });

  if (annonce.createurId === utilisateur.id) retour("Tu organises ce raid, tu ne peux pas t'y inscrire.");
  if (!accepteInscriptions(annonce)) retour("Ce raid n'accepte plus d'inscriptions.");
  if (place.statut !== "OUVERTE") retour("Cette place n'est plus ouverte.");
  if (!personnage || !estEligible(personnage, place, annonce)) retour("Ce personnage ne correspond pas à cette place.");

  const dejaInscrit = await db.inscription.findFirst({
    where: { utilisateurId: utilisateur.id, statut: { in: [...STATUTS_ACTIFS] }, place: { annonceId: annonce.id } },
  });
  if (dejaInscrit) retour("Tu es déjà inscrit sur ce raid.");

  await db.inscription.create({
    data: { placeId: place.id, personnageId: personnage!.id, utilisateurId: utilisateur.id },
  });
  revalidatePath(`/annonces/${annonce.id}`);
  retour();
}

export default async function PageAnnonce({ params, searchParams }: PageProps<"/annonces/[id]">) {
  const utilisateur = await exigerUtilisateur();
  const { id } = await params;
  const { erreur } = await searchParams;

  const annonce = await db.annonce.findUnique({
    where: { id },
    include: {
      createur: { select: { pseudo: true } },
      places: {
        orderBy: { role: "asc" },
        include: {
          inscriptions: {
            orderBy: { inscritLe: "asc" },
            include: {
              personnage: true,
              utilisateur: { select: { id: true, pseudo: true } },
            },
          },
        },
      },
    },
  });
  if (!annonce) notFound();

  const estOrganisateur = annonce.createurId === utilisateur.id;
  const mesPersonnages = estOrganisateur
    ? []
    : await db.personnage.findMany({ where: { utilisateurId: utilisateur.id }, orderBy: { nom: "asc" } });
  const monInscription = annonce.places
    .flatMap((p) => p.inscriptions.map((i) => ({ ...i, place: p })))
    .find((i) => i.utilisateurId === utilisateur.id && estActive(i.statut));
  const inscriptionsOuvertes = accepteInscriptions(annonce);
  const toutesClasses = Object.keys(libelleClasse).length;
  const nbInscrits = annonce.places.flatMap((p) => p.inscriptions).filter((i) => estActive(i.statut)).length;
  const annulable = estOrganisateur && peutEtreAnnulee(annonce);

  return (
    <main>
      <p>
        <Link href="/">← Accueil</Link>
      </p>
      <h1>{nomRaid(annonce.contenu)}</h1>
      <p>
        <strong>{afficherDate(annonce.debutUtc, utilisateur.fuseauHoraire)}</strong>
        {annonce.dureeEstimee && ` — environ ${annonce.dureeEstimee / 60} h`}
      </p>
      <ul>
        <li>
          {libelleFaction[annonce.faction]}, {libelleRuleset[annonce.ruleset]} {annonce.region}, raid à{" "}
          {annonce.taille}
        </li>
        <li>Loot : {libelleReglesLoot[annonce.reglesLoot]}</li>
        {annonce.niveauMin && <li>Niveau minimum : {annonce.niveauMin}</li>}
        {annonce.langueRequise && <li>Langue : {annonce.langueRequise === "fr" ? "français" : "anglais"}</li>}
        <li>Vocal : {libelleVocal[annonce.vocal]}</li>
        <li>
          Organisé par {estOrganisateur ? "toi" : annonce.createur.pseudo} — {libelleStatutAnnonce[annonce.statut]}
        </li>
      </ul>

      {annonce.statut === "ANNULEE" && (
        <p className="avertissement grave" role="status">
          Ce raid a été annulé
          {annonce.annuleeLe && ` le ${afficherDate(annonce.annuleeLe, utilisateur.fuseauHoraire)}`}.
        </p>
      )}
      {typeof erreur === "string" && <p role="alert">⚠ {erreur}</p>}

      {estOrganisateur && (
        <section>
          <h2>Espace RL</h2>
          {annonce.vocal === "DISCORD" && <p>Lien Discord : {annonce.vocalDiscordLien}</p>}
          {annonce.vocal === "TEAMSPEAK" && (
            <p>
              TeamSpeak : {annonce.vocalTsAdresse}
              {annonce.vocalTsMotDePasse && ` — mot de passe : ${annonce.vocalTsMotDePasse}`}
            </p>
          )}
          {annonce.vocal !== "AUCUN" && (
            <p>
              <small>Ces identifiants ne sont visibles que par toi. L&apos;addon les enverra aux joueurs en jeu.</small>
            </p>
          )}
          {annulable && (
            <BoutonAnnuler
              action={annulerAnnonce}
              annonceId={annonce.id}
              resume={`${nomRaid(annonce.contenu)} — ${afficherDate(annonce.debutUtc, utilisateur.fuseauHoraire)}`}
              nbInscrits={nbInscrits}
              estComplet={estComplet(annonce.places)}
            />
          )}
        </section>
      )}
      {monInscription && (
        <p>
          ✔ Tu es inscrit avec <strong>{monInscription.personnage?.nom}</strong> sur une place{" "}
          {libelleRole[monInscription.place.role]} ({libelleStatutInscription[monInscription.statut]}).
        </p>
      )}

      <h2>Places ouvertes</h2>
      <ol>
        {annonce.places.map((place) => {
          const eligibles = mesPersonnages.filter((p) => estEligible(p, place, annonce));
          return (
            <li key={place.id}>
              {libelleRole[place.role]} —{" "}
              {place.classesAcceptees.length === toutesClasses
                ? "toutes classes"
                : place.classesAcceptees.map((c) => libelleClasse[c]).join(", ")}{" "}
              ({libelleStatutPlace[place.statut]}, {place.inscriptions.length} inscrit
              {place.inscriptions.length > 1 ? "s" : ""})
              {estOrganisateur && place.inscriptions.length > 0 && (
                <ul>
                  {place.inscriptions.map((i) => (
                    <li key={i.id}>
                      <strong>{i.utilisateur.pseudo}</strong> avec {i.personnage?.nom} (
                      {i.personnage && libelleClasse[i.personnage.classe]} {i.personnage?.niveau}) —{" "}
                      {libelleStatutInscription[i.statut]}, le {afficherDate(i.inscritLe, utilisateur.fuseauHoraire)}
                    </li>
                  ))}
                </ul>
              )}
              {!estOrganisateur &&
                !monInscription &&
                inscriptionsOuvertes &&
                place.statut === "OUVERTE" &&
                eligibles.length > 0 && (
                  <form action={sInscrire}>
                    <input type="hidden" name="placeId" value={place.id} />
                    <select name="personnageId" aria-label="Personnage">
                      {eligibles.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nom} ({libelleClasse[p.classe]} {p.niveau})
                        </option>
                      ))}
                    </select>{" "}
                    <button type="submit">M&apos;inscrire</button>
                  </form>
                )}
            </li>
          );
        })}
      </ol>
      {!estOrganisateur && !monInscription && mesPersonnages.length === 0 && (
        <p>
          Pour t&apos;inscrire, déclare d&apos;abord <Link href="/personnages">un personnage</Link>.
        </p>
      )}
    </main>
  );
}
