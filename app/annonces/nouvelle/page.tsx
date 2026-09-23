import Link from "next/link";
import { redirect } from "next/navigation";
import { Classe, Contenu, ReglesLoot, Role } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { exigerUtilisateur } from "@/lib/session";
import { localVersUtc } from "@/lib/dates";
import { raids } from "@/lib/raids";
import { choix, choixMultiples, entier, ErreurFormulaire } from "@/lib/formulaire";
import { libelleClasse, libelleFaction, libelleReglesLoot, libelleRole, libelleRuleset, options } from "@/lib/libelles";

const LIGNES_DE_PLACES = [0, 1, 2, 3];

const LANGUES = { fr: "Français", en: "Anglais" } as const;

async function creerAnnonce(form: FormData) {
  "use server";
  const utilisateur = await exigerUtilisateur();

  let erreur: string | null = null;
  let annonceId: string | null = null;
  try {
    // Le raid prend la faction, le ruleset et la région du personnage choisi.
    const personnage = await db.personnage.findFirst({
      where: { id: String(form.get("personnageId") ?? ""), utilisateurId: utilisateur.id },
    });
    if (!personnage) throw new ErreurFormulaire("Choisis un de tes personnages.");

    const contenu = choix(form, "contenu", Contenu);
    const taille = raids[contenu].taille;

    const debutUtc = localVersUtc(
      String(form.get("date") ?? ""),
      String(form.get("heure") ?? ""),
      utilisateur.fuseauHoraire,
    );
    if (!debutUtc) throw new ErreurFormulaire("Date ou heure invalide.");
    if (debutUtc.getTime() <= Date.now()) throw new ErreurFormulaire("La date du raid doit être dans le futur.");

    const places: { role: Role; classesAcceptees: Classe[] }[] = [];
    for (const i of LIGNES_DE_PLACES) {
      const nombre = entier(form, `places.${i}.nombre`, { min: 0, max: taille }) ?? 0;
      if (nombre === 0) continue;
      const role = choix(form, `places.${i}.role`, Role);
      const cochees = choixMultiples(form, `places.${i}.classes`, Classe);
      const classesAcceptees = cochees.length > 0 ? cochees : (Object.keys(Classe) as Classe[]);
      for (let n = 0; n < nombre; n++) places.push({ role, classesAcceptees });
    }
    if (places.length === 0) throw new ErreurFormulaire("Ouvre au moins une place.");
    if (places.length >= taille) {
      throw new ErreurFormulaire(`Un raid de ${taille} ne peut pas avoir plus de ${taille - 1} places ouvertes.`);
    }

    const langue = String(form.get("langueRequise") ?? "");
    const dureeHeures = entier(form, "dureeHeures", { min: 1, max: 8 });

    const annonce = await db.annonce.create({
      data: {
        createurId: utilisateur.id,
        contenu,
        faction: personnage.faction,
        ruleset: personnage.ruleset,
        region: personnage.region,
        taille,
        debutUtc,
        dureeEstimee: dureeHeures ? dureeHeures * 60 : null,
        reglesLoot: choix(form, "reglesLoot", ReglesLoot),
        langueRequise: langue in LANGUES ? langue : null,
        vocalRequis: form.get("vocalRequis") === "on",
        niveauMin: entier(form, "niveauMin", { min: 1, max: 60 }),
        statut: "PUBLIEE",
        publieeLe: new Date(),
        places: { create: places },
      },
    });
    annonceId = annonce.id;
  } catch (e) {
    if (!(e instanceof ErreurFormulaire)) throw e;
    erreur = e.message;
  }

  if (erreur) redirect(`/annonces/nouvelle?erreur=${encodeURIComponent(erreur)}`);
  redirect(`/annonces/${annonceId}`);
}

export default async function PageNouvelleAnnonce({ searchParams }: PageProps<"/annonces/nouvelle">) {
  const utilisateur = await exigerUtilisateur();
  const { erreur } = await searchParams;
  const personnages = await db.personnage.findMany({
    where: { utilisateurId: utilisateur.id },
    orderBy: [{ estPrincipal: "desc" }, { nom: "asc" }],
  });

  if (personnages.length === 0) {
    return (
      <main>
        <p>
          <Link href="/">← Accueil</Link>
        </p>
        <h1>Créer un raid</h1>
        <p>
          Déclare d&apos;abord <Link href="/personnages">un personnage</Link> : le raid prendra sa faction, son ruleset
          et sa région.
        </p>
      </main>
    );
  }

  return (
    <main>
      <p>
        <Link href="/">← Accueil</Link>
      </p>
      <h1>Créer un raid</h1>
      {typeof erreur === "string" && <p role="alert">⚠ {erreur}</p>}
      <form action={creerAnnonce}>
        <p>
          <label>
            Avec quel personnage ?{" "}
            <select name="personnageId" required>
              {personnages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nom} — {libelleClasse[p.classe]}, {libelleFaction[p.faction]}, {libelleRuleset[p.ruleset]}{" "}
                  {p.region}
                </option>
              ))}
            </select>
          </label>
        </p>
        <p>
          <label>
            Raid{" "}
            <select name="contenu" required>
              {options(raids).map(([v, r]) => (
                <option key={v} value={v}>
                  {r.nom} ({r.taille})
                </option>
              ))}
            </select>
          </label>
        </p>
        <p>
          <label>
            Date <input type="date" name="date" required />
          </label>{" "}
          <label>
            Heure <input type="time" name="heure" required defaultValue="21:00" />
          </label>{" "}
          <small>(fuseau : {utilisateur.fuseauHoraire})</small>
        </p>
        <p>
          <label>
            Durée estimée{" "}
            <select name="dureeHeures" defaultValue="3">
              {[1, 2, 3, 4, 5, 6].map((h) => (
                <option key={h} value={h}>
                  {h} h
                </option>
              ))}
            </select>
          </label>{" "}
          <label>
            Loot{" "}
            <select name="reglesLoot" required>
              {options(libelleReglesLoot).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>{" "}
          <label>
            Niveau minimum <input type="number" name="niveauMin" min={1} max={60} defaultValue={60} />
          </label>
        </p>
        <p>
          <label>
            Langue{" "}
            <select name="langueRequise" defaultValue="fr">
              {options(LANGUES).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
              <option value="">Peu importe</option>
            </select>
          </label>{" "}
          <label>
            <input type="checkbox" name="vocalRequis" /> Vocal obligatoire
          </label>
        </p>

        <h2>Places ouvertes</h2>
        <p>
          <small>Aucune classe cochée = toutes les classes acceptées.</small>
        </p>
        {LIGNES_DE_PLACES.map((i) => (
          <fieldset key={i}>
            <legend>Ligne {i + 1}</legend>
            <label>
              Nombre{" "}
              <input type="number" name={`places.${i}.nombre`} min={0} max={39} defaultValue={i === 0 ? 1 : 0} />
            </label>{" "}
            <label>
              Rôle{" "}
              <select name={`places.${i}.role`}>
                {options(libelleRole).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <br />
            {options(libelleClasse).map(([v, l]) => (
              <label key={v}>
                <input type="checkbox" name={`places.${i}.classes`} value={v} /> {l}{" "}
              </label>
            ))}
          </fieldset>
        ))}

        <p>
          <button type="submit">Publier le raid</button>
        </p>
      </form>
    </main>
  );
}
