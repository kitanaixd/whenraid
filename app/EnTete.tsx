import Image from "next/image";
import Link from "next/link";
import { signOut } from "@/lib/auth";
import { utilisateurConnecte } from "@/lib/session";
import { db } from "@/lib/db";

/** En-tête commun : logo, navigation, cloche de notifications et compte. */
export async function EnTete() {
  const utilisateur = await utilisateurConnecte();
  const nonLues = utilisateur
    ? await db.notification.count({ where: { utilisateurId: utilisateur.id, lue: false } })
    : 0;

  return (
    <header className="en-tete">
      <div className="en-tete-contenu">
        <Link href="/" className="marque">
          <Image src="/logo.webp" alt="" width={38} height={31} priority />
          <span>WhenRaid</span>
        </Link>

        {utilisateur && (
          <>
            <nav className="navigation" aria-label="Navigation principale">
              <Link href="/">Raids</Link>
              <Link href="/annonces/nouvelle">Créer un raid</Link>
              <Link href="/personnages">Mes personnages</Link>
              <Link href={`/joueurs/${utilisateur.id}`}>Mon profil</Link>
            </nav>
            <div className="compte">
              <Link
                href="/notifications"
                className="cloche"
                aria-label={`Notifications : ${nonLues} non lue${nonLues > 1 ? "s" : ""}`}
              >
                🔔{nonLues > 0 && <span className="compteur">{nonLues}</span>}
              </Link>
              {utilisateur.avatarUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={utilisateur.avatarUrl} alt="" width={30} height={30} />
              )}
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/" });
                }}
              >
                <button type="submit" className="bouton-lien" title={`Connecté en tant que ${utilisateur.pseudo}`}>
                  Déconnexion
                </button>
              </form>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
