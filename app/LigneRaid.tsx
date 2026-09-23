import Link from "next/link";
import type { ReactNode } from "react";
import type { Classe } from "@/generated/prisma/enums";
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
  compact = false,
  marque,
  auteur,
  action,
}: {
  annonce: AnnonceLigne;
  fuseau: string;
  lien: string;
  compact?: boolean;
  marque?: Marque;
  auteur?: ReactNode;
  action?: ReactNode;
}) {
  const r = resumeLigneRaid(a);
  const taille = compact ? 22 : 34;
  const compo = (
    <div className="compo-roles" title="Tanks · Soigneurs · DPS">
      <span aria-label={`${r.roles.tanks} tanks`}>
        <RoleIcone role="TANK" taille={taille} /> {r.roles.tanks}
      </span>
      <span aria-label={`${r.roles.soigneurs} soigneurs`}>
        <RoleIcone role="SOIGNEUR" taille={taille} /> {r.roles.soigneurs}
      </span>
      <span aria-label={`${r.roles.dps} DPS`}>
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

  return (
    <li
      className={`ligne-raid ${compact ? "compacte" : ""} ${marque ? `ligne-${marque.type}` : ""}`}
      data-fond={raids[a.contenu].image}
    >
      <Link href={lien} className="ligne-raid-lien" aria-label={`${nomRaid(a.contenu)}, ${afficherDate(a.debutUtc, fuseau)}`} />
      <div className="ligne-raid-infos">
        {!compact && badge}
        <h3>{nomRaid(a.contenu)}</h3>
        <span className="quand">
          {compact ? afficherDateCourte(a.debutUtc, fuseau) : afficherDate(a.debutUtc, fuseau)}
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
              <span className="pastille complet">Complet · liste d&apos;attente</span>
            </div>
          ) : (
            <div className="recherche" aria-label="Classes recherchées">
              {r.classesRecherchees.map((c) => (
                <ClasseIcone key={c} classe={c} taille={40} />
              ))}
              {r.placeLibre && <span className="pastille">Toutes classes</span>}
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
