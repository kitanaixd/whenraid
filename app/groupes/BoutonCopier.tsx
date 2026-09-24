"use client";

import { useState } from "react";
import { useDico } from "@/app/Langue";

/** Copie un texte (le lien d'invitation) dans le presse-papiers. */
export function BoutonCopier({ texte }: { texte: string }) {
  const d = useDico();
  const [copie, setCopie] = useState(false);
  return (
    <button
      type="button"
      className="petit"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(texte);
          setCopie(true);
          setTimeout(() => setCopie(false), 2000);
        } catch {
          // Presse-papiers refusé : le lien reste sélectionnable à la main.
        }
      }}
    >
      {copie ? d.groupes.copie : d.groupes.copier}
    </button>
  );
}
