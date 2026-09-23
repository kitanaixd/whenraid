import type { Contenu } from "@/generated/prisma/enums";

export const raids: Record<Contenu, { nom: string; taille: number }> = {
  MOLTEN_CORE: { nom: "Cœur du Magma", taille: 40 },
  ONYXIA: { nom: "Repaire d'Onyxia", taille: 40 },
  ZUL_GURUB: { nom: "Zul'Gurub", taille: 20 },
  BLACKWING_LAIR: { nom: "Repaire de l'Aile noire", taille: 40 },
  AQ20: { nom: "Ruines d'Ahn'Qiraj (AQ20)", taille: 20 },
  AQ40: { nom: "Temple d'Ahn'Qiraj (AQ40)", taille: 40 },
  NAXXRAMAS: { nom: "Naxxramas", taille: 40 },
};
