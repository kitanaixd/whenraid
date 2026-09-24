"use client";

import { useRef } from "react";
import { BoutonEnvoi } from "@/app/BoutonEnvoi";
import { useDico } from "@/app/Langue";

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
  const t = useDico().annulation;

  return (
    <>
      <button type="button" className="danger" onClick={() => dialogue.current?.showModal()}>
        {t.bouton}
      </button>

      <dialog ref={dialogue} className="confirmation" aria-labelledby="titre-annulation">
        <form action={action}>
          <input type="hidden" name="annonceId" value={annonceId} />
          <h2 id="titre-annulation">{t.titre}</h2>
          <p>
            <strong>{resume}</strong>
          </p>
          <p className="avertissement">
            {t.definitif} <strong>{t.definitive}</strong>
            {t.nonRetablissable}
            {nbInscrits > 0 && t.reserve(nbInscrits)}
          </p>
          {estComplet && (
            <p className="avertissement grave">
              {t.complet1} <strong>{t.complet2}</strong>
              {t.complet3} <strong>{t.penalite}</strong>.
            </p>
          )}
          <p>
            <label>
              <input type="checkbox" name="confirmation" required /> {t.confirmer}
              {estComplet && t.accepterPenalite}
            </label>
          </p>
          <p className="actions">
            <button type="button" onClick={() => dialogue.current?.close()} autoFocus>
              {t.garder}
            </button>{" "}
            <BoutonEnvoi className="danger" enCours={t.enCours}>
              {t.annulerDefinitivement}
            </BoutonEnvoi>
          </p>
        </form>
      </dialog>
    </>
  );
}
