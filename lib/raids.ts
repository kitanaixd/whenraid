import type { Contenu } from "@/generated/prisma/enums";

export const raids: Record<Contenu, { nom: string; taille: number }> = {
  MONT_HYJAL_10: { nom: "Mont Hyjal", taille: 10 },
  MONT_HYJAL_20: { nom: "Mont Hyjal", taille: 20 },
  ONYXIA: { nom: "Onyxia", taille: 40 },
};

/** « Mont Hyjal (10) » : le nom affiché partout sur le site. */
export function nomRaid(contenu: Contenu) {
  return `${raids[contenu].nom} (${raids[contenu].taille})`;
}
