import { badge, type Fiabilite } from "@/lib/fiabilite";
import { dicoCourant } from "@/lib/langue";

/**
 * Badge de fiabilité : point de couleur + libellé (+ pourcentage), dans la langue de la page.
 * `compact` : seulement le point et le pourcentage (le libellé en infobulle ; « Nouveau » reste écrit).
 */
export async function BadgeFiabilite({
  fiabilite,
  compact = false,
}: {
  fiabilite: Fiabilite | undefined;
  compact?: boolean;
}) {
  if (!fiabilite) return null;
  const d = await dicoCourant();
  const b = badge(fiabilite);
  if (compact && b.pourcent !== null) {
    return (
      <span className={`badge-fiabilite compact fiabilite-${b.niveau}`} title={d.fiabilite[b.niveau]}>
        {b.pourcent} %
      </span>
    );
  }
  return (
    <span className={`badge-fiabilite fiabilite-${b.niveau}`}>
      {d.fiabilite[b.niveau]}
      {b.pourcent !== null && <span className="fiabilite-pourcent">{b.pourcent} %</span>}
    </span>
  );
}
