import Link from "next/link";
import { signIn, signOut } from "@/lib/auth";
import { utilisateurConnecte } from "@/lib/session";
import { db } from "@/lib/db";
import { afficherDate } from "@/lib/dates";
import { nomRaid } from "@/lib/raids";
import { libelleFaction, libelleRole, libelleRuleset } from "@/lib/libelles";
import { chargerMesRaids } from "@/lib/mesRaids";

export default async function Accueil() {
  const utilisateur = await utilisateurConnecte();

  if (!utilisateur) {
    return (
      <main>
        <h1>WhenRaid</h1>
        <p>Trouve un raid qui cherche ta classe.</p>
        <form
          action={async () => {
            "use server";
            await signIn("discord", { redirectTo: "/" });
          }}
        >
          <button type="submit">Se connecter avec Discord</button>
        </form>
      </main>
    );
  }

  const annonces = await db.annonce.findMany({
    where: { statut: { in: ["PUBLIEE", "COMPLETE"] }, debutUtc: { gt: new Date() } },
    orderBy: { debutUtc: "asc" },
    take: 50,
    include: {
      createur: { select: { pseudo: true } },
      _count: { select: { places: { where: { statut: "OUVERTE" } } } },
    },
  });

  const { convocations, candidatures, organises: mesRaids } = await chargerMesRaids(utilisateur.id);
  const fuseau = utilisateur.fuseauHoraire;

  return (
    <main>
      {(convocations.length > 0 || candidatures.length > 0 || mesRaids.length > 0) && (
        <section className="encadre" aria-labelledby="titre-mes-raids">
          <h2 id="titre-mes-raids" style={{ marginTop: 0 }}>
            Tes raids
          </h2>
          {convocations.map((i) => (
            <p key={i.id}>
              ✔ <strong>Convié</strong> :{" "}
              <Link href={`/annonces/${i.place.annonce.id}`}>{nomRaid(i.place.annonce.contenu)}</Link> —{" "}
              <strong>{afficherDate(i.place.annonce.debutUtc, fuseau)}</strong> avec <strong>{i.personnage?.nom}</strong>
              {i.role && ` (${libelleRole[i.role]})`}
            </p>
          ))}
          {mesRaids.map((a) => (
            <p key={a.id}>
              ★ <strong>Tu organises</strong> :{" "}
              <Link href={`/annonces/${a.id}`}>{nomRaid(a.contenu)}</Link> — {afficherDate(a.debutUtc, fuseau)}
              {a.statut === "COMPLETE" && " (complet)"}
            </p>
          ))}
          {candidatures.length > 0 && (
            <>
              <p>
                <small>Candidatures en attente :</small>
              </p>
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
      <h1>WhenRaid</h1>
      <p>
        {utilisateur.avatarUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={utilisateur.avatarUrl} alt="" width={32} height={32} />
        )}{" "}
        Connecté en tant que <strong>{utilisateur.pseudo}</strong>
      </p>
      <nav>
        <Link href="/personnages">Mes personnages</Link> · <Link href="/annonces/nouvelle">Créer un raid</Link>
      </nav>
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/" });
        }}
      >
        <button type="submit">Se déconnecter</button>
      </form>

      <h2>Raids à venir</h2>
      {annonces.length === 0 ? (
        <p>Aucun raid publié pour l&apos;instant.</p>
      ) : (
        <ul>
          {annonces.map((a) => (
            <li key={a.id}>
              <Link href={`/annonces/${a.id}`}>
                {nomRaid(a.contenu)} — {afficherDate(a.debutUtc, utilisateur.fuseauHoraire)}
              </Link>{" "}
              · {libelleFaction[a.faction]} {libelleRuleset[a.ruleset]} {a.region} ·{" "}
              {a.statut === "COMPLETE"
                ? "complet (liste d'attente)"
                : `${a._count.places} place${a._count.places > 1 ? "s" : ""} ouverte${a._count.places > 1 ? "s" : ""}`}{" "}
              · par {a.createur.pseudo}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
