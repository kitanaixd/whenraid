import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { Personnage, Place } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { exigerUtilisateur } from "@/lib/session";
import { afficherDate } from "@/lib/dates";
import { raids } from "@/lib/raids";
import {
  libelleClasse,
  libelleFaction,
  libelleReglesLoot,
  libelleRole,
  libelleRuleset,
  libelleStatutAnnonce,
  libelleStatutInscription,
  libelleStatutPlace,
} from "@/lib/libelles";

// Une inscription « active » occupe le joueur sur ce raid.
const STATUTS_ACTIFS = ["INSCRIT", "LISTE_ATTENTE", "CONFIRME"] as const;

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
    .find((i) => i.utilisateurId === utilisateur.id && (STATUTS_ACTIFS as readonly string[]).includes(i.statut));
  const inscriptionsOuvertes = accepteInscriptions(annonce);
  const toutesClasses = Object.keys(libelleClasse).length;

  return (
    <main>
      <p>
        <Link href="/">← Accueil</Link>
      </p>
      <h1>{raids[annonce.contenu].nom}</h1>
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
        {annonce.vocalRequis && <li>Vocal obligatoire</li>}
        <li>
          Organisé par {estOrganisateur ? "toi" : annonce.createur.pseudo} — {libelleStatutAnnonce[annonce.statut]}
        </li>
      </ul>

      {typeof erreur === "string" && <p role="alert">⚠ {erreur}</p>}
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
