import Image from "next/image";
import Link from "next/link";
import { signOut } from "@/lib/auth";
import { utilisateurConnecte } from "@/lib/session";
import { db } from "@/lib/db";
import { IconeCloche } from "./Icones";
import { MenuCompte } from "./MenuCompte";
import { LigneNotification } from "./notifications/LigneNotification";

/**
 * En-tête commun : logo et navigation à gauche ; à droite, le bouton « Créer un raid »,
 * la cloche des notifications et le menu du compte (profil, personnages, déconnexion).
 */
export async function EnTete() {
  const utilisateur = await utilisateurConnecte();
  const [nonLues, dernieres] = utilisateur
    ? await Promise.all([
        db.notification.count({ where: { utilisateurId: utilisateur.id, lue: false } }),
        db.notification.findMany({
          where: { utilisateurId: utilisateur.id },
          orderBy: { creeLe: "desc" },
          take: 5,
          include: { annonce: { select: { id: true, contenu: true, debutUtc: true } } },
        }),
      ])
    : [0, []];

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
            </nav>
            <div className="compte">
              <Link href="/annonces/nouvelle" className="bouton principal petit">
                Créer un raid
              </Link>
              {/* Aperçu des dernières notifications au survol (ou au focus clavier) de la cloche. */}
              <div className="zone-cloche">
                <Link
                  href="/notifications"
                  className={`cloche ${nonLues > 0 ? "a-lire" : ""}`}
                  aria-label={`Notifications : ${nonLues} non lue${nonLues > 1 ? "s" : ""}`}
                >
                  <IconeCloche />
                  {nonLues > 0 && <span className="compteur">{nonLues > 9 ? "9+" : nonLues}</span>}
                </Link>
                <div className="apercu-notifications">
                  <p className="surtitre">
                    {nonLues > 0 ? `${nonLues} non lue${nonLues > 1 ? "s" : ""}` : "Notifications"}
                  </p>
                  {dernieres.length === 0 ? (
                    <p className="doux centre">Aucune notification pour l&apos;instant.</p>
                  ) : (
                    <ul className="liste-notifications">
                      {dernieres.map((n) => (
                        <LigneNotification key={n.id} n={n} fuseau={utilisateur.fuseauHoraire} />
                      ))}
                    </ul>
                  )}
                  <Link href="/notifications" className="bouton petit">
                    Voir toutes les notifications
                  </Link>
                </div>
              </div>
              <MenuCompte pseudo={utilisateur.pseudo} avatarUrl={utilisateur.avatarUrl}>
                <Link href={`/joueurs/${utilisateur.id}`} role="menuitem">
                  Mon profil
                </Link>
                <Link href="/personnages" role="menuitem">
                  Mes personnages
                </Link>
                <form
                  action={async () => {
                    "use server";
                    await signOut({ redirectTo: "/" });
                  }}
                >
                  <button type="submit" role="menuitem" className="menu-compte-deconnexion">
                    Déconnexion
                  </button>
                </form>
              </MenuCompte>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
