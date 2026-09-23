import Link from "next/link";
import { notFound } from "next/navigation";
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
  libelleStatutPlace,
} from "@/lib/libelles";

export default async function PageAnnonce({ params }: PageProps<"/annonces/[id]">) {
  const utilisateur = await exigerUtilisateur();
  const { id } = await params;

  const annonce = await db.annonce.findUnique({
    where: { id },
    include: {
      createur: { select: { pseudo: true } },
      places: { orderBy: { role: "asc" } },
    },
  });
  if (!annonce) notFound();

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
          Organisé par {annonce.createur.pseudo} — {libelleStatutAnnonce[annonce.statut]}
        </li>
      </ul>

      <h2>Places ouvertes</h2>
      <ol>
        {annonce.places.map((place) => (
          <li key={place.id}>
            {libelleRole[place.role]} —{" "}
            {place.classesAcceptees.length === toutesClasses
              ? "toutes classes"
              : place.classesAcceptees.map((c) => libelleClasse[c]).join(", ")}{" "}
            ({libelleStatutPlace[place.statut]})
          </li>
        ))}
      </ol>
    </main>
  );
}
