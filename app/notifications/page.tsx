import Link from "next/link";
import { revalidatePath } from "next/cache";
import type { TypeNotification } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { exigerUtilisateur } from "@/lib/session";
import { afficherDate } from "@/lib/dates";
import { texteNotification } from "@/lib/notifications";

async function toutMarquerCommeLu() {
  "use server";
  const utilisateur = await exigerUtilisateur();
  await db.notification.updateMany({ where: { utilisateurId: utilisateur.id, lue: false }, data: { lue: true } });
  revalidatePath("/", "layout");
}

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

export default async function PageNotifications() {
  const utilisateur = await exigerUtilisateur();
  const notifications = await db.notification.findMany({
    where: { utilisateurId: utilisateur.id },
    orderBy: { creeLe: "desc" },
    take: 100,
    include: { annonce: { select: { id: true, contenu: true, debutUtc: true } } },
  });
  const nonLues = notifications.filter((n) => !n.lue).length;

  return (
    <main>
      <header className="accueil-connecte">
        <p className="surtitre">{nonLues > 0 ? `${nonLues} non lue${nonLues > 1 ? "s" : ""}` : "Tout est lu"}</p>
        <h1>Notifications</h1>
        <div className="ornement" aria-hidden="true">
          ◆
        </div>
      </header>

      <section className="parchemin" aria-label="Notifications">
        {nonLues > 0 && (
          <form action={toutMarquerCommeLu} className="notifications-actions">
            <button type="submit" className="petit">
              Tout marquer comme lu
            </button>
          </form>
        )}
        {notifications.length === 0 ? (
          <p className="doux centre">Aucune notification pour l&apos;instant.</p>
        ) : (
          <ul className="liste-notifications">
            {notifications.map((n) => {
              const texte = texteNotification(n.type, n.annonce, utilisateur.fuseauHoraire);
              const style = STYLE[n.type];
              const contenu = (
                <>
                  <span className={`notif-symbole ton-${style.ton}`} aria-hidden="true">
                    {style.symbole}
                  </span>
                  <span className="notif-texte">{texte}</span>
                  <span className="notif-date">{afficherDate(n.creeLe, utilisateur.fuseauHoraire)}</span>
                  {!n.lue && <span className="sr-only">(non lue)</span>}
                </>
              );
              return (
                <li key={n.id} className={`notification ${n.lue ? "" : "non-lue"}`}>
                  {n.annonce ? <Link href={`/annonces/${n.annonce.id}`}>{contenu}</Link> : <div>{contenu}</div>}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
