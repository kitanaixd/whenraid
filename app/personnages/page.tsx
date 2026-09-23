import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Classe, Faction, Region, Role, Ruleset } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { BoutonEnvoi } from "@/app/BoutonEnvoi";
import { ClasseIcone, NomRole } from "@/app/ClasseIcone";
import { MenuDeroulant } from "@/app/MenuDeroulant";
import { nomEnJeu } from "@/lib/jeu";
import { exigerUtilisateur } from "@/lib/session";
import { choix, choixMultiples, entier, ErreurFormulaire, texte } from "@/lib/formulaire";
import {
  libelleClasse,
  libelleFaction,
  libelleRegion,
  libelleRole,
  libelleRuleset,
  options,
} from "@/lib/libelles";

async function creerPersonnage(form: FormData) {
  "use server";
  const utilisateur = await exigerUtilisateur();

  let erreur: string | null = null;
  try {
    const rolesJouables = choixMultiples(form, "rolesJouables", Role);
    if (rolesJouables.length === 0) throw new ErreurFormulaire("Coche au moins un rôle jouable.");
    const estPrincipal = form.get("estPrincipal") === "on";

    await db.$transaction(async (tx) => {
      // Un seul principal par utilisateur (garanti aussi par la base).
      if (estPrincipal) {
        await tx.personnage.updateMany({
          where: { utilisateurId: utilisateur.id, estPrincipal: true },
          data: { estPrincipal: false },
        });
      }
      await tx.personnage.create({
        data: {
          utilisateurId: utilisateur.id,
          nom: texte(form, "nom", { requis: true, max: 24 })!,
          nomDeFamille: texte(form, "nomDeFamille", { max: 24 }),
          classe: choix(form, "classe", Classe),
          rolesJouables,
          faction: choix(form, "faction", Faction),
          ruleset: choix(form, "ruleset", Ruleset),
          region: choix(form, "region", Region),
          niveau: entier(form, "niveau", { min: 1, max: 60, requis: true })!,
          estPrincipal,
        },
      });
    });
  } catch (e) {
    if (!(e instanceof ErreurFormulaire)) throw e;
    erreur = e.message;
  }

  if (erreur) redirect(`/personnages?erreur=${encodeURIComponent(erreur)}`);
  revalidatePath("/personnages");
  redirect("/personnages");
}

async function basculerPrincipal(form: FormData) {
  "use server";
  const utilisateur = await exigerUtilisateur();
  const personnageId = String(form.get("personnageId") ?? "");

  // Vérifie que le personnage appartient bien à l'utilisateur connecté.
  const personnage = await db.personnage.findFirst({
    where: { id: personnageId, utilisateurId: utilisateur.id },
  });
  if (!personnage) redirect("/personnages");

  await db.$transaction([
    db.personnage.updateMany({
      where: { utilisateurId: utilisateur.id, estPrincipal: true },
      data: { estPrincipal: false },
    }),
    ...(personnage.estPrincipal
      ? []
      : [db.personnage.update({ where: { id: personnage.id }, data: { estPrincipal: true } })]),
  ]);
  revalidatePath("/personnages");
}

export default async function PagePersonnages({ searchParams }: PageProps<"/personnages">) {
  const utilisateur = await exigerUtilisateur();
  const { erreur } = await searchParams;
  const personnages = await db.personnage.findMany({
    where: { utilisateurId: utilisateur.id },
    orderBy: [{ estPrincipal: "desc" }, { nom: "asc" }],
  });

  return (
    <main>
      <p>
        <Link href="/">← Accueil</Link>
      </p>
      <h1>Mes personnages</h1>

      {personnages.length === 0 ? (
        <p>Tu n&apos;as encore déclaré aucun personnage.</p>
      ) : (
        <ul className="liste-persos">
          {personnages.map((p) => (
            <li key={p.id} className="carte">
              <form action={basculerPrincipal}>
                <input type="hidden" name="personnageId" value={p.id} />
                <button
                  type="submit"
                  className="petit"
                  title={p.estPrincipal ? "Retirer le statut principal" : "Définir comme principal"}
                  aria-pressed={p.estPrincipal}
                >
                  {p.estPrincipal ? "★" : "☆"}
                </button>
              </form>
              <ClasseIcone classe={p.classe} taille={34} />
              <div>
                <strong className="classe" style={{ "--c": `var(--classe-${p.classe})` } as React.CSSProperties}>
                  {nomEnJeu(p)}
                </strong>
                <br />
                <small>
                  {libelleClasse[p.classe]} niveau {p.niveau} · {libelleFaction[p.faction]} ·{" "}
                  {libelleRuleset[p.ruleset]} {p.region} ·{" "}
                  {p.rolesJouables.map((r) => (
                    <NomRole key={r} role={r} taille={16} />
                  ))}
                </small>
              </div>
            </li>
          ))}
        </ul>
      )}

      <h2>Déclarer un personnage</h2>
      {typeof erreur === "string" && <p role="alert">⚠ {erreur}</p>}
      <form action={creerPersonnage} className="formulaire">
        <div className="rangee">
          <label className="champ">
            Faction
            <select name="faction" required>
              {options(libelleFaction).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label className="champ">
            Ruleset
            <select name="ruleset" required>
              {options(libelleRuleset).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label className="champ">
            Région
            <select name="region" required>
              {options(libelleRegion).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="rangee">
          <label className="champ">
            Nom
            <input name="nom" required maxLength={24} />
          </label>
          <label className="champ">
            Nom de famille
            <input name="nomDeFamille" maxLength={24} />
          </label>
        </div>
        <div className="rangee">
          <div className="champ">
            Classe
            <MenuDeroulant
              name="classe"
              etiquette="Classe"
              options={options(libelleClasse).map(([v, l]) => ({ valeur: v, libelle: l, classe: v }))}
            />
          </div>
          <label className="champ">
            Niveau
            <input name="niveau" type="number" min={1} max={60} defaultValue={60} required />
          </label>
        </div>
        <fieldset>
          <legend>Rôles jouables</legend>
          <div className="cases">
            {options(libelleRole).map(([v, l]) => (
              <label key={v}>
                <input type="checkbox" name="rolesJouables" value={v} /> {l}
              </label>
            ))}
          </div>
        </fieldset>
        <label>
          <input type="checkbox" name="estPrincipal" defaultChecked={personnages.length === 0} /> Personnage
          principal
        </label>
        <div>
          <BoutonEnvoi className="principal" enCours="Ajout…">
            Ajouter ce personnage
          </BoutonEnvoi>
        </div>
      </form>
    </main>
  );
}
