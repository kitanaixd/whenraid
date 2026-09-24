import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { exigerUtilisateur } from "@/lib/session";
import { statsMercenaire, statsRl } from "@/lib/profil";
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

  const [rl, mercenaire, fiabRl, fiabMerc] = await Promise.all([
    statsRl(joueur.id),
    statsMercenaire(joueur.id),
    fiabiliteRls([joueur.id]),
    fiabiliteMercenaires([joueur.id]),
  ]);

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
    </main>
  );
}
