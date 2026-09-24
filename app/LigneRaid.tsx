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
 * `texte` : étiquette courte ; `perso` : le personnage inscrit ; `detail` : complément (ex. candidatures reçues).
 */
export type Marque = {
  type: "organise" | "convie" | "candidat" | "attente";
  texte: string;
  perso?: { classe: Classe; nom: string };
  detail?: string;
};

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
}: {
  annonce: AnnonceLigne;
  fuseau: string;
  lien: string;
  d: Dico;
  compact?: boolean;
  marque?: Marque;
  auteur?: ReactNode;
  action?: ReactNode;
}) {
  const r = resumeLigneRaid(a);
  const taille = compact ? 18 : 34;
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
      {marque.perso && (
        <span className="perso-inscrit">
          <ClasseIcone classe={marque.perso.classe} taille={20} />
          <span className="classe" style={{ "--c": `var(--classe-${marque.perso.classe})` } as React.CSSProperties}>
            {marque.perso.nom}
          </span>
        </span>
      )}
      {marque.detail && <span className="doux">{marque.detail}</span>}
    </span>
  );
  const nom = nomRaid(a.contenu, d);

  return (
    <li
      className={`ligne-raid ${compact ? "compacte" : ""} ${marque ? `ligne-${marque.type}` : ""}`}
      data-fond={raids[a.contenu].image}
    >
      <Link href={lien} className="ligne-raid-lien" aria-label={`${nom}, ${afficherDate(a.debutUtc, fuseau, d)}`} />
      <div className="ligne-raid-infos">
        {!compact && badge}
        <h3>{nom}</h3>
        <span className="quand">
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
              {r.classesRecherchees.map((c) => (
                <ClasseIcone key={c} classe={c} taille={40} />
              ))}
              {r.placeLibre && <span className="pastille">{d.commun.toutesClasses}</span>}
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
