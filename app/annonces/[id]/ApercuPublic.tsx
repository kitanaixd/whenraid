import { notFound } from "next/navigation";
import { signIn } from "@/lib/auth";
import { apercuRaid, dateApercu, rechercheApercu } from "@/lib/apercu";
import { dicoCourant, langueCourante } from "@/lib/langue";
import { nomRaid, raids } from "@/lib/raids";
import { PastilleFaction, PastilleRuleset } from "@/app/ClasseIcone";
import { GrilleRaid } from "../nouvelle/GrilleRaid";

/**
 * Page d'un raid pour un visiteur non connecté (arrivé par un lien partagé) : l'essentiel
 * du raid, sans aucun nom de joueur, et la connexion Discord qui ramène sur ce raid.
 */
export async function ApercuPublic({ id }: { id: string }) {
  const [a, d, langue] = await Promise.all([apercuRaid(id), dicoCourant(), langueCourante()]);
  if (!a) notFound();
  const recherche = rechercheApercu(a, d);

  return (
    <main data-fond={raids[a.contenu].image}>
      <header className="entete-raid">
        <p className="surtitre">
          {d.faction[a.faction]} · {d.ruleset[a.ruleset]} {a.region}
        </p>
        <h1>{a.titre ?? nomRaid(a.contenu, d)}</h1>
        <div className="ornement" aria-hidden="true">
          ◆
        </div>
        <p className="quand-raid">
          {a.titre && `${nomRaid(a.contenu, d)} · `}
          {dateApercu(a.debutUtc, a.region, langue)}
          {a.dureeEstimee && <span className="doux">{d.raid.environ(a.dureeEstimee / 60)}</span>}
        </p>
        <div className="pastilles centre">
          <PastilleFaction faction={a.faction} />
          <PastilleRuleset ruleset={a.ruleset} region={a.region} />
          <span className="pastille">{d.raid.loot(d.reglesLoot[a.reglesLoot])}</span>
          <span className="pastille">{d.apercu.organisePar(a.organisateur.nom)}</span>
        </div>
        <div className="grille-entete">
          <GrilleRaid taille={a.taille} cases={a.cases} />
        </div>
      </header>

      <section className="carte apercu-public">
        <p className="surtitre">{d.apercu.joueurs(a.joueurs, a.taille)}</p>
        {a.statut === "ANNULEE" ? (
          <p>{d.apercu.annule}</p>
        ) : a.ouvertes === 0 ? (
          <p>{d.apercu.complet}</p>
        ) : (
          recherche && <p className="apercu-recherche">{d.apercu.rechercheTexte(recherche)}</p>
        )}
        <p className="doux">{d.apercu.connecte}</p>
        <form
          action={async () => {
            "use server";
            await signIn("discord", { redirectTo: `/annonces/${encodeURIComponent(id)}` });
          }}
        >
          <button type="submit" className="principal">
            {d.apercu.candidater}
          </button>
        </form>
        <p className="doux">
          <small>{d.apercu.heureServeur}</small>
        </p>
      </section>
    </main>
  );
}
