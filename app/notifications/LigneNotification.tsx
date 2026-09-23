import type { Contenu, TypeNotification } from "@/generated/prisma/enums";
import { afficherDate } from "@/lib/dates";
import { texteNotification } from "@/lib/notifications";

/** Symbole et couleur de chaque type de notification. */
const STYLE: Record<TypeNotification, { symbole: string; ton: string }> = {
  CANDIDATURE_ACCEPTEE: { symbole: "✔", ton: "succes" },
  CANDIDATURE_REFUSEE: { symbole: "✕", ton: "alerte" },
  RAID_COMPLET: { symbole: "⏳", ton: "attention" },
  RAID_ANNULE: { symbole: "!", ton: "alerte" },
  NOUVELLE_CANDIDATURE: { symbole: "+", ton: "info" },
  VALIDER_PRESENCES: { symbole: "☰", ton: "or" },
  DESISTEMENT: { symbole: "!", ton: "attention" },
};

type NotificationAffichee = {
  id: string;
  type: TypeNotification;
  lue: boolean;
  creeLe: Date;
  annonce: { id: string; contenu: Contenu; debutUtc: Date } | null;
};

/**
 * Une notification : symbole de couleur, texte, date. Le lien passe par /notifications/[id],
 * qui la marque comme lue puis mène au raid concerné.
 */
export function LigneNotification({ n, fuseau }: { n: NotificationAffichee; fuseau: string }) {
  const style = STYLE[n.type];
  const contenu = (
    <>
      <span className={`notif-symbole ton-${style.ton}`} aria-hidden="true">
        {style.symbole}
      </span>
      <span className="notif-texte">{texteNotification(n.type, n.annonce, fuseau)}</span>
      <span className="notif-date">{afficherDate(n.creeLe, fuseau)}</span>
      {!n.lue && <span className="sr-only">(non lue)</span>}
    </>
  );
  return (
    <li className={`notification ${n.lue ? "" : "non-lue"}`}>
      {/* <a> simple (pas <Link>) : aucun préchargement ne doit marquer la notification comme lue. */}
      <a href={`/notifications/${n.id}`}>{contenu}</a>
    </li>
  );
}
