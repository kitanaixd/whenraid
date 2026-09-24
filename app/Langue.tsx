"use client";

import { createContext, useContext } from "react";
import { dico, LANGUE_PAR_DEFAUT, type Langue } from "@/lib/i18n";

const ContexteLangue = createContext<Langue>(LANGUE_PAR_DEFAUT);

/** Donne la langue de la page aux composants du navigateur. */
export function FournisseurLangue({ langue, children }: { langue: Langue; children: React.ReactNode }) {
  return <ContexteLangue.Provider value={langue}>{children}</ContexteLangue.Provider>;
}

/** Le dictionnaire de la langue de la page, dans un composant du navigateur. */
export function useDico() {
  return dico(useContext(ContexteLangue));
}

export function useLangue() {
  return useContext(ContexteLangue);
}
