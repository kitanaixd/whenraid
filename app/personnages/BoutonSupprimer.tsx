"use client";

import { useRef } from "react";
import { BoutonEnvoi } from "@/app/BoutonEnvoi";
import { useDico } from "@/app/Langue";

/** Suppression d'un personnage, après confirmation dans une fenêtre. */
export function BoutonSupprimer({
  action,
  personnageId,
  nom,
}: {
  action: (form: FormData) => void;
  personnageId: string;
  nom: string;
}) {
  const dialogue = useRef<HTMLDialogElement>(null);
  const d = useDico();

  return (
    <>
      <button type="button" className="petit danger" onClick={() => dialogue.current?.showModal()}>
        {d.personnages.supprimer}
      </button>

      <dialog ref={dialogue} className="confirmation" aria-labelledby={`titre-suppression-${personnageId}`}>
        <form action={action}>
          <input type="hidden" name="personnageId" value={personnageId} />
          <h2 id={`titre-suppression-${personnageId}`}>{d.personnages.titreSupprimer(nom)}</h2>
          <p>{d.personnages.supprimerAide}</p>
          <p className="doux">{d.personnages.reputationAide}</p>
          <p className="actions">
            <button type="button" onClick={() => dialogue.current?.close()} autoFocus>
              {d.personnages.garder}
            </button>{" "}
            <BoutonEnvoi className="danger" enCours={d.personnages.suppression}>
              {d.personnages.supprimer}
            </BoutonEnvoi>
          </p>
        </form>
      </dialog>
    </>
  );
}
