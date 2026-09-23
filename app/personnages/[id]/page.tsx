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
import { ErreurFormulaire } from "@/lib/formulaire";

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
      throw new ErreurFormulaire(
        "Ce personnage est engagé dans un raid à venir : sa faction, son ruleset, sa région et sa classe ne peuvent pas changer pour l'instant.",
      );
    }
    await db.personnage.update({ where: { id: personnage.id }, data: donnees });
  } catch (e) {
    if (!(e instanceof ErreurFormulaire)) throw e;
    erreur = e.message;
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

  return (
    <main>
      <p>
        <Link href="/personnages">← Mes personnages</Link>
      </p>
      <h1 className="titre-perso">
        <ClasseIcone classe={perso.classe} taille={40} /> Modifier {nomEnJeu(perso)}
      </h1>
      {typeof erreur === "string" && (
        <p className="avertissement grave" role="alert">
          ⚠ {erreur}
        </p>
      )}
      {engage && (
        <p className="encadre">
          Ce personnage est engagé dans un raid à venir : tu peux changer son nom, son niveau, ses rôles et ses
          logs, mais pas sa faction, son ruleset, sa région ni sa classe.
        </p>
      )}
      <form action={modifierPersonnage} className="formulaire">
        <input type="hidden" name="personnageId" value={perso.id} />
        <ChampsPersonnage perso={perso} />
        <div className="actions-rl">
          <BoutonEnvoi className="principal" enCours="Enregistrement…">
            Enregistrer
          </BoutonEnvoi>
          <Link href="/personnages" className="bouton">
            Annuler
          </Link>
        </div>
      </form>
    </main>
  );
}
