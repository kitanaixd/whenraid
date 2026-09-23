"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

/**
 * Menu du compte, tout à droite de l'en-tête : avatar + pseudo, qui ouvre la liste
 * (profil, personnages, déconnexion). Se ferme au clic ailleurs, avec Échap ou en choisissant.
 */
export function MenuCompte({ pseudo, avatarUrl, children }: { pseudo: string; avatarUrl: string | null; children: ReactNode }) {
  const [ouvert, setOuvert] = useState(false);
  const conteneur = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!ouvert) return;
    const fermer = (e: MouseEvent) => {
      if (!conteneur.current?.contains(e.target as Node)) setOuvert(false);
    };
    const echap = (e: KeyboardEvent) => e.key === "Escape" && setOuvert(false);
    document.addEventListener("mousedown", fermer);
    document.addEventListener("keydown", echap);
    return () => {
      document.removeEventListener("mousedown", fermer);
      document.removeEventListener("keydown", echap);
    };
  }, [ouvert]);

  return (
    <div className="menu-compte" ref={conteneur}>
      <button
        type="button"
        className="menu-compte-bouton"
        aria-haspopup="menu"
        aria-expanded={ouvert}
        aria-controls={id}
        onClick={() => setOuvert((o) => !o)}
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" width={30} height={30} />
        ) : (
          <span className="avatar-vide" aria-hidden="true">
            {pseudo.charAt(0).toUpperCase()}
          </span>
        )}
        <span className="menu-compte-pseudo">{pseudo}</span>
        <span className="menu-fleche" aria-hidden="true">
          ▾
        </span>
      </button>
      {ouvert && (
        // Un clic sur un lien ferme le menu (la navigation reste gérée par le lien).
        <div className="menu-compte-liste" id={id} role="menu" onClick={() => setOuvert(false)}>
          {children}
        </div>
      )}
    </div>
  );
}
