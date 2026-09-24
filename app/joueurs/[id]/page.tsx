import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { exigerUtilisateur } from "@/lib/session";
import { historiqueRaids, statsMercenaire, statsRl } from "@/lib/profil";
import { afficherDateCourte } from "@/lib/dates";
import { nomRaid } from "@/lib/raids";
import { nomEnJeu } from "@/lib/invitations";
import { ClasseIcone, FactionIcone } from "@/app/ClasseIcone";
import { fiabiliteMercenaires, fiabiliteRls } from "@/lib/fiabilite";
import { BadgeFiabilite } from "@/app/BadgeFiabilite";
import { dicoCourant } from "@/lib/langue";

/** Une statistique en tuile : le chiffre en grand, son libellé dessous. */
function Tuile({ valeur, libelle, alerte = false }: { valeur: React.ReactNode; libelle: string; alerte?: boolean }) {
  return (
    <div className={alerte ? "alerte" : undefined}>
      <strong>{valeur}</strong>
      <small>{libelle}</small>
    </div>
  );
}

export default async function PageJoueur({ params }: PageProps<"/joueurs/[id]">) {
  const moi = await exigerUtilisateur();
  const d = await dicoCourant();
  const { id } = await params;
  const joueur = await db.utilisateur.findUnique({
    where: { id },
    include: { personnages: { where: { supprimeLe: null }, orderBy: [{ estPrincipal: "desc" }, { nom: "asc" }] } },
  });
  if (!joueur) notFound();

  const [rl, mercenaire, fiabRl, fiabMerc, historique] = await Promise.all([
    statsRl(joueur.id),
    statsMercenaire(joueur.id),
    fiabiliteRls([joueur.id]),
    fiabiliteMercenaires([joueur.id]),
    historiqueRaids(joueur.id),
  ]);
  // Résultat de la feuille de présence : couleur de l'étiquette et libellé.
  const resultats = {
    PRESENT: { classe: "convie", texte: d.raid.present },
    PARTI_EN_COURS: { classe: "attente", texte: d.raid.partiEnCours },
    ABSENT: { classe: "absent", texte: d.raid.absent },
    ANNULE_A_TEMPS: { classe: "attente", texte: d.profil.annule },
  } as const;

  return (
    <main className="profil">
      <p>
        <Link href="/">{d.commun.accueil}</Link>
      </p>

      <section className="carte profil-identite">
        <div className="profil-titre">
          {joueur.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={joueur.avatarUrl} alt="" width={56} height={56} className="profil-avatar" />
          ) : (
            <span className="profil-avatar avatar-vide" aria-hidden="true">
              {joueur.pseudo.charAt(0).toUpperCase()}
            </span>
          )}
          <h1>
            {joueur.pseudo}
            {joueur.id === moi.id && <small>{d.commun.toiParenthese}</small>}
          </h1>
        </div>
        {joueur.personnages.length > 0 && (
          <>
            <p className="surtitre">{d.profil.personnages}</p>
            <ul className="persos-profil">
              {joueur.personnages.map((p) => (
                <li key={p.id} className="perso-profil">
                  <ClasseIcone classe={p.classe} taille={34} />
                  <div>
                    <strong className="classe" style={{ "--c": `var(--classe-${p.classe})` } as React.CSSProperties}>
                      {p.estPrincipal && "★ "}
                      {nomEnJeu(p)}
                    </strong>
                    <span className="doux">
                      {d.classe[p.classe]} {p.niveau} · <FactionIcone faction={p.faction} taille={14} />{" "}
                      {d.faction[p.faction]}
                      {p.lienLogs && (
                        <>
                          {" · "}
                          <a href={p.lienLogs} target="_blank" rel="noopener noreferrer nofollow">
                            {d.commun.logs}
                          </a>
                        </>
                      )}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <div className="faces">
        <section className="carte face">
          <div className="face-titre">
            <h2>{d.profil.raidLeader}</h2>
            <BadgeFiabilite fiabilite={fiabRl.get(joueur.id)} />
          </div>
          <div className="tuiles-stats">
            <Tuile valeur={rl.organises} libelle={d.profil.organises} />
            <Tuile
              valeur={rl.annulesDerniereMinute}
              libelle={d.profil.annulesTard}
              alerte={rl.annulesDerniereMinute > 0}
            />
            <Tuile valeur={rl.retiresTard} libelle={d.profil.retiresTard} alerte={rl.retiresTard > 0} />
          </div>
        </section>

        <section className="carte face">
          <div className="face-titre">
            <h2>{d.profil.mercenaire}</h2>
            <BadgeFiabilite fiabilite={fiabMerc.get(joueur.id)} />
          </div>
          <div className="tuiles-stats">
            <Tuile valeur={mercenaire.participes} libelle={d.profil.participes} />
            <Tuile valeur={mercenaire.absences} libelle={d.profil.absences} alerte={mercenaire.absences > 0} />
            <Tuile valeur={mercenaire.partisEnCours} libelle={d.profil.partisEnCours} />
            <Tuile
              valeur={mercenaire.distinctions > 0 ? `🏅 ${mercenaire.distinctions}` : 0}
              libelle={d.profil.distinctions}
            />
          </div>
        </section>
      </div>
      <p className="doux explication-fiabilite">{d.profil.explication}</p>

      <section className="carte historique" aria-labelledby="titre-historique">
        <p className="surtitre" id="titre-historique">
          {d.profil.historique}
        </p>
        {historique.length === 0 ? (
          <p className="doux">{d.profil.aucunHistorique}</p>
        ) : (
          <ul className="liste-historique">
            {historique.map((h) => {
              const a = h.annonce;
              const organise = h.type === "organise";
              return (
                <li key={h.cle} className={`ligne-historique ${organise ? "ligne-organise" : ""}`}>
                  <Link href={`/annonces/${a.id}`} className="historique-raid">
                    <strong>{a.titre ?? nomRaid(a.contenu, d)}</strong>
                    <span className="doux">
                      {a.titre && `${nomRaid(a.contenu, d)} · `}
                      {afficherDateCourte(a.debutUtc, moi.fuseauHoraire)}
                    </span>
                  </Link>
                  <div className="historique-detail">
                    {organise ? (
                      <>
                        {h.annule ? (
                          <span className="badge-raid badge-raid-absent">{d.profil.annule}</span>
                        ) : (
                          h.joueurs > 0 && <span className="doux">{d.profil.joueurs(h.joueurs)}</span>
                        )}
                        <span className="badge-raid badge-raid-organise">{d.profil.organise}</span>
                      </>
                    ) : (
                      <>
                        {h.distinction && <span title={d.profil.distingue}>🏅</span>}
                        <ClasseIcone classe={h.personnage.classe} taille={20} />
                        <span className="doux">{nomEnJeu(h.personnage)}</span>
                        <span className={`badge-raid badge-raid-${resultats[h.resultat].classe}`}>
                          {resultats[h.resultat].texte}
                        </span>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
