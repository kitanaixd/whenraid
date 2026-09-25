import Link from "next/link";
import type { ReactNode } from "react";
import type { Classe } from "@/generated/prisma/enums";
import type { Dico } from "@/lib/i18n";
import { afficherDate, afficherDateCourte } from "@/lib/dates";
import { nomRaid, raids } from "@/lib/raids";
import { resumeLigneRaid, type AnnonceLigne } from "@/lib/ligneRaid";
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

/**
 * Une ligne de raid. Version complète pour la liste des raids, version compacte
 * (moins haute) pour « Tes raids ». `action` : bouton affiché à droite (candidature rapide).
 */
export function LigneRaid({
  annonce: a,
  fuseau,
  lien,
  d,
  compact = false,
  marque,
  auteur,
  action,
  bulleCandidatures = false,
}: {
  annonce: AnnonceLigne;
  fuseau: string;
  lien: string;
  d: Dico;
  compact?: boolean;
  marque?: Marque;
  auteur?: ReactNode;
  action?: ReactNode;
  /** Bulle du nombre de candidatures en attente : seulement sur les raids que l'on organise. */
  bulleCandidatures?: boolean;
}) {
  const r = resumeLigneRaid(a);
  const taille = compact ? 18 : 22;
  // Carte complète : au plus 4 icônes (classes puis rôles demandés), le reste en « +n » (hauteur constante).
  const demandes = [
    ...r.classesRecherchees.map((c) => ({ cle: c, icone: <ClasseIcone classe={c} taille={28} /> })),
    ...r.rolesRecherches.map((ro) => ({ cle: ro, icone: <RoleIcone role={ro} taille={28} /> })),
  ];
  const demandesVisibles = demandes.slice(0, 4);
  const demandesEnPlus = demandes.length - demandesVisibles.length;
  const compo = (
    <div className="compo-roles" title={d.accueil.compoTitre}>
      <span aria-label={d.accueil.tanks(r.roles.tanks)}>
        <RoleIcone role="TANK" taille={taille} /> {r.roles.tanks}
      </span>
      <span aria-label={d.accueil.soigneurs(r.roles.soigneurs)}>
        <RoleIcone role="SOIGNEUR" taille={taille} /> {r.roles.soigneurs}
      </span>
      <span aria-label={d.accueil.dps(r.roles.dps)}>
        <RoleIcone role="DPS" taille={taille} /> {r.roles.dps}
      </span>
      <strong>
        {r.total}/{a.taille}
      </strong>
    </div>
  );
  const badge = marque && (
    <span className="marque-raid">
      <span className={`badge-raid badge-raid-${marque.type}`}>{marque.texte}</span>
      {marque.groupe ? (
        <GroupeInscrit groupe={marque.groupe} />
      ) : (
        marque.perso && (
          <span className="perso-inscrit">
            <ClasseIcone classe={marque.perso.classe} taille={20} />
            <span className="classe" style={{ "--c": `var(--classe-${marque.perso.classe})` } as React.CSSProperties}>
              {marque.perso.nom}
            </span>
          </span>
        )
      )}
      {marque.detail && <span className="doux">{marque.detail}</span>}
    </span>
  );
  const nom = nomRaid(a.contenu, d);
  // Titre donné par le RL s'il y en a un ; le nom du raid passe alors devant la date.
  const titre = a.titre ?? nom;

  return (
    <li
      className={`ligne-raid ${compact ? "compacte" : ""} ${marque ? `ligne-${marque.type}` : ""}`}
      data-fond={raids[a.contenu].image}
    >
      {/* Bulle en haut à droite : nombre de candidatures en attente. */}
      {bulleCandidatures && r.enAttente > 0 && (
        <span className="bulle-candidatures" title={d.accueil.candidatures(r.enAttente)}>
          <span aria-hidden="true">{r.enAttente}</span>
          <span className="sr-only">{d.accueil.candidatures(r.enAttente)}</span>
        </span>
      )}
      <Link href={lien} className="ligne-raid-lien" aria-label={`${titre}, ${afficherDate(a.debutUtc, fuseau, d)}`} />
      <div className="ligne-raid-infos">
        {/* Ligne de l'étiquette toujours présente : nom et date tombent à la même hauteur sur toutes les cartes. */}
        {!compact && <div className="ligne-raid-marque">{badge}</div>}
        <h3>{titre}</h3>
        <span className="quand">
          {a.titre && `${nom} · `}
          {compact ? afficherDateCourte(a.debutUtc, fuseau) : afficherDate(a.debutUtc, fuseau, d)}
        </span>
        {!compact && auteur && <small>{auteur}</small>}
      </div>
      {compact ? (
        <div className="ligne-raid-droite">
          {badge}
          {compo}
          {action && <div className="ligne-raid-action">{action}</div>}
        </div>
      ) : (
        <div className="ligne-raid-droite">
          {compo}
          {/* Sous la compo : « Complet », sinon les classes recherchées. */}
          {a.statut === "COMPLETE" ? (
            <div className="recherche">
              <span className="pastille complet">{d.accueil.complet}</span>
            </div>
          ) : (
            <div className="recherche" aria-label={d.accueil.classesRecherchees}>
              {r.placeLibre ? (
                <span className="pastille">{d.commun.toutesClasses}</span>
              ) : (
                <>
                  {demandesVisibles.map((x) => (
                    <span key={x.cle}>{x.icone}</span>
                  ))}
                  {demandesEnPlus > 0 && <span className="classes-en-plus">+{demandesEnPlus}</span>}
                </>
              )}
            </div>
          )}
        </div>
      )}
      {/* Version complète : le bouton forme une colonne à droite de la compo. */}
      {/* Colonne toujours présente (même vide) pour que les compos restent alignées d'une ligne à l'autre. */}
      {!compact && <div className="ligne-raid-action">{action}</div>}
    </li>
  );
}
