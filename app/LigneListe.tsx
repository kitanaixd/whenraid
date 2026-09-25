import Link from "next/link";
import type { ReactNode } from "react";
import type { Dico } from "@/lib/i18n";
import { afficherDate, afficherDateCourte } from "@/lib/dates";
import { nomRaid } from "@/lib/raids";
import { resumeLigneRaid, type AnnonceLigne } from "@/lib/ligneRaid";
import { ClasseIcone, RoleIcone } from "./ClasseIcone";
import { GroupeInscrit, type Marque } from "./LigneRaid";

/** En-tête des colonnes de la vue « liste ». */
export function EnteteListe({ d }: { d: Dico }) {
  const c = d.accueil.colonnes;
  return (
    <li className="ligne-liste entete-liste" aria-hidden="true">
      <span>{c.date}</span>
      <span>{c.raid}</span>
      <span>{c.statut}</span>
      <span>{c.compo}</span>
      <span>{c.recherche}</span>
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
  const classes = r.classesRecherchees.slice(0, 3);
  const enPlus = r.classesRecherchees.length - classes.length;

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
        <span className="doux">
          {a.titre && `${nom} · `}
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
        ) : r.placeLibre && classes.length === 0 ? (
          <span className="pastille">{d.commun.toutesClasses}</span>
        ) : (
          <>
            {classes.map((c) => (
              <ClasseIcone key={c} classe={c} taille={20} />
            ))}
            {enPlus > 0 && <span className="classes-en-plus">+{enPlus}</span>}
          </>
        )}
      </span>
      <span className="liste-action">{action}</span>
    </li>
  );
}
