import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { utilisateurConnecte } from "@/lib/session";
import { signIn } from "@/lib/auth";
import { dicoCourant } from "@/lib/langue";
import { MAX_MEMBRES, rolesDuPerso } from "@/lib/groupes";
import { nomEnJeu } from "@/lib/jeu";
import { ClasseIcone } from "@/app/ClasseIcone";
import { BoutonEnvoi } from "@/app/BoutonEnvoi";
import { ChoixPersoRoles } from "../../ChoixPersoRoles";
import { rejoindreGroupe } from "../../actions";

export default async function PageRejoindre({ params, searchParams }: PageProps<"/groupes/rejoindre/[code]">) {
  const utilisateur = await utilisateurConnecte();
  const d = await dicoCourant();
  const { code } = await params;
  const { erreur } = await searchParams;
  // Pas encore connecté : on se connecte avec Discord puis on revient sur l'invitation.
  if (!utilisateur) {
    return (
      <main className="page-groupes">
        <h1>{d.groupes.rejoindre}</h1>
        <form
          action={async () => {
            "use server";
            await signIn("discord", { redirectTo: `/groupes/rejoindre/${encodeURIComponent(code)}` });
          }}
        >
          <button type="submit" className="principal">
            {d.accueil.seConnecter}
          </button>
        </form>
      </main>
    );
  }
  const groupe = await db.escouade.findUnique({
    where: { code },
    include: {
      chef: { select: { pseudo: true } },
      membres: { orderBy: { rejointLe: "asc" }, include: { personnage: true } },
    },
  });
  if (!groupe) {
    return (
      <main className="page-groupes">
        <p className="avertissement grave">{d.groupes.lienInvalide}</p>
        <Link href="/groupes">{d.groupes.retour}</Link>
      </main>
    );
  }
  if (groupe.membres.some((m) => m.utilisateurId === utilisateur.id)) redirect(`/groupes/${groupe.id}`);
  const personnages = await db.personnage.findMany({
    where: { utilisateurId: utilisateur.id, supprimeLe: null },
    orderBy: [{ estPrincipal: "desc" }, { nom: "asc" }],
  });
  const persos = personnages.map((p) => ({ id: p.id, nom: nomEnJeu(p), classe: p.classe, roles: rolesDuPerso(p) }));
  const plein = groupe.membres.length >= MAX_MEMBRES;

  return (
    <main className="page-groupes">
      <p className="surtitre">{d.groupes.invitePar(groupe.chef.pseudo)}</p>
      <h1>{d.groupes.rejoindreTitre(groupe.nom)}</h1>
      <p className="doux">{d.groupes.intro}</p>
      {typeof erreur === "string" && (
        <p className="avertissement grave" role="alert">
          ⚠ {erreur}
        </p>
      )}
      <section className="carte">
        <p className="surtitre">{d.groupes.membres(groupe.membres.length)}</p>
        <div className="groupe-icones">
          {groupe.membres.map((m) => (
            <span key={m.id} className="nom-classe">
              <ClasseIcone classe={m.personnage.classe} taille={24} /> {nomEnJeu(m.personnage)}
            </span>
          ))}
        </div>
      </section>
      <section className="carte">
        {plein ? (
          <p className="avertissement">{d.erreur.groupePlein}</p>
        ) : persos.length === 0 ? (
          <p className="doux">
            {d.raid.declarePersoAvant} <Link href="/personnages">{d.raid.unPersonnage}</Link>.
          </p>
        ) : (
          <form action={rejoindreGroupe} className="formulaire">
            <input type="hidden" name="code" value={groupe.code} />
            <ChoixPersoRoles persos={persos} />
            <BoutonEnvoi className="principal" enCours={d.commun.enCours}>
              {d.groupes.rejoindre}
            </BoutonEnvoi>
          </form>
        )}
      </section>
    </main>
  );
}
