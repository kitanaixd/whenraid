import Image from "next/image";
import type { Classe, Faction, Region, Role, Ruleset } from "@/generated/prisma/enums";
import { libelleClasse, libelleFaction, libelleRegion, libelleRole, libelleRuleset } from "@/lib/libelles";

// Seul endroit où l'on dessine une classe. Icônes : recréations des icônes de
// WoW Classic par brutaliccus (github.com/brutaliccus/ClassicWoWClassIcons_Circle_HighRes).

/** Icône ronde d'une classe. */
export function ClasseIcone({ classe, taille = 22 }: { classe: Classe; taille?: number }) {
  return (
    <Image
      src={`/classes/${classe}.webp`}
      alt={libelleClasse[classe]}
      title={libelleClasse[classe]}
      width={taille}
      height={taille}
      className="icone-classe"
      unoptimized
    />
  );
}

/** Icône + nom de la classe dans sa couleur. */
export function NomClasse({ classe, taille = 20 }: { classe: Classe; taille?: number }) {
  return (
    <span className="nom-classe">
      <ClasseIcone classe={classe} taille={taille} />
      <span className="classe" style={{ "--c": `var(--classe-${classe})` } as React.CSSProperties}>
        {libelleClasse[classe]}
      </span>
    </span>
  );
}

/** Icône d'un rôle : bouclier (Tank), croix (Soigneur), épée (DPS). */
export function RoleIcone({ role, taille = 20 }: { role: Role; taille?: number }) {
  return (
    <Image
      src={`/roles/${role}.webp`}
      alt={libelleRole[role]}
      title={libelleRole[role]}
      width={taille}
      height={taille}
      className="icone-classe"
      unoptimized
    />
  );
}

/** Icône + nom du rôle. */
export function NomRole({ role, taille = 20 }: { role: Role; taille?: number }) {
  return (
    <span className="nom-classe">
      <RoleIcone role={role} taille={taille} />
      <span>{libelleRole[role]}</span>
    </span>
  );
}

/** Emblème de faction : lion de l'Alliance, symbole de la Horde. */
export function FactionIcone({ faction, taille = 20 }: { faction: Faction; taille?: number }) {
  return (
    <Image
      src={`/factions/${faction}.webp`}
      alt={libelleFaction[faction]}
      title={libelleFaction[faction]}
      width={taille}
      height={taille}
      className="icone-faction"
      unoptimized
    />
  );
}

/** Pastille de faction : emblème + nom, aux couleurs de la faction. */
export function PastilleFaction({ faction, taille = 18 }: { faction: Faction; taille?: number }) {
  return (
    <span className={`pastille pastille-faction ${faction === "HORDE" ? "horde" : "alliance"}`}>
      <FactionIcone faction={faction} taille={taille} />
      {libelleFaction[faction]}
    </span>
  );
}

// Icônes dessinées pour WhenRaid : tête de dragon (PvE), épées croisées (PvP), chope (RP).
export const ICONES_RULESET: Partial<Record<Ruleset, string>> = {
  NORMAL: "/rulesets/NORMAL.svg",
  PVP: "/rulesets/PVP.svg",
  RP: "/rulesets/RP.svg",
};
export const DRAPEAUX: Partial<Record<Region, string>> = { EU: "/regions/EU.svg" };

/** Icône du ruleset (rien pour un ruleset sans icône). */
export function RulesetIcone({ ruleset, taille = 20 }: { ruleset: Ruleset; taille?: number }) {
  const src = ICONES_RULESET[ruleset];
  if (!src) return null;
  return (
    <Image
      src={src}
      alt={libelleRuleset[ruleset]}
      title={libelleRuleset[ruleset]}
      width={taille}
      height={taille}
      className="icone-faction"
      unoptimized
    />
  );
}

/** Drapeau de la région (rien pour une région sans drapeau). */
export function RegionIcone({ region, taille = 20 }: { region: Region; taille?: number }) {
  const src = DRAPEAUX[region];
  if (!src) return null;
  return (
    <Image
      src={src}
      alt={libelleRegion[region]}
      title={libelleRegion[region]}
      width={taille}
      height={taille}
      className="icone-faction"
      unoptimized
    />
  );
}

/** Ruleset et région, avec leurs icônes : « 🐉 PvE · 🇪🇺 EU ». */
export function RulesetRegion({ ruleset, region, taille = 18 }: { ruleset: Ruleset; region: Region; taille?: number }) {
  return (
    <span className="ruleset-region">
      <RulesetIcone ruleset={ruleset} taille={taille} />
      {libelleRuleset[ruleset]}
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
