// Lecture des champs de formulaire côté serveur. Les Server Actions sont
// joignables directement en POST : on ne fait jamais confiance au navigateur.

export class ErreurFormulaire extends Error {}

export function texte(form: FormData, nom: string, { requis = false, max = 200 } = {}) {
  const valeur = String(form.get(nom) ?? "").trim();
  if (requis && !valeur) throw new ErreurFormulaire(`Le champ « ${nom} » est obligatoire.`);
  if (valeur.length > max) throw new ErreurFormulaire(`Le champ « ${nom} » est trop long.`);
  return valeur || null;
}

export function entier(form: FormData, nom: string, { min, max, requis = false }: { min: number; max: number; requis?: boolean }) {
  const brut = String(form.get(nom) ?? "").trim();
  if (!brut) {
    if (requis) throw new ErreurFormulaire(`Le champ « ${nom} » est obligatoire.`);
    return null;
  }
  const valeur = Number(brut);
  if (!Number.isInteger(valeur) || valeur < min || valeur > max) {
    throw new ErreurFormulaire(`Le champ « ${nom} » doit être un nombre entre ${min} et ${max}.`);
  }
  return valeur;
}

export function choix<T extends string>(form: FormData, nom: string, valeurs: Record<T, unknown>): T {
  const valeur = String(form.get(nom) ?? "");
  if (!(valeur in valeurs)) throw new ErreurFormulaire(`Valeur invalide pour « ${nom} ».`);
  return valeur as T;
}

export function choixMultiples<T extends string>(form: FormData, nom: string, valeurs: Record<T, unknown>): T[] {
  const liste = form.getAll(nom).map(String);
  for (const v of liste) {
    if (!(v in valeurs)) throw new ErreurFormulaire(`Valeur invalide pour « ${nom} ».`);
  }
  return [...new Set(liste)] as T[];
}

export const NOM_MAX = 15;

/**
 * Nom ou nom de famille d'un personnage : lettres uniquement (accents compris),
 * 15 au plus, remis en forme « Majuscule puis minuscules » (ex. « jAINA » → « Jaina »).
 */
export function nomDePersonnage(form: FormData, nom: string, etiquette: string, { requis = false } = {}) {
  const valeur = String(form.get(nom) ?? "").trim();
  if (!valeur) {
    if (requis) throw new ErreurFormulaire(`Le champ « ${etiquette} » est obligatoire.`);
    return null;
  }
  if (!/^\p{L}+$/u.test(valeur)) {
    throw new ErreurFormulaire(`« ${etiquette} » : uniquement des lettres, sans espace, chiffre ni symbole.`);
  }
  if ([...valeur].length > NOM_MAX) throw new ErreurFormulaire(`« ${etiquette} » : ${NOM_MAX} lettres maximum.`);
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
    throw new ErreurFormulaire("Le lien de logs n'est pas une adresse valide.");
  }
  const hote = url.hostname.toLowerCase();
  const warcraftLogs = hote === "warcraftlogs.com" || hote.endsWith(".warcraftlogs.com");
  if (url.protocol !== "https:" || !warcraftLogs || url.username || url.password || url.port) {
    throw new ErreurFormulaire("Seuls les liens https://…warcraftlogs.com/ sont acceptés.");
  }
  if (valeur.length > 300) throw new ErreurFormulaire("Le lien de logs est trop long.");
  return url.toString();
}
