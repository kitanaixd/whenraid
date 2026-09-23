import Link from "next/link";
import { signIn, signOut } from "@/lib/auth";
import { utilisateurConnecte } from "@/lib/session";

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
    </main>
  );
}
