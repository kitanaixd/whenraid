import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { exigerUtilisateur } from "@/lib/session";
import { LigneNotification } from "./LigneNotification";

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
            {notifications.map((n) => (
              <LigneNotification key={n.id} n={n} fuseau={utilisateur.fuseauHoraire} />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
