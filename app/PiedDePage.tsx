import { dicoCourant } from "@/lib/langue";

/**
 * Mentions exigées par la politique de Blizzard pour les sites de fans
 * (usage non commercial, notices de droits d'auteur et de marques).
 */
export async function PiedDePage() {
  const d = await dicoCourant();
  return (
    <footer className="pied-de-page">
      <p>{d.pied.fan}</p>
      <p>{d.pied.marques}</p>
      <p>
        {d.pied.credits} <a href="https://github.com/brutaliccus/ClassicWoWClassIcons_Circle_HighRes">brutaliccus</a>.
      </p>
    </footer>
  );
}
