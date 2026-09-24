import type { Contenu, TypeNotification } from "@/generated/prisma/enums";
import type { Dico } from "@/lib/i18n";
import { afficherDate } from "@/lib/dates";
import { nomRaid } from "@/lib/raids";

/** Le message d'une notification, composé à l'affichage dans la langue et le fuseau du lecteur. */
export function texteNotification(
  type: TypeNotification,
  annonce: { contenu: Contenu; debutUtc: Date } | null,
  fuseau: string,
  d: Dico,
) {
  const raid = annonce
    ? d.notification.raidDu(nomRaid(annonce.contenu, d), afficherDate(annonce.debutUtc, fuseau, d))
    : d.notification.unRaid;
  return d.notification[type](raid);
}
