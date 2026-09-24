// Lecture des champs de formulaire côté serveur. Les Server Actions sont
// joignables directement en POST : on ne fait jamais confiance au navigateur.
import type { Dico } from "@/lib/i18n";

/** Nom affiché d'un champ : une entrée du dictionnaire (d.champ), sinon son nom technique. */
type Champ = keyof Dico["champ"];

/** Erreur de saisie : le message est écrit dans la langue du visiteur au moment de l'afficher. */
export class ErreurFormulaire extends Error {
  constructor(readonly traduire: (d: Dico) => string) {
    super("ErreurFormulaire");
  }
}

const etiquette = (d: Dico, nom: string, champ?: Champ) => (champ ? d.champ[champ] : nom);

export function texte(
  form: FormData,
  nom: string,
  { requis = false, max = 200, champ }: { requis?: boolean; max?: number; champ?: Champ } = {},
) {
  const valeur = String(form.get(nom) ?? "").trim();
  if (requis && !valeur) throw new ErreurFormulaire((d) => d.erreur.obligatoire(etiquette(d, nom, champ)));
  if (valeur.length > max) throw new ErreurFormulaire((d) => d.erreur.tropLong(etiquette(d, nom, champ)));
  return valeur || null;
}

export function entier(
  form: FormData,
  nom: string,
  { min, max, requis = false, champ }: { min: number; max: number; requis?: boolean; champ?: Champ },
) {
  const brut = String(form.get(nom) ?? "").trim();
  if (!brut) {
    if (requis) throw new ErreurFormulaire((d) => d.erreur.obligatoire(etiquette(d, nom, champ)));
    return null;
  }
  const valeur = Number(brut);
  if (!Number.isInteger(valeur) || valeur < min || valeur > max) {
    throw new ErreurFormulaire((d) => d.erreur.nombreEntre(etiquette(d, nom, champ), min, max));
  }
  return valeur;
}

export function choix<T extends string>(form: FormData, nom: string, valeurs: Record<T, unknown>, champ?: Champ): T {
  const valeur = String(form.get(nom) ?? "");
  if (!(valeur in valeurs)) throw new ErreurFormulaire((d) => d.erreur.valeurInvalide(etiquette(d, nom, champ)));
  return valeur as T;
}

export function choixMultiples<T extends string>(
  form: FormData,
  nom: string,
  valeurs: Record<T, unknown>,
  champ?: Champ,
): T[] {
  const liste = form.getAll(nom).map(String);
  for (const v of liste) {
    if (!(v in valeurs)) throw new ErreurFormulaire((d) => d.erreur.valeurInvalide(etiquette(d, nom, champ)));
  }
  return [...new Set(liste)] as T[];
}

export const NOM_MAX = 15;

/**
 * Nom ou nom de famille d'un personnage : lettres uniquement (accents compris),
 * 15 au plus, remis en forme « Majuscule puis minuscules » (ex. « jAINA » → « Jaina »).
 */
export function nomDePersonnage(form: FormData, nom: string, champ: Champ, { requis = false } = {}) {
  const valeur = String(form.get(nom) ?? "").trim();
  if (!valeur) {
    if (requis) throw new ErreurFormulaire((d) => d.erreur.obligatoire(d.champ[champ]));
    return null;
  }
  if (!/^\p{L}+$/u.test(valeur)) {
    throw new ErreurFormulaire((d) => d.erreur.lettresSeulement(d.champ[champ]));
  }
  if ([...valeur].length > NOM_MAX) throw new ErreurFormulaire((d) => d.erreur.lettresMax(d.champ[champ], NOM_MAX));
  const minuscules = valeur.toLocaleLowerCase("fr");
  return minuscules.charAt(0).toLocaleUpperCase("fr") + minuscules.slice(1);
}

/** Lien de logs : uniquement une adresse https de Warcraft Logs (évite les liens piégés envoyés aux RL). */
export function lienWarcraftLogs(form: FormData, nom: string) {
  const valeur = String(form.get(nom) ?? "").trim();
  if (!valeur) return null;
  let url: URL;
  try {
    url = new URL(valeur);
  } catch {
    throw new ErreurFormulaire((d) => d.erreur.logsInvalide);
  }
  const hote = url.hostname.toLowerCase();
  const warcraftLogs = hote === "warcraftlogs.com" || hote.endsWith(".warcraftlogs.com");
  if (url.protocol !== "https:" || !warcraftLogs || url.username || url.password || url.port) {
    throw new ErreurFormulaire((d) => d.erreur.logsWarcraft);
  }
  if (valeur.length > 300) throw new ErreurFormulaire((d) => d.erreur.logsTropLong);
  return url.toString();
}

/** Message d'une erreur de saisie dans la langue de la page (les autres erreurs sont relancées). */
export function messageErreur(e: unknown, d: Dico): string {
  if (e instanceof ErreurFormulaire) return e.traduire(d);
  throw e;
}
