"use client";

import { useRef } from "react";
import { BoutonEnvoi } from "@/app/BoutonEnvoi";
import { IconeCroix } from "@/app/Icones";

/** Désinscription d'un raid, après confirmation dans une fenêtre. */
export function BoutonDesinscrire({
  action,
  inscriptionId,
  resume,
  convie,
  retourListe,
}: {
  action: (form: FormData) => void;
  inscriptionId: string;
  resume: string;
  convie: boolean;
  /** Depuis la liste des raids : filtres à retrouver après la désinscription. */
  retourListe?: string;
}) {
  const dialogue = useRef<HTMLDialogElement>(null);

  return (
    <>
      {retourListe !== undefined ? (
        /* Sur la liste des raids : bouton-icône (croix). */
        <button
          type="button"
          className="bouton-icone danger"
          aria-label={convie ? "Me désister" : "Annuler ma candidature"}
          title={convie ? "Me désister" : "Annuler ma candidature"}
          onClick={() => dialogue.current?.showModal()}
        >
          <IconeCroix />
        </button>
      ) : (
        <button type="button" className="petit danger" onClick={() => dialogue.current?.showModal()}>
          {convie ? "Me désister" : "Retirer ma candidature"}
        </button>
      )}

      <dialog ref={dialogue} className="confirmation" aria-labelledby="titre-desinscription">
        <form action={action}>
          <input type="hidden" name="inscriptionId" value={inscriptionId} />
          {retourListe !== undefined && (
            <>
              <input type="hidden" name="depuis" value="liste" />
              <input type="hidden" name="retour" value={retourListe} />
            </>
          )}
          <h2 id="titre-desinscription">{convie ? "Te désister de ce raid ?" : "Retirer ta candidature ?"}</h2>
          <p>
            <strong>{resume}</strong>
          </p>
          {convie ? (
            <p className="avertissement">
              Le RL compte sur toi : il sera prévenu tout de suite et ta place sera rouverte. Tu pourras recandidater
              tant que le raid n&apos;a pas commencé.
            </p>
          ) : (
            <p>Tu pourras recandidater tant que le raid n&apos;a pas commencé.</p>
          )}
          <p className="actions">
            <button type="button" onClick={() => dialogue.current?.close()} autoFocus>
              Rester inscrit
            </button>{" "}
            <BoutonEnvoi className="danger" enCours="…">
              {convie ? "Me désister" : "Retirer"}
            </BoutonEnvoi>
          </p>
        </form>
      </dialog>
    </>
  );
}
