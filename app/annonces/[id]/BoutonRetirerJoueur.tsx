"use client";

import { useRef } from "react";
import { BoutonEnvoi } from "@/app/BoutonEnvoi";
import { IconeCroix } from "@/app/Icones";
import { useDico } from "@/app/Langue";

/** Le RL retire un joueur convié, après confirmation (avec l'avertissement de pénalité à moins de 2 h). */
export function BoutonRetirerJoueur({
  action,
  inscriptionId,
  nom,
  penalite,
}: {
  action: (form: FormData) => void;
  inscriptionId: string;
  nom: string;
  /** Le raid commence dans moins de 2 h : le retrait pèse sur la fiabilité du RL. */
  penalite: boolean;
}) {
  const dialogue = useRef<HTMLDialogElement>(null);
  const d = useDico();
  const t = d.retrait;
  return (
    <>
      <button
        type="button"
        className="bouton-icone danger"
        aria-label={t.aria(nom)}
        title={t.aria(nom)}
        onClick={() => dialogue.current?.showModal()}
      >
        <IconeCroix />
      </button>
      <dialog ref={dialogue} className="confirmation" aria-labelledby={`titre-retrait-${inscriptionId}`}>
        <form action={action}>
          <input type="hidden" name="inscriptionId" value={inscriptionId} />
          <h2 id={`titre-retrait-${inscriptionId}`}>{t.titre(nom)}</h2>
          <p>{t.explication}</p>
          {penalite && <p className="avertissement">{t.penalite}</p>}
          <p className="actions">
            <button type="button" onClick={() => dialogue.current?.close()} autoFocus>
              {t.garder}
            </button>{" "}
            <BoutonEnvoi className="danger" enCours={d.commun.enCours}>
              {t.confirmer}
            </BoutonEnvoi>
          </p>
        </form>
      </dialog>
    </>
  );
}
