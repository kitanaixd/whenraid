import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Classe, Faction, Region, Role, Ruleset } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
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
          spePrincipale: texte(form, "spePrincipale", { max: 40 }),
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
        <ul>
          {personnages.map((p) => (
            <li key={p.id}>
              <strong>
                {p.nom}
                {p.nomDeFamille && ` ${p.nomDeFamille}`}
              </strong>{" "}
              — {libelleClasse[p.classe]} niveau {p.niveau}
              {p.spePrincipale && ` (${p.spePrincipale})`}, {libelleFaction[p.faction]},{" "}
              {libelleRuleset[p.ruleset]} {p.region} — {p.rolesJouables.map((r) => libelleRole[r]).join(", ")}
              {p.estPrincipal && " ★ principal"}
            </li>
          ))}
        </ul>
      )}

      <h2>Déclarer un personnage</h2>
      {typeof erreur === "string" && <p role="alert">⚠ {erreur}</p>}
      <form action={creerPersonnage}>
        <p>
          <label>
            Nom <input name="nom" required maxLength={24} />
          </label>{" "}
          <label>
            Nom de famille <input name="nomDeFamille" maxLength={24} />
          </label>
        </p>
        <p>
          <label>
            Classe{" "}
            <select name="classe" required>
              {options(libelleClasse).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>{" "}
          <label>
            Spécialisation principale <input name="spePrincipale" maxLength={40} placeholder="ex. Feu" />
          </label>{" "}
          <label>
            Niveau <input name="niveau" type="number" min={1} max={60} defaultValue={60} required />
          </label>
        </p>
        <fieldset>
          <legend>Rôles jouables</legend>
          {options(libelleRole).map(([v, l]) => (
            <label key={v}>
              <input type="checkbox" name="rolesJouables" value={v} /> {l}{" "}
            </label>
          ))}
        </fieldset>
        <p>
          <label>
            Faction{" "}
            <select name="faction" required>
              {options(libelleFaction).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>{" "}
          <label>
            Ruleset{" "}
            <select name="ruleset" required>
              {options(libelleRuleset).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>{" "}
          <label>
            Région{" "}
            <select name="region" required>
              {options(libelleRegion).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
        </p>
        <p>
          <label>
            <input type="checkbox" name="estPrincipal" defaultChecked={personnages.length === 0} /> Personnage
            principal
          </label>
        </p>
        <button type="submit">Ajouter ce personnage</button>
      </form>
    </main>
  );
}
