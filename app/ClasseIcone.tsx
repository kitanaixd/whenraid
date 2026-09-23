import Image from "next/image";
import type { Classe } from "@/generated/prisma/enums";
import { libelleClasse } from "@/lib/libelles";

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
