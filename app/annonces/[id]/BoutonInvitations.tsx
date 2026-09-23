"use client";

import { useRef } from "react";
import { BoutonEnvoi } from "@/app/BoutonEnvoi";

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

  return (
    <>
      <button
        type="button"
        className="principal"
        disabled={nbAInviter === 0}
        onClick={() => dialogue.current?.showModal()}
      >
        {!dejaEnvoyeesLe
          ? "Envoyer les invitations"
          : nbAInviter > 0
            ? `Inviter les nouveaux (${nbAInviter})`
            : "Tous les joueurs sont invités"}
      </button>
      {dejaEnvoyeesLe && <small> Premier envoi le {dejaEnvoyeesLe}.</small>}

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
              {nbAInviter} joueur{nbAInviter > 1 ? "s" : ""} confirmé{nbAInviter > 1 ? "s" : ""}
            </strong>{" "}
            avec :
          </p>
          <ul>
            <li>le vocal : {vocal}</li>
            <li>{commandeWhisper ? <>la commande à copier en jeu : <code>{commandeWhisper}</code></> : "le lien vers le raid"}</li>
          </ul>
          {nbAInviter < nbConfirmes && (
            <p className="doux">
              {nbConfirmes - nbAInviter > 1
                ? `${nbConfirmes - nbAInviter} joueurs l'ont déjà reçue : ils ne la recevront pas une seconde fois.`
                : "1 joueur l'a déjà reçue : il ne la recevra pas une seconde fois."}
            </p>
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
            <BoutonEnvoi className="principal" disabled={nbAInviter === 0} enCours="Envoi…">
              Envoyer
            </BoutonEnvoi>
          </p>
        </form>
      </dialog>
    </>
  );
}
