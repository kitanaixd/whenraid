import Image from "next/image";
import Link from "next/link";
import { signOut } from "@/lib/auth";
import { utilisateurConnecte } from "@/lib/session";
import { db } from "@/lib/db";
import { LANGUES } from "@/lib/i18n";
import { dicoCourant, langueCourante } from "@/lib/langue";
import { changerLangue } from "./actions-langue";
import { IconeCloche } from "./Icones";
import { MenuCompte } from "./MenuCompte";
import { Bannieres } from "./Bannieres";
import { LigneNotification } from "./notifications/LigneNotification";

/**
 * En-tête commun : logo et navigation à gauche ; à droite, le choix de la langue,
 * le bouton « Créer un raid », la cloche des notifications et le menu du compte.
 */
export async function EnTete() {
  const [utilisateur, langue, d] = await Promise.all([utilisateurConnecte(), langueCourante(), dicoCourant()]);
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

  // Choix de la langue : EN / FR, la langue active est mise en avant.
  const choixLangue = (
    <form action={changerLangue} className="choix-langue" aria-label={d.entete.changerLangue}>
      {LANGUES.map((l) => (
        <button
          key={l}
          type="submit"
          name="langue"
          value={l}
          className={`bouton-langue ${l === langue ? "active" : ""}`}
          aria-pressed={l === langue}
          lang={l}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </form>
  );

  return (
    <header className="en-tete">
      <div className="en-tete-contenu">
        <Link href="/" className="marque">
          <Image src="/logo.webp" alt="" width={38} height={31} priority />
          <span>WhenRaid</span>
        </Link>

        {utilisateur ? (
          <>
            <nav className="navigation" aria-label={d.entete.navigation}>
              <Link href="/">{d.entete.raids}</Link>
            </nav>
            <div className="compte">
              {choixLangue}
              <Link href="/annonces/nouvelle" className="bouton principal petit">
                {d.entete.creerRaid}
              </Link>
              {/* Aperçu des dernières notifications au survol (ou au focus clavier) de la cloche. */}
              <div className="zone-cloche">
                <Link
                  href="/notifications"
                  className={`cloche ${nonLues > 0 ? "a-lire" : ""}`}
                  aria-label={d.entete.notificationsNonLues(nonLues)}
                >
                  <IconeCloche />
                  {nonLues > 0 && <span className="compteur">{nonLues > 9 ? "9+" : nonLues}</span>}
                </Link>
                <div className="apercu-notifications">
                  <p className="surtitre">{nonLues > 0 ? d.entete.nonLues(nonLues) : d.entete.notifications}</p>
                  {dernieres.length === 0 ? (
                    <p className="doux centre">{d.entete.aucuneNotification}</p>
                  ) : (
                    <ul className="liste-notifications">
                      {dernieres.map((n) => (
                        <LigneNotification key={n.id} n={n} fuseau={utilisateur.fuseauHoraire} d={d} />
                      ))}
                    </ul>
                  )}
                  <Link href="/notifications" className="bouton petit">
                    {d.entete.voirToutes}
                  </Link>
                </div>
              </div>
              <MenuCompte pseudo={utilisateur.pseudo} avatarUrl={utilisateur.avatarUrl}>
                <Link href={`/joueurs/${utilisateur.id}`} role="menuitem">
                  {d.entete.monProfil}
                </Link>
                <Link href="/personnages" role="menuitem">
                  {d.entete.mesPersonnages}
                </Link>
                <form
                  action={async () => {
                    "use server";
                    await signOut({ redirectTo: "/" });
                  }}
                >
                  <button type="submit" role="menuitem" className="menu-compte-deconnexion">
                    {d.entete.deconnexion}
                  </button>
                </form>
              </MenuCompte>
            </div>
            <Bannieres />
          </>
        ) : (
          <div className="compte">{choixLangue}</div>
        )}
      </div>
    </header>
  );
}
