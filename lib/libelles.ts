// Les libellés (classes, rôles, statuts…) sont dans les dictionnaires : lib/i18n/fr.ts et en.ts.

/** Les clés d'un dictionnaire de libellés, dans l'ordre, pour les <select>. */
export function options<T extends string, V>(libelles: Record<T, V>) {
  return Object.entries(libelles) as [T, V][];
}

/** Comme options(), triées par ordre alphabétique des libellés (dans la langue affichée). */
export function optionsTriees<T extends string>(libelles: Record<T, string>) {
  return options(libelles).sort(([, a], [, b]) => a.localeCompare(b));
}
