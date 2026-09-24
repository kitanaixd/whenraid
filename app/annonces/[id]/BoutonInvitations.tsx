"use client";

import { useRef } from "react";
import { BoutonEnvoi } from "@/app/BoutonEnvoi";
import { useDico } from "@/app/Langue";

export function BoutonInvitations({
  action,
  annonceId,
  resume,
  nbConfirmes,
  nbAInviter,
  vocal,
  commandeWhisper,
  dejaEnvoyeesLe,
}: {
  action: (form: FormData) => void;
  annonceId: string;
  resume: string;
  nbConfirmes: number;
  /** Joueurs confirmés qui n'ont pas encore reçu l'invitation. */
  nbAInviter: number;
  vocal: string;
  commandeWhisper: string | null;
  dejaEnvoyeesLe: string | null;
}) {
  const dialogue = useRef<HTMLDialogElement>(null);
  const t = useDico().invitations;

  return (
    <>
      <button
        type="button"
        className="principal"
        disabled={nbAInviter === 0}
        onClick={() => dialogue.current?.showModal()}
      >
        {!dejaEnvoyeesLe ? t.envoyer : nbAInviter > 0 ? t.nouveaux(nbAInviter) : t.tousInvites}
      </button>
      {dejaEnvoyeesLe && <small>{t.premierEnvoi(dejaEnvoyeesLe)}</small>}

      <dialog ref={dialogue} className="confirmation invitations" aria-labelledby="titre-invitations">
        <form action={action}>
          <input type="hidden" name="annonceId" value={annonceId} />
          <h2 id="titre-invitations">{t.titre}</h2>
          <p>
            <strong>{resume}</strong>
          </p>
          <p>
            {t.leBot} <strong>{t.joueursConfirmes(nbAInviter)}</strong> {t.avec}
          </p>
          <ul>
            <li>{t.leVocal(vocal)}</li>
            <li>
              {commandeWhisper ? (
                <>
                  {t.commande} <code>{commandeWhisper}</code>
                </>
              ) : (
                t.lienRaid
              )}
            </li>
          </ul>
          {nbAInviter < nbConfirmes && <p className="doux">{t.dejaRecue(nbConfirmes - nbAInviter)}</p>}
          <p>
            <label>
              <input type="checkbox" name="confirmation" required /> {t.confirmer}
            </label>
          </p>
          <p className="actions">
            <button type="button" onClick={() => dialogue.current?.close()} autoFocus>
              {t.pasMaintenant}
            </button>{" "}
            <BoutonEnvoi className="principal" disabled={nbAInviter === 0} enCours={t.envoi}>
              {t.envoyerBouton}
            </BoutonEnvoi>
          </p>
        </form>
      </dialog>
    </>
  );
}
