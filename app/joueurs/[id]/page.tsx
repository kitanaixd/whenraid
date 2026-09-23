import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { exigerUtilisateur } from "@/lib/session";
import { statsMercenaire, statsRl } from "@/lib/profil";
import { libelleClasse, libelleFaction } from "@/lib/libelles";
import { nomEnJeu } from "@/lib/invitations";

export default async function PageJoueur({ params }: PageProps<"/joueurs/[id]">) {
  const moi = await exigerUtilisateur();
  const { id } = await params;
  const joueur = await db.utilisateur.findUnique({
    where: { id },
    include: { personnages: { orderBy: [{ estPrincipal: "desc" }, { nom: "asc" }] } },
  });
  if (!joueur) notFound();

  const [rl, mercenaire] = await Promise.all([statsRl(joueur.id), statsMercenaire(joueur.id)]);

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
        <p>
          {joueur.personnages
            .map((p) => `${p.estPrincipal ? "★ " : ""}${nomEnJeu(p)} (${libelleClasse[p.classe]} ${p.niveau}, ${libelleFaction[p.faction]})`)
            .join(" · ")}
        </p>
      )}

      <div className="faces">
        <section className="face">
          <h2>🛡️ Face RL</h2>
          <dl>
            <dt>Raids organisés</dt>
            <dd>{rl.organises}</dd>
            <dt>Annulés à moins de 2 h du début</dt>
            <dd className={rl.annulesDerniereMinute > 0 ? "alerte" : undefined}>{rl.annulesDerniereMinute}</dd>
          </dl>
        </section>

        <section className="face">
          <h2>⚔️ Face Mercenaire</h2>
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
        <small>Ces chiffres sont recalculés à chaque visite à partir des raids et des présences validées par les RL.</small>
      </p>
    </main>
  );
}
