"use client";

import { useRef } from "react";
import { BoutonEnvoi } from "@/app/BoutonEnvoi";

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

  return (
    <>
      <button type="button" className="petit danger" onClick={() => dialogue.current?.showModal()}>
        Supprimer
      </button>

      <dialog ref={dialogue} className="confirmation" aria-labelledby={`titre-suppression-${personnageId}`}>
        <form action={action}>
          <input type="hidden" name="personnageId" value={personnageId} />
          <h2 id={`titre-suppression-${personnageId}`}>Supprimer {nom} ?</h2>
          <p>
            Il disparaîtra de ta liste et ne pourra plus candidater. Ses candidatures en attente seront retirées.
          </p>
          <p className="doux">
            Ta réputation est liée à ton compte : elle ne change pas. Les raids passés gardent son nom dans
            l&apos;historique.
          </p>
          <p className="actions">
            <button type="button" onClick={() => dialogue.current?.close()} autoFocus>
              Garder
            </button>{" "}
            <BoutonEnvoi className="danger" enCours="Suppression…">
              Supprimer
            </BoutonEnvoi>
          </p>
        </form>
      </dialog>
    </>
  );
}
