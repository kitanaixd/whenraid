import { badge, type Fiabilite } from "@/lib/fiabilite";

/** Badge de fiabilité : point de couleur + libellé (+ pourcentage), sans émoji. */
export function BadgeFiabilite({ fiabilite }: { fiabilite: Fiabilite | undefined }) {
  if (!fiabilite) return null;
  const b = badge(fiabilite);
  return (
    <span className={`badge-fiabilite fiabilite-${b.niveau}`}>
      {b.libelle}
      {b.pourcent !== null && <span className="fiabilite-pourcent">{b.pourcent} %</span>}
    </span>
  );
}
