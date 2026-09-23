import type { Contenu, TypeNotification } from "@/generated/prisma/enums";
import { afficherDate } from "@/lib/dates";
import { nomRaid } from "@/lib/raids";

/** Le message d'une notification, composé à l'affichage dans le fuseau du lecteur. */
export function texteNotification(
  type: TypeNotification,
  annonce: { contenu: Contenu; debutUtc: Date } | null,
  fuseau: string,
) {
  const raid = annonce ? `${nomRaid(annonce.contenu)} du ${afficherDate(annonce.debutUtc, fuseau)}` : "un raid";
  switch (type) {
    case "CANDIDATURE_ACCEPTEE":
      return `✔ Tu es convié au raid ${raid}.`;
    case "CANDIDATURE_REFUSEE":
      return `Ta candidature au raid ${raid} n'a pas été retenue.`;
    case "RAID_COMPLET":
      return `Le raid ${raid} est complet : il y a peu de chances que tu sois pris. Tu restes en liste d'attente si le RL a besoin d'un remplaçant.`;
    case "RAID_ANNULE":
      return `⚠ Le raid ${raid} a été annulé par son RL.`;
    case "NOUVELLE_CANDIDATURE":
      return `Nouvelle candidature sur ton raid ${raid}.`;
  }
}
