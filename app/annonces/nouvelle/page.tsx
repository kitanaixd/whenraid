import Link from "next/link";
import { redirect } from "next/navigation";
import { Contenu } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { exigerUtilisateur } from "@/lib/session";
import { localVersUtc } from "@/lib/dates";
import { raids } from "@/lib/raids";
import { nomEnJeu } from "@/lib/jeu";
import { ChoixCompo } from "./ChoixCompo";
import { MenuDeroulant } from "@/app/MenuDeroulant";
import { BoutonEnvoi } from "@/app/BoutonEnvoi";
import { choix, ErreurFormulaire, messageErreur } from "@/lib/formulaire";
import { dicoCourant, langueCourante } from "@/lib/langue";
import { ChampsOrganisation, ChampTitre, lireCompoEtBesoins, lireOrganisation } from "../organisation";

async function creerAnnonce(form: FormData) {
  "use server";
  const utilisateur = await exigerUtilisateur();

  let erreur: string | null = null;
  let annonceId: string | null = null;
  try {
    // Le raid prend la faction, le ruleset et la région du personnage choisi.
    const personnage = await db.personnage.findFirst({
      where: { id: String(form.get("personnageId") ?? ""), utilisateurId: utilisateur.id, supprimeLe: null },
    });
    if (!personnage) throw new ErreurFormulaire((d) => d.erreur.choisisPerso);

    const contenu = choix(form, "contenu", Contenu, "raid");
    const taille = raids[contenu].taille;

    const debutUtc = localVersUtc(
      String(form.get("date") ?? ""),
      String(form.get("heure") ?? ""),
      utilisateur.fuseauHoraire,
    );
    if (!debutUtc) throw new ErreurFormulaire((d) => d.erreur.dateInvalide);
    if (debutUtc.getTime() <= Date.now()) throw new ErreurFormulaire((d) => d.erreur.datePassee);

    const { composition, places } = lireCompoEtBesoins(form, taille, { pleinAutorise: false });

    const donnees = {
      createurId: utilisateur.id,
      contenu,
      faction: personnage.faction,
      ruleset: personnage.ruleset,
      region: personnage.region,
      organisateurPersonnageId: personnage.id,
      taille,
      debutUtc,
      ...lireOrganisation(form),
      statut: "PUBLIEE",
      publieeLe: new Date(),
      composition: { create: composition },
      places: { create: places },
    } satisfies Prisma.AnnonceUncheckedCreateInput;
    try {
      annonceId = (await db.annonce.create({ data: donnees })).id;
    } catch (e) {
      // Double envoi du formulaire : la base refuse le doublon, on renvoie vers le raid déjà créé.
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
      const existant = await db.annonce.findFirst({
        where: { createurId: utilisateur.id, contenu, debutUtc, statut: { in: ["BROUILLON", "PUBLIEE", "COMPLETE"] } },
      });
      if (!existant) throw e;
      annonceId = existant.id;
    }
  } catch (e) {
    erreur = messageErreur(e, await dicoCourant());
  }

  if (erreur) redirect(`/annonces/nouvelle?erreur=${encodeURIComponent(erreur)}`);
  redirect(`/annonces/${annonceId}`);
}

export default async function PageNouvelleAnnonce({ searchParams }: PageProps<"/annonces/nouvelle">) {
  const utilisateur = await exigerUtilisateur();
  const [d, langue] = await Promise.all([dicoCourant(), langueCourante()]);
  const { erreur } = await searchParams;
  const personnages = await db.personnage.findMany({
    where: { utilisateurId: utilisateur.id, supprimeLe: null },
    orderBy: [{ estPrincipal: "desc" }, { nom: "asc" }],
  });

  if (personnages.length === 0) {
    return (
      <main>
        <p>
          <Link href="/">{d.commun.accueil}</Link>
        </p>
        <h1>{d.creation.titre}</h1>
        <p>
          {d.creation.sansPerso1} <Link href="/personnages">{d.raid.unPersonnage}</Link> {d.creation.sansPerso2}
        </p>
      </main>
    );
  }

  return (
    <main>
      <p>
        <Link href="/">{d.commun.accueil}</Link>
      </p>
      <h1>{d.creation.titre}</h1>
      {typeof erreur === "string" && <p role="alert">⚠ {erreur}</p>}
      <form action={creerAnnonce} className="formulaire">
        <div className="rangee">
          <ChampTitre d={d} />
        </div>
        <ChoixCompo
          fuseau={utilisateur.fuseauHoraire}
          personnage={
            <div className="champ">
              {d.creation.avecQuelPerso}
              <MenuDeroulant
                name="personnageId"
                etiquette={d.creation.avecQuelPerso}
                options={personnages.map((p) => ({
                  valeur: p.id,
                  classe: p.classe,
                  libelle: `${nomEnJeu(p)} — ${d.classe[p.classe]}, ${d.faction[p.faction]}, ${d.ruleset[p.ruleset]} ${p.region}`,
                }))}
              />
            </div>
          }
        />

        <ChampsOrganisation d={d} langueParDefaut={langue} />
        <p className="doux">{d.creation.finPrevue}</p>
        <div>
          <BoutonEnvoi className="principal" enCours={d.commun.publier}>
            {d.creation.publier}
          </BoutonEnvoi>
        </div>
      </form>
    </main>
  );
}
