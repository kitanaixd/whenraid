import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { exigerUtilisateur } from "@/lib/session";
import { dicoCourant } from "@/lib/langue";
import { groupeHomogene, MAX_MEMBRES, monGroupe, rolesDuPerso } from "@/lib/groupes";
import { nomEnJeu } from "@/lib/jeu";
import { URL_SITE } from "@/lib/site";
import { ClasseIcone, FactionIcone, NomRole } from "@/app/ClasseIcone";
import { BoutonEnvoi } from "@/app/BoutonEnvoi";
import { ChoixPersoRoles } from "../ChoixPersoRoles";
import { BoutonCopier } from "../BoutonCopier";
import { modifierMonPerso, quitterGroupe, retirerMembre, supprimerGroupe } from "../actions";

export default async function PageGroupe({ params, searchParams }: PageProps<"/groupes/[id]">) {
  const utilisateur = await exigerUtilisateur();
  const d = await dicoCourant();
  const { id } = await params;
  const { erreur } = await searchParams;
  const groupe = await monGroupe(id, utilisateur.id);
  if (!groupe) notFound();
  const estChef = groupe.chefId === utilisateur.id;
  const moi = groupe.membres.find((m) => m.utilisateurId === utilisateur.id)!;
  const personnages = await db.personnage.findMany({
    where: { utilisateurId: utilisateur.id, supprimeLe: null },
    orderBy: [{ estPrincipal: "desc" }, { nom: "asc" }],
  });
  const persos = personnages.map((p) => ({ id: p.id, nom: nomEnJeu(p), classe: p.classe, roles: rolesDuPerso(p) }));
  const lien = `${URL_SITE}/groupes/rejoindre/${groupe.code}`;

  return (
    <main className="page-groupes">
      <p>
        <Link href="/groupes">{d.groupes.retour}</Link>
      </p>
      <h1>{groupe.nom}</h1>
      <p className="doux">
        {d.groupes.membres(groupe.membres.length)} / {MAX_MEMBRES} · {d.groupes.toutOuRien}
      </p>
      {typeof erreur === "string" && (
        <p className="avertissement grave" role="alert">
          ⚠ {erreur}
        </p>
      )}
      {groupe.membres.length > 1 && !groupeHomogene(groupe.membres) && (
        <p className="avertissement">{d.groupes.factionsMelangees}</p>
      )}

      <section className="carte" aria-label={d.groupes.membres(groupe.membres.length)}>
        <ul className="membres-groupe">
          {groupe.membres.map((m) => (
            <li key={m.id} className="perso-profil">
              <ClasseIcone classe={m.personnage.classe} taille={34} />
              <div>
                <strong
                  className="classe"
                  style={{ "--c": `var(--classe-${m.personnage.classe})` } as React.CSSProperties}
                >
                  {nomEnJeu(m.personnage)}
                </strong>
                <span className="doux">
                  <Link href={`/joueurs/${m.utilisateurId}`}>{m.utilisateur.pseudo}</Link>
                  {m.utilisateurId === groupe.chefId && ` · ${d.groupes.chef}`} ·{" "}
                  <FactionIcone faction={m.personnage.faction} taille={14} /> {m.personnage.region}
                </span>
              </div>
              <div className="roles-proposes">
                {m.roles.map((r) => (
                  <NomRole key={r} role={r} taille={18} />
                ))}
              </div>
              {estChef && m.utilisateurId !== utilisateur.id && (
                <form action={retirerMembre}>
                  <input type="hidden" name="membreId" value={m.id} />
                  <BoutonEnvoi className="petit" enCours={d.commun.enCours}>
                    <span aria-label={d.groupes.retirerAria(m.utilisateur.pseudo)}>{d.groupes.retirer}</span>
                  </BoutonEnvoi>
                </form>
              )}
            </li>
          ))}
        </ul>
      </section>

      {groupe.membres.length < MAX_MEMBRES && (
        <section className="carte" aria-labelledby="titre-invitation">
          <p className="surtitre" id="titre-invitation">
            {d.groupes.inviter}
          </p>
          <p className="doux">{d.groupes.inviterAide}</p>
          <div className="lien-invitation">
            <code>{lien}</code>
            <BoutonCopier texte={lien} />
          </div>
        </section>
      )}

      <section className="carte" aria-labelledby="titre-mon-perso">
        <p className="surtitre" id="titre-mon-perso">
          {d.groupes.monPerso}
        </p>
        <form action={modifierMonPerso} className="formulaire">
          <input type="hidden" name="escouadeId" value={groupe.id} />
          <ChoixPersoRoles persos={persos} persoInitial={moi.personnageId} rolesInitiaux={moi.roles} />
          <BoutonEnvoi className="principal petit" enCours={d.commun.enregistrement}>
            {d.groupes.enregistrer}
          </BoutonEnvoi>
        </form>
      </section>

      <form action={estChef ? supprimerGroupe : quitterGroupe}>
        <input type="hidden" name="escouadeId" value={groupe.id} />
        <BoutonEnvoi className="danger petit" enCours={d.commun.enCours}>
          {estChef ? d.groupes.supprimer : d.groupes.quitter}
        </BoutonEnvoi>
      </form>
    </main>
  );
}
