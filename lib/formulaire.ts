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
