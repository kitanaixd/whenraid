import type { Contenu } from "@/generated/prisma/enums";
import type { Dico } from "@/lib/i18n";

// image : illustration de fond du raid, dans public/raids/<image>.webp (et -petit.webp)
export const raids: Record<Contenu, { taille: number; image: string }> = {
  MONT_HYJAL_10: { taille: 10, image: "mont-hyjal" },
  MONT_HYJAL_20: { taille: 20, image: "mont-hyjal" },
  ONYXIA: { taille: 40, image: "onyxia" },
};

/** « Mont Hyjal (10) » / « Mount Hyjal (10) » : le nom affiché partout sur le site. */
export function nomRaid(contenu: Contenu, d: Dico) {
  return `${d.nomRaid[contenu]} (${raids[contenu].taille})`;
}
