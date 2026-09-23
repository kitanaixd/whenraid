import type { Contenu } from "@/generated/prisma/enums";

// image : illustration de fond du raid, dans public/raids/<image>.webp (et -petit.webp)
export const raids: Record<Contenu, { nom: string; taille: number; image: string }> = {
  MONT_HYJAL_10: { nom: "Mont Hyjal", taille: 10, image: "mont-hyjal" },
  MONT_HYJAL_20: { nom: "Mont Hyjal", taille: 20, image: "mont-hyjal" },
  ONYXIA: { nom: "Onyxia", taille: 40, image: "onyxia" },
};

/** « Mont Hyjal (10) » : le nom affiché partout sur le site. */
export function nomRaid(contenu: Contenu) {
  return `${raids[contenu].nom} (${raids[contenu].taille})`;
}
