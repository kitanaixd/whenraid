import Link from "next/link";
import type { ReactNode } from "react";
import type { Dico } from "@/lib/i18n";
import { afficherDate, afficherDateCourte } from "@/lib/dates";
import { nomRaid } from "@/lib/raids";
import { resumeLigneRaid, type AnnonceLigne } from "@/lib/ligneRaid";
import type { Classe } from "@/generated/prisma/enums";
import { ClasseIcone, RoleIcone } from "./ClasseIcone";

/**
 * Comment la ligne se distingue : raid que j'organise, où je suis convié, candidat ou en attente.
 * `texte` : étiquette courte ; `perso` : le personnage inscrit ; `groupe` : le groupe avec lequel
 * il a candidaté (à la place du personnage) ; `detail` : complément (ex. candidatures reçues).
 */
export type Marque = {
  type: "organise" | "convie" | "candidat" | "attente";
  texte: string;
  perso?: { classe: Classe; nom: string };
  groupe?: { nom: string; classes: Classe[] };
  detail?: string;
};

/** Le groupe inscrit : les icônes de classe des membres, superposées, puis son nom. */
export function GroupeInscrit({ groupe }: { groupe: { nom: string; classes: Classe[] } }) {
  return (
    <span className="perso-inscrit groupe-inscrit" title={groupe.nom}>
      <span className="groupe-icones">
        {groupe.classes.map((c, n) => (
          <ClasseIcone key={n} classe={c} taille={20} />
        ))}
      </span>
      <span>{groupe.nom}</span>
    </span>
  );
}

/** En-tête des colonnes de la vue « liste » ; « Date » et « Compo » trient la liste. */
export function EnteteListe({
  d,
  tri,
  lienDate,
  lienRoster,
}: {
  d: Dico;
  tri: "date" | "roster";
  lienDate: string;
  lienRoster: string;
}) {
  const c = d.accueil.colonnes;
  return (
    <li className="ligne-liste entete-liste">
      <Link href={lienDate} className={tri === "date" ? "actif" : undefined} aria-label={d.accueil.tri.date}>
        {c.date} {tri === "date" && "↑"}
      </Link>
      <span aria-hidden="true">{c.raid}</span>
      <span aria-hidden="true">{c.statut}</span>
      <Link href={lienRoster} className={tri === "roster" ? "actif" : undefined} aria-label={d.accueil.tri.roster}>
        {c.compo} {tri === "roster" && "↓"}
      </Link>
      <span aria-hidden="true">{c.recherche}</span>
      <span />
    </li>
  );
}

/**
 * Un raid sur une ligne fine (vue « liste ») : date, raid, statut, compo, classes recherchées
 * et action, en colonnes alignées d'une ligne à l'autre. Toute la ligne mène au raid.
 */
export function LigneListe({
  annonce: a,
  fuseau,
  lien,
  d,
  marque,
  auteur,
  action,
  bulleCandidatures = false,
}: {
  annonce: AnnonceLigne;
  fuseau: string;
  lien: string;
  d: Dico;
  marque?: Marque;
  auteur?: ReactNode;
  action?: ReactNode;
  bulleCandidatures?: boolean;
}) {
  const r = resumeLigneRaid(a);
  const nom = nomRaid(a.contenu, d);
  const titre = a.titre ?? nom;
  const [jour, heure] = afficherDateCourte(a.debutUtc, fuseau).split(" · ");
  // Classes puis rôles demandés (seulement quand il ne reste plus de place ouverte à tous).
  const demandes = [
    ...r.classesRecherchees.map((c) => ({ cle: c, icone: <ClasseIcone classe={c} taille={20} /> })),
    ...r.rolesRecherches.map((ro) => ({ cle: ro, icone: <RoleIcone role={ro} taille={20} /> })),
  ];
  const visibles = demandes.slice(0, 3);
  const enPlus = demandes.length - visibles.length;

  return (
    <li className={`ligne-liste ${marque ? `ligne-${marque.type}` : ""}`}>
      <Link href={lien} className="ligne-liste-lien" aria-label={`${titre}, ${afficherDate(a.debutUtc, fuseau, d)}`} />
      <span className="liste-date">
        <strong>{jour}</strong>
        <span className="doux">{heure}</span>
      </span>
      <span className="liste-raid">
        <strong>
          {titre}
          {bulleCandidatures && r.enAttente > 0 && (
            <span className="bulle-liste" title={d.accueil.candidatures(r.enAttente)}>
              {r.enAttente}
            </span>
          )}
        </strong>
        <span className="doux liste-raid-detail">
          <span className="liste-nom">{nom} ·</span>
          {auteur}
        </span>
      </span>
      <span className="liste-statut">
        {marque && (
          <>
            <span className={`badge-raid badge-raid-${marque.type}`}>{marque.texte}</span>
            {marque.groupe ? (
              <GroupeInscrit groupe={marque.groupe} />
            ) : (
              marque.perso && <ClasseIcone classe={marque.perso.classe} taille={20} />
            )}
          </>
        )}
      </span>
      <span className="liste-compo" title={d.accueil.compoTitre}>
        <span aria-label={d.accueil.tanks(r.roles.tanks)}>
          <RoleIcone role="TANK" taille={16} /> {r.roles.tanks}
        </span>
        <span aria-label={d.accueil.soigneurs(r.roles.soigneurs)}>
          <RoleIcone role="SOIGNEUR" taille={16} /> {r.roles.soigneurs}
        </span>
        <span aria-label={d.accueil.dps(r.roles.dps)}>
          <RoleIcone role="DPS" taille={16} /> {r.roles.dps}
        </span>
        <strong>
          {r.total}/{a.taille}
        </strong>
      </span>
      <span className="liste-recherche" aria-label={d.accueil.classesRecherchees}>
        {a.statut === "COMPLETE" ? (
          <span className="pastille complet">{d.accueil.complet}</span>
        ) : r.placeLibre ? (
          <span className="pastille">{d.commun.toutesClasses}</span>
        ) : (
          <>
            {visibles.map((x) => (
              <span key={x.cle}>{x.icone}</span>
            ))}
            {enPlus > 0 && <span className="classes-en-plus">+{enPlus}</span>}
          </>
        )}
      </span>
      <span className="liste-action">{action}</span>
    </li>
  );
}
