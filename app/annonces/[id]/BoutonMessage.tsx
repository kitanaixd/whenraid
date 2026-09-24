"use client";

import { useRef } from "react";
import { BoutonEnvoi } from "@/app/BoutonEnvoi";
import { IconeMessage } from "@/app/Icones";
import { useDico } from "@/app/Langue";

/** Le RL écrit un message à un joueur ; le bot WhenRaid le lui envoie en MP Discord. */
export function BoutonMessage({
  action,
  inscriptionId,
  pseudo,
}: {
  action: (form: FormData) => void;
  inscriptionId: string;
  pseudo: string;
}) {
  const dialogue = useRef<HTMLDialogElement>(null);
  const d = useDico();
  const t = d.retrait;
  return (
    <>
      <button
        type="button"
        className="bouton-icone lien-discord"
        aria-label={t.message(pseudo)}
        title={t.message(pseudo)}
        onClick={() => dialogue.current?.showModal()}
      >
        <IconeMessage />
      </button>
      <dialog ref={dialogue} className="confirmation" aria-labelledby={`titre-message-${inscriptionId}`}>
        <form action={action}>
          <input type="hidden" name="inscriptionId" value={inscriptionId} />
          <h2 id={`titre-message-${inscriptionId}`}>{t.messageTitre(pseudo)}</h2>
          <p className="doux">{t.messageAide}</p>
          <textarea name="texte" required maxLength={500} rows={4} placeholder={t.messagePlaceholder} />
          <p className="actions">
            <button type="button" onClick={() => dialogue.current?.close()}>
              {t.annuler}
            </button>{" "}
            <BoutonEnvoi className="principal" enCours={d.commun.enCours}>
              {t.envoyer}
            </BoutonEnvoi>
          </p>
        </form>
      </dialog>
    </>
  );
}
