import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { exigerUtilisateur } from "@/lib/session";
import { statsMercenaire, statsRl } from "@/lib/profil";
import { libelleClasse, libelleFaction } from "@/lib/libelles";
import { nomEnJeu } from "@/lib/invitations";
import { ClasseIcone, FactionIcone } from "@/app/ClasseIcone";
import { fiabiliteMercenaires, fiabiliteRls, texteBadge } from "@/lib/fiabilite";

export default async function PageJoueur({ params }: PageProps<"/joueurs/[id]">) {
  const moi = await exigerUtilisateur();
  const { id } = await params;
  const joueur = await db.utilisateur.findUnique({
    where: { id },
    include: { personnages: { where: { supprimeLe: null }, orderBy: [{ estPrincipal: "desc" }, { nom: "asc" }] } },
  });
  if (!joueur) notFound();

  const [rl, mercenaire, fiabRl, fiabMerc] = await Promise.all([
    statsRl(joueur.id),
    statsMercenaire(joueur.id),
    fiabiliteRls([joueur.id]),
    fiabiliteMercenaires([joueur.id]),
  ]);

  return (
    <main>
      <p>
        <Link href="/">← Accueil</Link>
      </p>
      <h1>
        {joueur.avatarUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={joueur.avatarUrl} alt="" width={40} height={40} style={{ verticalAlign: "middle" }} />
        )}{" "}
        {joueur.pseudo}
        {joueur.id === moi.id && " (toi)"}
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
                {libelleClasse[p.classe]} {p.niveau} · <FactionIcone faction={p.faction} taille={16} />{" "}
                {libelleFaction[p.faction]}
                {p.lienLogs && (
                  <>
                    {" · "}
                    <a href={p.lienLogs} target="_blank" rel="noopener noreferrer nofollow">
                      Logs ↗
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
          <h2>🛡️ Raid Leader</h2>
          <p className="badge">{texteBadge(fiabRl.get(joueur.id)!)}</p>
          <dl>
            <dt>Raids organisés</dt>
            <dd>{rl.organises}</dd>
            <dt>Annulés à moins de 2 h du début</dt>
            <dd className={rl.annulesDerniereMinute > 0 ? "alerte" : undefined}>{rl.annulesDerniereMinute}</dd>
          </dl>
        </section>

        <section className="face">
          <h2>⚔️ Mercenaire</h2>
          <p className="badge">{texteBadge(fiabMerc.get(joueur.id)!)}</p>
          <dl>
            <dt>Raids participés</dt>
            <dd>{mercenaire.participes}</dd>
            <dt>Absences</dt>
            <dd className={mercenaire.absences > 0 ? "alerte" : undefined}>{mercenaire.absences}</dd>
            <dt>Partis en cours de raid</dt>
            <dd>{mercenaire.partisEnCours}</dd>
            <dt>Distinctions</dt>
            <dd>{mercenaire.distinctions > 0 ? `🏅 ${mercenaire.distinctions}` : 0}</dd>
          </dl>
        </section>
      </div>
      <p>
        <small>La fiabilité est recalculée à chaque visite : chaque raid compte (présent 1, parti en cours ½, absent 0 ;
          raid tenu 1, annulé à moins de 2 h 0), les plus récents pèsent davantage, et chacun démarre à 80 %.</small>
      </p>
    </main>
  );
}
