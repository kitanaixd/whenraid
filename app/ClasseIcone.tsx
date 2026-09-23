import Image from "next/image";
import type { Classe, Faction, Role } from "@/generated/prisma/enums";
import { libelleClasse, libelleFaction, libelleRole } from "@/lib/libelles";

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
