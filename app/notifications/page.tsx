import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { exigerUtilisateur } from "@/lib/session";
import { LigneNotification } from "./LigneNotification";
import { dicoCourant } from "@/lib/langue";

async function toutMarquerCommeLu() {
  "use server";
  const utilisateur = await exigerUtilisateur();
  await db.notification.updateMany({ where: { utilisateurId: utilisateur.id, lue: false }, data: { lue: true } });
  revalidatePath("/", "layout");
}

export default async function PageNotifications() {
  const utilisateur = await exigerUtilisateur();
  const notifications = await db.notification.findMany({
    where: { utilisateurId: utilisateur.id },
    orderBy: { creeLe: "desc" },
    take: 100,
    include: { annonce: { select: { id: true, contenu: true, debutUtc: true } } },
  });
  const nonLues = notifications.filter((n) => !n.lue).length;
  const d = await dicoCourant();

  return (
    <main>
      <header className="accueil-connecte">
        <p className="surtitre">{nonLues > 0 ? d.entete.nonLues(nonLues) : d.notifications.toutLu}</p>
        <h1>{d.notifications.titre}</h1>
        <div className="ornement" aria-hidden="true">
          ◆
        </div>
      </header>

      <section className="parchemin" aria-label={d.notifications.titre}>
        {nonLues > 0 && (
          <form action={toutMarquerCommeLu} className="notifications-actions">
            <button type="submit" className="petit">
              {d.notifications.toutMarquer}
            </button>
          </form>
        )}
        {notifications.length === 0 ? (
          <p className="doux centre">{d.notifications.aucune}</p>
        ) : (
          <ul className="liste-notifications">
            {notifications.map((n) => (
              <LigneNotification key={n.id} n={n} fuseau={utilisateur.fuseauHoraire} d={d} />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
