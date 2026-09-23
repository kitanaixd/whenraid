import Link from "next/link";
import { signIn, signOut } from "@/lib/auth";
import { utilisateurConnecte } from "@/lib/session";
import { db } from "@/lib/db";
import { afficherDate } from "@/lib/dates";
import { raids } from "@/lib/raids";
import { libelleFaction, libelleRuleset } from "@/lib/libelles";

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
    where: { statut: "PUBLIEE", debutUtc: { gt: new Date() } },
    orderBy: { debutUtc: "asc" },
    take: 50,
    include: {
      createur: { select: { pseudo: true } },
      _count: { select: { places: { where: { statut: "OUVERTE" } } } },
    },
  });

  return (
    <main>
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
                {raids[a.contenu].nom} — {afficherDate(a.debutUtc, utilisateur.fuseauHoraire)}
              </Link>{" "}
              · {libelleFaction[a.faction]} {libelleRuleset[a.ruleset]} {a.region} · {a._count.places} place
              {a._count.places > 1 ? "s" : ""} ouverte{a._count.places > 1 ? "s" : ""} · par {a.createur.pseudo}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
