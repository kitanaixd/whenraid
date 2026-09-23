import Link from "next/link";
import { revalidatePath } from "next/cache";
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
      <p>
        <Link href="/">← Accueil</Link>
      </p>
      <h1>Notifications</h1>
      {nonLues > 0 && (
        <form action={toutMarquerCommeLu}>
          <button type="submit">Tout marquer comme lu</button>
        </form>
      )}
      {notifications.length === 0 ? (
        <p>Aucune notification pour l&apos;instant.</p>
      ) : (
        <ul>
          {notifications.map((n) => {
            const texte = texteNotification(n.type, n.annonce, utilisateur.fuseauHoraire);
            return (
              <li key={n.id} style={{ fontWeight: n.lue ? "normal" : "bold" }}>
                {n.annonce ? <Link href={`/annonces/${n.annonce.id}`}>{texte}</Link> : texte}{" "}
                <small>— {afficherDate(n.creeLe, utilisateur.fuseauHoraire)}</small>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
