import Link from "next/link";
import { db } from "@/lib/db";
import { exigerUtilisateur } from "@/lib/session";
import { dicoCourant } from "@/lib/langue";
import { mesGroupes, rolesDuPerso } from "@/lib/groupes";
import { nomEnJeu } from "@/lib/jeu";
import { ClasseIcone } from "@/app/ClasseIcone";
import { BoutonEnvoi } from "@/app/BoutonEnvoi";
import { ChoixPersoRoles } from "./ChoixPersoRoles";
import { creerGroupe } from "./actions";

export default async function PageGroupes({ searchParams }: PageProps<"/groupes">) {
  const utilisateur = await exigerUtilisateur();
  const d = await dicoCourant();
  const { erreur } = await searchParams;
  const [groupes, personnages] = await Promise.all([
    mesGroupes(utilisateur.id),
    db.personnage.findMany({
      where: { utilisateurId: utilisateur.id, supprimeLe: null },
      orderBy: [{ estPrincipal: "desc" }, { nom: "asc" }],
    }),
  ]);
  const persos = personnages.map((p) => ({ id: p.id, nom: nomEnJeu(p), classe: p.classe, roles: rolesDuPerso(p) }));

  return (
    <main className="page-groupes">
      <p>
        <Link href="/">{d.commun.accueil}</Link>
      </p>
      <h1>{d.groupes.titre}</h1>
      <p className="doux">{d.groupes.intro}</p>
      {typeof erreur === "string" && (
        <p className="avertissement grave" role="alert">
          ⚠ {erreur}
        </p>
      )}

      {groupes.length === 0 ? (
        <p className="doux">{d.groupes.aucun}</p>
      ) : (
        <ul className="liste-groupes">
          {groupes.map((g) => (
            <li key={g.id} className="carte groupe-carte">
              <div>
                <strong>{g.nom}</strong>
                <span className="doux">
                  {d.groupes.membres(g.membres.length)}
                  {g.chefId === utilisateur.id && ` · ${d.groupes.chef}`}
                </span>
              </div>
              <div className="groupe-icones">
                {g.membres.map((m) => (
                  <span key={m.id} title={`${nomEnJeu(m.personnage)} (${m.utilisateur.pseudo})`}>
                    <ClasseIcone classe={m.personnage.classe} taille={26} />
                  </span>
                ))}
              </div>
              <Link href={`/groupes/${g.id}`} className="bouton petit">
                {d.groupes.gerer}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <section className="carte" aria-labelledby="titre-nouveau-groupe">
        <p className="surtitre" id="titre-nouveau-groupe">
          {d.groupes.creerTitre}
        </p>
        {persos.length === 0 ? (
          <p className="doux">
            {d.raid.declarePersoAvant} <Link href="/personnages">{d.raid.unPersonnage}</Link>.
          </p>
        ) : (
          <form action={creerGroupe} className="formulaire">
            <label className="champ">
              {d.champ.nomGroupe}
              <input name="nom" required maxLength={24} placeholder={d.groupes.nomPlaceholder} autoComplete="off" />
            </label>
            <ChoixPersoRoles persos={persos} />
            <BoutonEnvoi className="principal" enCours={d.commun.enregistrement}>
              {d.groupes.creer}
            </BoutonEnvoi>
          </form>
        )}
      </section>
    </main>
  );
}
