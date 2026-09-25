"use client";

import { createContext, useEffect, useRef, useState, useTransition } from "react";
import { useDico } from "./Langue";

/** Envoi en cours d'un FormulaireConserve (lu par BoutonEnvoi pour se désactiver). */
export const EnvoiEnCours = createContext(false);

/**
 * Formulaire dont l'action renvoie { erreur } au lieu de recharger la page : en cas
 * d'erreur, le message s'affiche en haut et tout ce qui a été saisi reste en place.
 * En cas de succès, l'action redirige elle-même.
 */
export function FormulaireConserve({
  action,
  className,
  children,
}: {
  action: (form: FormData) => Promise<{ erreur: string } | void>;
  className?: string;
  children: React.ReactNode;
}) {
  const d = useDico();
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  const message = useRef<HTMLParagraphElement>(null);

  // Le message d'erreur est en haut du formulaire : on l'amène à l'écran.
  useEffect(() => {
    if (erreur) message.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [erreur]);

  return (
    <form
      className={className}
      onSubmit={(e) => {
        // Pas d'envoi classique : React viderait le formulaire après l'action.
        e.preventDefault();
        const donnees = new FormData(e.currentTarget);
        demarrer(async () => {
          try {
            const resultat = await action(donnees);
            setErreur(resultat?.erreur ?? null);
          } catch (e) {
            // Une redirection (succès) passe par une exception propre à Next : on la laisse passer.
            if (e instanceof Error && e.message === "NEXT_REDIRECT") throw e;
            // Erreur imprévue (serveur, ou page ouverte avant une mise à jour du site) : on le dit.
            console.error(e);
            setErreur(d.commun.erreurInattendue);
          }
        });
      }}
    >
      {erreur && (
        <p ref={message} className="avertissement grave" role="alert">
          ⚠ {erreur}
        </p>
      )}
      <EnvoiEnCours.Provider value={enCours}>{children}</EnvoiEnCours.Provider>
    </form>
  );
}
