import type { Langue } from "@/generated/prisma/enums";
import { en } from "./en";
import { fr, type Dico } from "./fr";

export type { Dico, Langue };
export const LANGUES: Langue[] = ["en", "fr"];
export const LANGUE_PAR_DEFAUT: Langue = "en";

const DICOS: Record<Langue, Dico> = { en, fr };

/** Le dictionnaire d'une langue (utilisable côté serveur comme côté navigateur). */
export function dico(langue: Langue): Dico {
  return DICOS[langue] ?? DICOS[LANGUE_PAR_DEFAUT];
}

export function estLangue(valeur: unknown): valeur is Langue {
  return valeur === "en" || valeur === "fr";
}
