"use client";

import { useRef } from "react";
import { BoutonEnvoi } from "@/app/BoutonEnvoi";
import { IconeCroix } from "@/app/Icones";
import { useDico } from "@/app/Langue";

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
  const d = useDico();
  const t = d.desinscription;
  const libelleIcone = convie ? t.seDesister : t.annulerCandidature;

  return (
    <>
      {retourListe !== undefined ? (
        /* Sur la liste des raids : bouton-icône (croix). */
        <button
          type="button"
          className="bouton-icone danger"
          aria-label={libelleIcone}
          title={libelleIcone}
          onClick={() => dialogue.current?.showModal()}
        >
          <IconeCroix />
        </button>
      ) : (
        <button type="button" className="petit danger" onClick={() => dialogue.current?.showModal()}>
          {convie ? t.seDesister : t.retirerCandidature}
        </button>
      )}

      <dialog ref={dialogue} className="confirmation" aria-labelledby={`titre-desinscription-${inscriptionId}`}>
        <form action={action}>
          <input type="hidden" name="inscriptionId" value={inscriptionId} />
          {retourListe !== undefined && (
            <>
              <input type="hidden" name="depuis" value="liste" />
              <input type="hidden" name="retour" value={retourListe} />
            </>
          )}
          <h2 id={`titre-desinscription-${inscriptionId}`}>{convie ? t.titreDesister : t.titreRetirer}</h2>
          <p>
            <strong>{resume}</strong>
          </p>
          {convie ? <p className="avertissement">{t.avertissementConvie}</p> : <p>{t.recandidater}</p>}
          <p className="actions">
            <button type="button" onClick={() => dialogue.current?.close()} autoFocus>
              {t.rester}
            </button>{" "}
            <BoutonEnvoi className="danger" enCours={d.commun.enCours}>
              {convie ? t.seDesister : t.retirer}
            </BoutonEnvoi>
          </p>
        </form>
      </dialog>
    </>
  );
}
