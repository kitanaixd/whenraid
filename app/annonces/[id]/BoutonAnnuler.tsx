"use client";

import { useRef } from "react";
import { BoutonEnvoi } from "@/app/BoutonEnvoi";

export function BoutonAnnuler({
  action,
  annonceId,
  resume,
  nbInscrits,
  estComplet,
}: {
  action: (form: FormData) => void;
  annonceId: string;
  resume: string;
  nbInscrits: number;
  estComplet: boolean;
}) {
  const dialogue = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button type="button" className="danger" onClick={() => dialogue.current?.showModal()}>
        Annuler le raid
      </button>

      <dialog ref={dialogue} className="confirmation" aria-labelledby="titre-annulation">
        <form action={action}>
          <input type="hidden" name="annonceId" value={annonceId} />
          <h2 id="titre-annulation">⚠ Annuler ce raid ?</h2>
          <p>
            <strong>{resume}</strong>
          </p>
          <p className="avertissement">
            Cette action est <strong>définitive</strong> : le raid ne pourra pas être rétabli.
            {nbInscrits > 0 &&
              ` ${nbInscrits} joueur${nbInscrits > 1 ? "s ont réservé leur" : " a réservé sa"} soirée pour ce raid.`}
          </p>
          {estComplet && (
            <p className="avertissement grave">
              Ce raid est <strong>complet</strong>. L&apos;annuler maintenant sera enregistré et{" "}
              <strong>comptera contre ta réputation de RL</strong>.
            </p>
          )}
          <p>
            <label>
              <input type="checkbox" name="confirmation" required /> Je confirme vouloir annuler ce raid
              {estComplet && " et j'accepte la pénalité de réputation"}
            </label>
          </p>
          <p className="actions">
            <button type="button" onClick={() => dialogue.current?.close()} autoFocus>
              Garder le raid
            </button>{" "}
            <BoutonEnvoi className="danger" enCours="Annulation…">
              Annuler définitivement
            </BoutonEnvoi>
          </p>
        </form>
      </dialog>
    </>
  );
}
