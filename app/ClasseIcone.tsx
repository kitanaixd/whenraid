"use client";

// Composants d'icônes, utilisés côté serveur comme dans les menus du navigateur :
// les libellés (texte alternatif, infobulles) viennent de la langue de la page.
import Image from "next/image";
import type { Classe, Faction, Region, Role, Ruleset } from "@/generated/prisma/enums";
import { DRAPEAUX, ICONES_RULESET } from "@/lib/icones";
import { useDico } from "./Langue";

// Seul endroit où l'on dessine une classe. Icônes : recréations des icônes de
// WoW Classic par brutaliccus (github.com/brutaliccus/ClassicWoWClassIcons_Circle_HighRes).

/** Icône ronde d'une classe. */
export function ClasseIcone({ classe, taille = 22 }: { classe: Classe; taille?: number }) {
  const d = useDico();
  return (
    <Image
      src={`/classes/${classe}.webp`}
      alt={d.classe[classe]}
      title={d.classe[classe]}
      width={taille}
      height={taille}
      className="icone-classe"
      unoptimized
    />
  );
}

/** Icône + nom de la classe dans sa couleur. */
export function NomClasse({ classe, taille = 20 }: { classe: Classe; taille?: number }) {
  const d = useDico();
  return (
    <span className="nom-classe">
      <ClasseIcone classe={classe} taille={taille} />
      <span className="classe" style={{ "--c": `var(--classe-${classe})` } as React.CSSProperties}>
        {d.classe[classe]}
      </span>
    </span>
  );
}

/** Icône d'un rôle : bouclier (Tank), croix (Soigneur), épée (DPS). */
export function RoleIcone({ role, taille = 20 }: { role: Role; taille?: number }) {
  const d = useDico();
  return (
    <Image
      src={`/roles/${role}.webp`}
      alt={d.role[role]}
      title={d.role[role]}
      width={taille}
      height={taille}
      className="icone-classe"
      unoptimized
    />
  );
}

/** Icône + nom du rôle. */
export function NomRole({ role, taille = 20 }: { role: Role; taille?: number }) {
  const d = useDico();
  return (
    <span className="nom-classe">
      <RoleIcone role={role} taille={taille} />
      <span>{d.role[role]}</span>
    </span>
  );
}

/** Emblème de faction : lion de l'Alliance, symbole de la Horde. */
export function FactionIcone({ faction, taille = 20 }: { faction: Faction; taille?: number }) {
  const d = useDico();
  return (
    <Image
      src={`/factions/${faction}.webp`}
      alt={d.faction[faction]}
      title={d.faction[faction]}
      width={taille}
      height={taille}
      className="icone-faction"
      unoptimized
    />
  );
}

/** Pastille de faction : emblème + nom, aux couleurs de la faction. */
export function PastilleFaction({ faction, taille = 18 }: { faction: Faction; taille?: number }) {
  const d = useDico();
  return (
    <span className={`pastille pastille-faction ${faction === "HORDE" ? "horde" : "alliance"}`}>
      <FactionIcone faction={faction} taille={taille} />
      {d.faction[faction]}
    </span>
  );
}

/** Icône du ruleset (rien pour un ruleset sans icône). */
export function RulesetIcone({ ruleset, taille = 20 }: { ruleset: Ruleset; taille?: number }) {
  const d = useDico();
  const src = ICONES_RULESET[ruleset];
  if (!src) return null;
  return (
    <Image
      src={src}
      alt={d.ruleset[ruleset]}
      title={d.ruleset[ruleset]}
      width={taille}
      height={taille}
      className="icone-faction"
      unoptimized
    />
  );
}

/** Drapeau de la région (rien pour une région sans drapeau). */
export function RegionIcone({ region, taille = 20 }: { region: Region; taille?: number }) {
  const d = useDico();
  const src = DRAPEAUX[region];
  if (!src) return null;
  return (
    <Image
      src={src}
      alt={d.region[region]}
      title={d.region[region]}
      width={taille}
      height={taille}
      className="icone-faction"
      unoptimized
    />
  );
}

/** Ruleset et région, avec leurs icônes : « 🐉 PvE · 🇪🇺 EU ». */
export function RulesetRegion({ ruleset, region, taille = 18 }: { ruleset: Ruleset; region: Region; taille?: number }) {
  const d = useDico();
  return (
    <span className="ruleset-region">
      <RulesetIcone ruleset={ruleset} taille={taille} />
      {d.ruleset[ruleset]}
      <span aria-hidden="true">·</span>
      <RegionIcone region={region} taille={taille} />
      {region}
    </span>
  );
}

/** Pastille ruleset + région. */
export function PastilleRuleset({ ruleset, region }: { ruleset: Ruleset; region: Region }) {
  return (
    <span className="pastille pastille-faction">
      <RulesetRegion ruleset={ruleset} region={region} />
    </span>
  );
}
