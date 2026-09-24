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
    <main>
      <p>
        <Link href="/">{d.commun.accueil}</Link>
      </p>
      <h1>
        {joueur.avatarUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={joueur.avatarUrl} alt="" width={40} height={40} style={{ verticalAlign: "middle" }} />
        )}{" "}
        {joueur.pseudo}
        {joueur.id === moi.id && d.commun.toiParenthese}
      </h1>

      {joueur.personnages.length > 0 && (
        <ul className="persos-profil">
          {joueur.personnages.map((p) => (
            <li key={p.id}>
              <ClasseIcone classe={p.classe} taille={26} />{" "}
              <span className="classe" style={{ "--c": `var(--classe-${p.classe})` } as React.CSSProperties}>
                {p.estPrincipal && "★ "}
                {nomEnJeu(p)}
              </span>{" "}
              <small>
                {d.classe[p.classe]} {p.niveau} · <FactionIcone faction={p.faction} taille={16} />{" "}
                {d.faction[p.faction]}
                {p.lienLogs && (
                  <>
                    {" · "}
                    <a href={p.lienLogs} target="_blank" rel="noopener noreferrer nofollow">
                      {d.commun.logs}
                    </a>
                  </>
                )}
              </small>
            </li>
          ))}
        </ul>
      )}

      <div className="faces">
        <section className="face">
          <h2>{d.profil.raidLeader}</h2>
          <p className="badge">
            <BadgeFiabilite fiabilite={fiabRl.get(joueur.id)} />
          </p>
          <dl>
            <dt>{d.profil.organises}</dt>
            <dd>{rl.organises}</dd>
            <dt>{d.profil.annulesTard}</dt>
            <dd className={rl.annulesDerniereMinute > 0 ? "alerte" : undefined}>{rl.annulesDerniereMinute}</dd>
          </dl>
        </section>

        <section className="face">
          <h2>{d.profil.mercenaire}</h2>
          <p className="badge">
            <BadgeFiabilite fiabilite={fiabMerc.get(joueur.id)} />
          </p>
          <dl>
            <dt>{d.profil.participes}</dt>
            <dd>{mercenaire.participes}</dd>
            <dt>{d.profil.absences}</dt>
            <dd className={mercenaire.absences > 0 ? "alerte" : undefined}>{mercenaire.absences}</dd>
            <dt>{d.profil.partisEnCours}</dt>
            <dd>{mercenaire.partisEnCours}</dd>
            <dt>{d.profil.distinctions}</dt>
            <dd>{mercenaire.distinctions > 0 ? `🏅 ${mercenaire.distinctions}` : 0}</dd>
          </dl>
        </section>
      </div>
      <p>
        <small>{d.profil.explication}</small>
      </p>

      <section className="carte historique" aria-labelledby="titre-historique">
        <h2 id="titre-historique">{d.profil.historique}</h2>
        {historique.length === 0 ? (
          <p className="doux">{d.profil.aucunHistorique}</p>
        ) : (
          <ul className="liste-historique">
            {historique.map((h) => {
              const a = h.annonce;
              const organise = h.type === "organise";
              return (
                <li key={h.cle} className={`prochain ${organise ? "ligne-organise" : ""}`}>
                  <Link href={`/annonces/${a.id}`} className="prochain-lien">
                    <strong>{a.titre ?? nomRaid(a.contenu, d)}</strong>
                    <span className="doux">
                      {a.titre && `${nomRaid(a.contenu, d)} · `}
                      {afficherDateCourte(a.debutUtc, moi.fuseauHoraire)}
                    </span>
                  </Link>
                  <div className="prochain-bas">
                    {organise ? (
                      <>
                        <span className="badge-raid badge-raid-organise">{d.profil.organise}</span>
                        {h.annule ? (
                          <span className="badge-raid badge-raid-absent">{d.profil.annule}</span>
                        ) : (
                          h.joueurs > 0 && <span className="doux">{d.profil.joueurs(h.joueurs)}</span>
                        )}
                      </>
                    ) : (
                      <>
                        <span className={`badge-raid badge-raid-${resultats[h.resultat].classe}`}>
                          {resultats[h.resultat].texte}
                        </span>
                        <ClasseIcone classe={h.personnage.classe} taille={18} />
                        <span className="doux">{nomEnJeu(h.personnage)}</span>
                        {h.distinction && <span title={d.profil.distingue}>🏅</span>}
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
