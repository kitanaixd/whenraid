import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

/** La cloche de notifications, affichée en haut de chaque page pour un joueur connecté. */
export async function Cloche() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const nonLues = await db.notification.count({ where: { utilisateurId: session.user.id, lue: false } });

  return (
    <p className="cloche">
      <Link href="/notifications" aria-label={`Notifications : ${nonLues} non lue${nonLues > 1 ? "s" : ""}`}>
        🔔{nonLues > 0 && <span className="compteur">{nonLues}</span>}
      </Link>
    </p>
  );
}
