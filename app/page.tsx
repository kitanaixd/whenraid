import Image from "next/image";
import Link from "next/link";
import { signIn } from "@/lib/auth";
import { utilisateurConnecte } from "@/lib/session";
import { db } from "@/lib/db";
import { afficherDate } from "@/lib/dates";
import { nomRaid } from "@/lib/raids";
import { libelleFaction, libelleRole, libelleRuleset } from "@/lib/libelles";
import { chargerMesRaids } from "@/lib/mesRaids";
import { fiabiliteRls, texteBadge } from "@/lib/fiabilite";

export default async function Accueil() {
  const utilisateur = await utilisateurConnecte();

  if (!utilisateur) {
    return (
      <main className="accueil-visiteur">
        <Image src="/logo.webp" alt="Logo WhenRaid" width={315} height={256} priority />
        <p className="surtitre">Le rendez-vous des raids de WoW Forever</p>
        <h1>WhenRaid</h1>
        <div className="ornement" aria-hidden="true">◆</div>
        <p className="accroche">
          Ton groupe cherche un soigneur pour ce soir ? Tu cherches un raid qui a besoin de ta classe ? Trouvez-vous
          en quelques clics.
        </p>
        <form
          action={async () => {
            "use server";
            await signIn("discord", { redirectTo: "/" });
          }}
        >
          <button type="submit" className="principal">
            Se connecter avec Discord
          </button>
        </form>
        <p>
          <small>En te connectant, tu rejoins le serveur Discord WhenRaid, qui t&apos;envoie tes convocations.</small>
        </p>
      </main>
    );
  }

  const [annonces, mesRaids] = await Promise.all([
    db.annonce.findMany({
      where: { statut: { in: ["PUBLIEE", "COMPLETE"] }, debutUtc: { gt: new Date() } },
      orderBy: { debutUtc: "asc" },
      take: 50,
      include: {
        createur: { select: { pseudo: true } },
        _count: { select: { places: { where: { statut: "OUVERTE" } } } },
      },
    }),
    chargerMesRaids(utilisateur.id),
  ]);
  const { convocations, candidatures, organises } = mesRaids;
  const fiabilite = await fiabiliteRls([...new Set(annonces.map((a) => a.createurId))]);
  const fuseau = utilisateur.fuseauHoraire;

  return (
    <main>
      <header className="accueil-connecte">
        <p className="surtitre">WoW Forever · {utilisateur.pseudo}</p>
        <h1>Trouve ton prochain raid</h1>
        <div className="ornement" aria-hidden="true">◆</div>
      </header>

      {(convocations.length > 0 || candidatures.length > 0 || organises.length > 0) && (
        <section className="encadre" aria-labelledby="titre-mes-raids">
          <h2 id="titre-mes-raids">Tes raids</h2>
          {convocations.map((i) => (
            <p key={i.id}>
              ✔ <strong>Convié</strong> :{" "}
              <Link href={`/annonces/${i.place.annonce.id}`}>{nomRaid(i.place.annonce.contenu)}</Link> —{" "}
              <strong>{afficherDate(i.place.annonce.debutUtc, fuseau)}</strong> avec <strong>{i.personnage?.nom}</strong>
              {i.role && ` (${libelleRole[i.role]})`}
            </p>
          ))}
          {organises.map((a) => (
            <p key={a.id}>
              ★ <strong>Tu organises</strong> : <Link href={`/annonces/${a.id}`}>{nomRaid(a.contenu)}</Link> —{" "}
              {afficherDate(a.debutUtc, fuseau)}
              {a.statut === "COMPLETE" && " (complet)"}
            </p>
          ))}
          {candidatures.length > 0 && (
            <>
              <p className="doux">Candidatures en attente :</p>
              <ul>
                {candidatures.map((i) => (
                  <li key={i.id}>
                    <Link href={`/annonces/${i.place.annonce.id}`}>{nomRaid(i.place.annonce.contenu)}</Link> —{" "}
                    {afficherDate(i.place.annonce.debutUtc, fuseau)} avec {i.personnage?.nom}
                    {i.statut === "LISTE_ATTENTE" && " (liste d'attente)"}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      <section className="parchemin" aria-labelledby="titre-raids">
        <p className="surtitre">Ce soir et les jours à venir</p>
        <h2 id="titre-raids">Raids qui recrutent</h2>
        {annonces.length === 0 ? (
          <p className="doux">
            Aucun raid publié pour l&apos;instant. <Link href="/annonces/nouvelle">Crée le premier !</Link>
          </p>
        ) : (
          <ul className="grille-cartes">
            {annonces.map((a) => (
              <li key={a.id} className="carte carte-raid">
                <h3>
                  <Link href={`/annonces/${a.id}`}>{nomRaid(a.contenu)}</Link>
                </h3>
                <span className="quand">{afficherDate(a.debutUtc, fuseau)}</span>
                <span>
                  <span className={`pastille ${a.faction === "HORDE" ? "horde" : "alliance"}`}>
                    {libelleFaction[a.faction]}
                  </span>{" "}
                  <span className="pastille">
                    {libelleRuleset[a.ruleset]} {a.region}
                  </span>{" "}
                  {a.statut === "COMPLETE" ? (
                    <span className="pastille complet">Complet · liste d&apos;attente</span>
                  ) : (
                    <span className="pastille ouvert">
                      {a._count.places} place{a._count.places > 1 ? "s" : ""} ouverte{a._count.places > 1 ? "s" : ""}
                    </span>
                  )}
                </span>
                <small>
                  par {a.createur.pseudo} · {texteBadge(fiabilite.get(a.createurId)!)}
                </small>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
