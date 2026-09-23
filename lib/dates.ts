// Règle 3 : on stocke en UTC, on convertit seulement à la saisie et à l'affichage.

/** Décalage (en ms) entre l'heure locale du fuseau et l'UTC, à un instant donné. */
function decalage(instantUtc: number, fuseau: string) {
  const parties = new Intl.DateTimeFormat("en-US", {
    timeZone: fuseau,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instantUtc));
  const v = (type: string) => Number(parties.find((p) => p.type === type)!.value);
  const commeSiUtc = Date.UTC(v("year"), v("month") - 1, v("day"), v("hour"), v("minute"), v("second"));
  return commeSiUtc - instantUtc;
}

/**
 * Convertit une date et une heure saisies dans un fuseau (« 2026-10-03 », « 21:00 »,
 * « Europe/Paris ») en instant UTC. Renvoie null si la saisie est invalide ou
 * tombe dans le trou du passage à l'heure d'été.
 */
export function localVersUtc(date: string, heure: string, fuseau: string): Date | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const h = /^(\d{2}):(\d{2})$/.exec(heure);
  if (!d || !h) return null;
  const naif = Date.UTC(+d[1], +d[2] - 1, +d[3], +h[1], +h[2]);
  // Date.UTC accepte « 31 février » ou « 25h » en les reportant : on refuse.
  const verif = new Date(naif);
  if (
    verif.getUTCMonth() !== +d[2] - 1 ||
    verif.getUTCDate() !== +d[3] ||
    verif.getUTCHours() !== +h[1] ||
    verif.getUTCMinutes() !== +h[2]
  ) {
    return null;
  }
  // Deux passes : le décalage peut changer autour d'un changement d'heure.
  let utc = naif - decalage(naif, fuseau);
  utc = naif - decalage(utc, fuseau);
  if (utc + decalage(utc, fuseau) !== naif) return null;
  return new Date(utc);
}

/** Jour au format JJ/MM/AAAA et heure HH:MM, dans le fuseau de la personne qui regarde. */
function jourEtHeure(instant: Date, fuseau: string) {
  const jour = new Intl.DateTimeFormat("fr-FR", {
    timeZone: fuseau,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(instant);
  const heure = new Intl.DateTimeFormat("fr-FR", { timeZone: fuseau, hour: "2-digit", minute: "2-digit" }).format(instant);
  return { jour, heure };
}

/** Affiche un instant UTC dans le fuseau de la personne qui regarde : « 24/09/2026 à 21:00 ». */
export function afficherDate(instant: Date, fuseau: string) {
  const { jour, heure } = jourEtHeure(instant, fuseau);
  return `${jour} à ${heure}`;
}

/** Date pour les lignes compactes : « 24/09/2026 · 21:00 ». */
export function afficherDateCourte(instant: Date, fuseau: string) {
  const { jour, heure } = jourEtHeure(instant, fuseau);
  return `${jour} · ${heure}`;
}
