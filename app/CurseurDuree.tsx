"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Filtre de durée en curseur : 2 h, 3 h, 4 h, 6 h… puis « Toutes » tout à droite.
 * La liste se met à jour quand on relâche le curseur (pas pendant le glissement).
 */
export function CurseurDuree({
  valeurs,
  choisie,
  etiquettes,
  courtes,
  label,
  children,
}: {
  /** Durées maximales proposées, en heures, dans l'ordre. */
  valeurs: number[];
  choisie: number | null;
  /** Libellé de chaque cran (valeurs puis « Toutes »). */
  etiquettes: string[];
  /** Libellé court sous chaque cran. */
  courtes: string[];
  label: string;
  /** Champs cachés qui gardent les autres filtres. */
  children: React.ReactNode;
}) {
  const [cran, setCran] = useState(choisie === null ? valeurs.length : Math.max(0, valeurs.indexOf(choisie)));
  const formulaire = useRef<HTMLFormElement>(null);
  const curseur = useRef<HTMLInputElement>(null);
  const champ = useRef<HTMLInputElement>(null);

  // « change » n'arrive qu'au relâchement (souris, doigt ou clavier) : c'est là qu'on filtre.
  useEffect(() => {
    const element = curseur.current;
    if (!element) return;
    const appliquer = () => {
      const n = Number(element.value);
      if (champ.current) {
        champ.current.value = n < valeurs.length ? String(valeurs[n]) : "";
        champ.current.disabled = n >= valeurs.length; // « Toutes » : pas de paramètre
      }
      formulaire.current?.requestSubmit();
    };
    element.addEventListener("change", appliquer);
    return () => element.removeEventListener("change", appliquer);
  }, [valeurs]);

  return (
    <form ref={formulaire} method="get" role="search" aria-label={label} className="duree-calendrier">
      {children}
      <input ref={champ} type="hidden" name="duree" defaultValue={choisie ?? ""} disabled={choisie === null} />
      <div className="curseur-duree-tete">
        <span>{label}</span>
        <strong>{etiquettes[cran]}</strong>
      </div>
      <input
        ref={curseur}
        type="range"
        className="curseur-duree"
        min={0}
        max={valeurs.length}
        step={1}
        value={cran}
        aria-label={label}
        aria-valuetext={etiquettes[cran]}
        onChange={(e) => setCran(Number(e.target.value))}
        style={{ "--remplissage": `${(cran / valeurs.length) * 100}%` } as React.CSSProperties}
      />
      <div className="curseur-duree-crans" aria-hidden="true">
        {courtes.map((c, n) => (
          <span key={n} className={n === cran ? "actif" : undefined}>
            {c}
          </span>
        ))}
      </div>
    </form>
  );
}
