import Link from "next/link";
import type { Dico } from "@/lib/i18n";

/** « 2026-09 » → mois précédent ou suivant. */
function decalerMois(mois: string, delta: number) {
  const [a, m] = mois.split("-").map(Number);
  const date = new Date(Date.UTC(a, m - 1 + delta, 1));
  return date.toISOString().slice(0, 7);
}

/**
 * Calendrier du mois : les jours qui ont des raids pour le personnage choisi portent
 * leur nombre ; un clic affiche les raids de ce jour (un second clic, ou « Toutes les
 * dates », retire le filtre). Les liens gardent les autres filtres via `lien`.
 */
export function Calendrier({
  mois,
  jourChoisi,
  aujourdHui,
  raidsParJour,
  lien,
  d,
}: {
  /** Mois affiché, « AAAA-MM ». */
  mois: string;
  /** Jour filtré, « AAAA-MM-JJ », ou null. */
  jourChoisi: string | null;
  aujourdHui: string;
  raidsParJour: Map<string, number>;
  /** Construit l'adresse de la liste pour un jour (null = toutes les dates) et un mois affiché. */
  lien: (jour: string | null, mois: string) => string;
  d: Dico;
}) {
  const [annee, numeroMois] = mois.split("-").map(Number);
  const premier = new Date(Date.UTC(annee, numeroMois - 1, 1));
  const decalage = (premier.getUTCDay() + 6) % 7; // lundi en premier
  const nbJours = new Date(Date.UTC(annee, numeroMois, 0)).getUTCDate();
  const titre = new Intl.DateTimeFormat(d.calendrier.locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(
    premier,
  );
  const cases: (string | null)[] = [
    ...Array.from({ length: decalage }, () => null),
    ...Array.from({ length: nbJours }, (_, i) => `${mois}-${String(i + 1).padStart(2, "0")}`),
  ];

  return (
    <section className="carte calendrier" aria-label={d.calendrier.titre}>
      <div className="calendrier-entete">
        <Link href={lien(jourChoisi, decalerMois(mois, -1))} aria-label={d.calendrier.moisPrecedent} className="calendrier-fleche">
          ‹
        </Link>
        <strong className="calendrier-titre">{titre}</strong>
        <Link href={lien(jourChoisi, decalerMois(mois, 1))} aria-label={d.calendrier.moisSuivant} className="calendrier-fleche">
          ›
        </Link>
      </div>
      <div className="calendrier-grille" role="grid">
        {d.calendrier.jours.map((j, i) => (
          <span key={i} className="calendrier-jour-semaine" role="columnheader">
            {j}
          </span>
        ))}
        {cases.map((jour, i) => {
          if (!jour) return <span key={`vide-${i}`} />;
          const numero = Number(jour.slice(8));
          const nb = raidsParJour.get(jour) ?? 0;
          const passe = jour < aujourdHui;
          const choisi = jour === jourChoisi;
          const classes = ["calendrier-jour", passe && "passe", nb > 0 && "a-raids", choisi && "choisi", jour === aujourdHui && "aujourdhui"]
            .filter(Boolean)
            .join(" ");
          // Seuls les jours à venir qui ont des raids sont cliquables.
          return nb > 0 && !passe ? (
            <Link
              key={jour}
              href={lien(choisi ? null : jour, mois)}
              className={classes}
              aria-pressed={choisi}
              aria-label={`${numero} — ${d.calendrier.raids(nb)}`}
              title={d.calendrier.raids(nb)}
            >
              {numero}
              <span className="calendrier-nombre">{nb}</span>
            </Link>
          ) : (
            <span key={jour} className={classes}>
              {numero}
            </span>
          );
        })}
      </div>
      {jourChoisi && (
        <Link href={lien(null, mois)} className="bouton petit calendrier-tout">
          {d.calendrier.toutesDates}
        </Link>
      )}
    </section>
  );
}
