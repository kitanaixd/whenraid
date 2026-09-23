"use client";

import { useRef } from "react";
import { BoutonEnvoi } from "@/app/BoutonEnvoi";

export function BoutonInvitations({
  action,
  annonceId,
  resume,
  nbConfirmes,
  vocal,
  commandeWhisper,
  dejaEnvoyeesLe,
}: {
  action: (form: FormData) => void;
  annonceId: string;
  resume: string;
  nbConfirmes: number;
  vocal: string;
  commandeWhisper: string | null;
  dejaEnvoyeesLe: string | null;
}) {
  const dialogue = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button type="button" className="principal" onClick={() => dialogue.current?.showModal()}>
        {dejaEnvoyeesLe ? "Renvoyer les invitations" : "Envoyer les invitations"}
      </button>
      {dejaEnvoyeesLe && <small> Déjà envoyées le {dejaEnvoyeesLe}.</small>}

      <dialog ref={dialogue} className="confirmation invitations" aria-labelledby="titre-invitations">
        <form action={action}>
          <input type="hidden" name="annonceId" value={annonceId} />
          <h2 id="titre-invitations">📨 Envoyer les invitations ?</h2>
          <p>
            <strong>{resume}</strong>
          </p>
          <p>
            Le bot WhenRaid va envoyer un MP Discord à{" "}
            <strong>
              {nbConfirmes} joueur{nbConfirmes > 1 ? "s" : ""} confirmé{nbConfirmes > 1 ? "s" : ""}
            </strong>{" "}
            avec :
          </p>
          <ul>
            <li>le vocal : {vocal}</li>
            <li>{commandeWhisper ? <>la commande à copier en jeu : <code>{commandeWhisper}</code></> : "le lien vers le raid"}</li>
          </ul>
          {dejaEnvoyeesLe && (
            <p className="avertissement">Les invitations sont déjà parties : les joueurs les recevront une seconde fois.</p>
          )}
          <p>
            <label>
              <input type="checkbox" name="confirmation" required /> Je confirme l&apos;envoi des invitations
            </label>
          </p>
          <p className="actions">
            <button type="button" onClick={() => dialogue.current?.close()} autoFocus>
              Pas maintenant
            </button>{" "}
            <BoutonEnvoi className="principal" disabled={nbConfirmes === 0} enCours="Envoi…">
              Envoyer
            </BoutonEnvoi>
          </p>
        </form>
      </dialog>
    </>
  );
}
