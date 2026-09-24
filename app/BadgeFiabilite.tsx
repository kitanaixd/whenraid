import { badge, type Fiabilite } from "@/lib/fiabilite";
import { dicoCourant } from "@/lib/langue";

/** Badge de fiabilité : point de couleur + libellé (+ pourcentage), dans la langue de la page. */
export async function BadgeFiabilite({ fiabilite }: { fiabilite: Fiabilite | undefined }) {
  if (!fiabilite) return null;
  const d = await dicoCourant();
  const b = badge(fiabilite);
  return (
    <span className={`badge-fiabilite fiabilite-${b.niveau}`}>
      {d.fiabilite[b.niveau]}
      {b.pourcent !== null && <span className="fiabilite-pourcent">{b.pourcent} %</span>}
    </span>
  );
}
