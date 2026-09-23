import type { Classe } from "@/generated/prisma/enums";
import { libelleClasse } from "@/lib/libelles";

// Seul endroit où l'on dessine une classe : quand on choisira les icônes
// définitives, il suffira de modifier ce composant.

/** Icône d'une classe (provisoire : initiale dans un losange à la couleur de la classe). */
export function ClasseIcone({ classe, taille = 22 }: { classe: Classe; taille?: number }) {
  return (
    <span
      className="icone-classe"
      style={{ "--c": `var(--classe-${classe})`, "--t": `${taille}px` } as React.CSSProperties}
      title={libelleClasse[classe]}
      role="img"
      aria-label={libelleClasse[classe]}
    >
      <span aria-hidden="true">{libelleClasse[classe][0]}</span>
    </span>
  );
}

/** Icône + nom de la classe dans sa couleur. */
export function NomClasse({ classe }: { classe: Classe }) {
  return (
    <span className="nom-classe" style={{ "--c": `var(--classe-${classe})` } as React.CSSProperties}>
      <ClasseIcone classe={classe} taille={18} />
      <span className="classe">{libelleClasse[classe]}</span>
    </span>
  );
}
