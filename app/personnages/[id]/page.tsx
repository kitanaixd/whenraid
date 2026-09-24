import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { BoutonEnvoi } from "@/app/BoutonEnvoi";
import { ClasseIcone } from "@/app/ClasseIcone";
import { ChampsPersonnage } from "../ChampsPersonnage";
import { lirePersonnage } from "../lecture";
import { STATUTS_ACTIFS } from "@/lib/annonces";
import { nomEnJeu } from "@/lib/jeu";
import { exigerUtilisateur } from "@/lib/session";
import { ErreurFormulaire, messageErreur } from "@/lib/formulaire";
import { dicoCourant } from "@/lib/langue";

/**
 * Le personnage est-il engagé dans un raid à venir (candidature, convocation ou
 * raid qu'il organise) ? Si oui, sa faction, son ruleset, sa région et sa classe
 * sont figés : les changer rendrait ses candidatures incohérentes.
 */
async function estEngage(personnageId: string) {
  const aVenir = { statut: { in: ["PUBLIEE" as const, "COMPLETE" as const] }, debutUtc: { gt: new Date() } };
  const [inscription, organise] = await Promise.all([
    db.inscription.findFirst({
      where: { personnageId, statut: { in: [...STATUTS_ACTIFS] }, place: { annonce: aVenir } },
    }),
    db.annonce.findFirst({ where: { organisateurPersonnageId: personnageId, ...aVenir } }),
  ]);
  return Boolean(inscription || organise);
}

async function modifierPersonnage(form: FormData) {
  "use server";
  const utilisateur = await exigerUtilisateur();
  const personnage = await db.personnage.findFirst({
    where: { id: String(form.get("personnageId") ?? ""), utilisateurId: utilisateur.id, supprimeLe: null },
  });
  if (!personnage) notFound();

  let erreur: string | null = null;
  try {
    const donnees = lirePersonnage(form);
    const identiteChange =
      donnees.faction !== personnage.faction ||
      donnees.ruleset !== personnage.ruleset ||
      donnees.region !== personnage.region ||
      donnees.classe !== personnage.classe;
    if (identiteChange && (await estEngage(personnage.id))) {
      throw new ErreurFormulaire((d) => d.erreur.persoEngage);
    }
    await db.personnage.update({ where: { id: personnage.id }, data: donnees });
  } catch (e) {
    erreur = messageErreur(e, await dicoCourant());
  }

  if (erreur) redirect(`/personnages/${personnage.id}?erreur=${encodeURIComponent(erreur)}`);
  revalidatePath("/personnages");
  revalidatePath("/");
  redirect("/personnages");
}

export default async function PageModifierPersonnage({ params, searchParams }: PageProps<"/personnages/[id]">) {
  const utilisateur = await exigerUtilisateur();
  const { id } = await params;
  const { erreur } = await searchParams;
  const perso = await db.personnage.findFirst({ where: { id, utilisateurId: utilisateur.id, supprimeLe: null } });
  if (!perso) notFound();
  const engage = await estEngage(perso.id);
  const d = await dicoCourant();

  return (
    <main>
      <p>
        <Link href="/personnages">{d.personnages.retour}</Link>
      </p>
      <h1 className="titre-perso">
        <ClasseIcone classe={perso.classe} taille={40} /> {d.personnages.titreModifier(nomEnJeu(perso))}
      </h1>
      {typeof erreur === "string" && (
        <p className="avertissement grave" role="alert">
          ⚠ {erreur}
        </p>
      )}
      {engage && (
        <p className="encadre">{d.personnages.engage}</p>
      )}
      <form action={modifierPersonnage} className="formulaire">
        <input type="hidden" name="personnageId" value={perso.id} />
        <ChampsPersonnage perso={perso} d={d} />
        <div className="actions-rl">
          <BoutonEnvoi className="principal" enCours={d.commun.enregistrement}>
            {d.raid.enregistrer}
          </BoutonEnvoi>
          <Link href="/personnages" className="bouton">
            {d.personnages.annuler}
          </Link>
        </div>
      </form>
    </main>
  );
}
