import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Classe, Faction, Region, Role, Ruleset } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { BoutonEnvoi } from "@/app/BoutonEnvoi";
import { ClasseIcone, DRAPEAUX, FactionIcone, ICONES_RULESET, NomRole, RulesetRegion } from "@/app/ClasseIcone";
import { BoutonSupprimer } from "./BoutonSupprimer";
import { STATUTS_EN_ATTENTE } from "@/lib/annonces";
import { MenuDeroulant } from "@/app/MenuDeroulant";
import { nomEnJeu } from "@/lib/jeu";
import { exigerUtilisateur } from "@/lib/session";
import {
  choix,
  choixMultiples,
  entier,
  ErreurFormulaire,
  lienWarcraftLogs,
  NOM_MAX,
  nomDePersonnage,
} from "@/lib/formulaire";
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
          nom: nomDePersonnage(form, "nom", "Prénom du personnage", { requis: true })!,
          nomDeFamille: nomDePersonnage(form, "nomDeFamille", "Nom du personnage"),
          lienLogs: lienWarcraftLogs(form, "lienLogs"),
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
    where: { id: personnageId, utilisateurId: utilisateur.id, supprimeLe: null },
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

const retourErreur = (erreur: string): never => redirect(`/personnages?erreur=${encodeURIComponent(erreur)}`);

/** Le personnage de l'utilisateur connecté (jamais celui d'un autre). */
async function monPersonnage(form: FormData) {
  const utilisateur = await exigerUtilisateur();
  const personnage = await db.personnage.findFirst({
    where: { id: String(form.get("personnageId") ?? ""), utilisateurId: utilisateur.id, supprimeLe: null },
  });
  if (!personnage) redirect("/personnages");
  return personnage;
}

async function modifierLogs(form: FormData) {
  "use server";
  const personnage = await monPersonnage(form);
  let lienLogs: string | null = null;
  try {
    lienLogs = lienWarcraftLogs(form, "lienLogs");
  } catch (e) {
    if (!(e instanceof ErreurFormulaire)) throw e;
    retourErreur(e.message);
  }
  await db.personnage.update({ where: { id: personnage.id }, data: { lienLogs } });
  revalidatePath("/personnages");
}

/**
 * Suppression : le personnage est masqué partout (règle 2 : l'historique des raids
 * garde son nom). La réputation est portée par le compte, elle ne bouge pas.
 */
async function supprimerPersonnage(form: FormData) {
  "use server";
  const personnage = await monPersonnage(form);
  const maintenant = new Date();
  const aVenir = { statut: { in: ["PUBLIEE" as const, "COMPLETE" as const] }, debutUtc: { gt: maintenant } };

  const convie = await db.inscription.findFirst({
    where: { personnageId: personnage.id, statut: "CONFIRME", place: { annonce: aVenir } },
  });
  if (convie) retourErreur("Ce personnage est convié à un raid à venir : il ne peut pas être supprimé avant.");
  const organise = await db.annonce.findFirst({ where: { organisateurPersonnageId: personnage.id, ...aVenir } });
  if (organise) retourErreur("Tu organises un raid à venir avec ce personnage : annule-le d'abord.");

  await db.$transaction([
    db.inscription.updateMany({
      where: { personnageId: personnage.id, statut: { in: [...STATUTS_EN_ATTENTE] } },
      data: { statut: "RETIRE" },
    }),
    db.personnage.update({ where: { id: personnage.id }, data: { supprimeLe: maintenant, estPrincipal: false } }),
  ]);
  revalidatePath("/personnages");
  revalidatePath("/");
}

const TITRE_NOM = `Lettres uniquement, ${NOM_MAX} maximum`;

export default async function PagePersonnages({ searchParams }: PageProps<"/personnages">) {
  const utilisateur = await exigerUtilisateur();
  const { erreur } = await searchParams;
  const personnages = await db.personnage.findMany({
    where: { utilisateurId: utilisateur.id, supprimeLe: null },
    orderBy: [{ estPrincipal: "desc" }, { nom: "asc" }],
  });

  return (
    <main>
      <p>
        <Link href="/">← Accueil</Link>
      </p>
      <h1>Mes personnages</h1>
      {typeof erreur === "string" && (
        <p className="avertissement grave" role="alert">
          ⚠ {erreur}
        </p>
      )}

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
                  {libelleClasse[p.classe]} niveau {p.niveau} · <FactionIcone faction={p.faction} taille={16} />{" "}
                  {libelleFaction[p.faction]} ·{" "}
                  <RulesetRegion ruleset={p.ruleset} region={p.region} taille={16} /> ·{" "}
                  {p.rolesJouables.map((r) => (
                    <NomRole key={r} role={r} taille={16} />
                  ))}
                </small>
                <details className="logs-perso">
                  <summary>{p.lienLogs ? "Logs · modifier le lien" : "+ Ajouter ses logs"}</summary>
                  <form action={modifierLogs} className="form-logs">
                    <input type="hidden" name="personnageId" value={p.id} />
                    <input
                      name="lienLogs"
                      type="url"
                      defaultValue={p.lienLogs ?? ""}
                      placeholder="https://fresh.warcraftlogs.com/character/…"
                      aria-label={`Lien Warcraft Logs de ${nomEnJeu(p)}`}
                    />
                    <BoutonEnvoi className="petit" enCours="…">
                      Enregistrer
                    </BoutonEnvoi>
                  </form>
                </details>
                {p.lienLogs && (
                  <a href={p.lienLogs} target="_blank" rel="noopener noreferrer nofollow" className="lien-logs">
                    Voir ses logs ↗
                  </a>
                )}
              </div>
              <div className="perso-actions">
                <BoutonSupprimer action={supprimerPersonnage} personnageId={p.id} nom={nomEnJeu(p)} />
              </div>
            </li>
          ))}
        </ul>
      )}

      <h2>Déclarer un personnage</h2>
      <form action={creerPersonnage} className="formulaire">
        <div className="rangee">
          <div className="champ">
            Faction
            <MenuDeroulant
              name="faction"
              etiquette="Faction"
              options={options(libelleFaction).map(([v, l]) => ({ valeur: v, libelle: l, faction: v }))}
            />
          </div>
          <div className="champ">
            Ruleset
            <MenuDeroulant
              name="ruleset"
              etiquette="Ruleset"
              options={options(libelleRuleset).map(([v, l]) => ({ valeur: v, libelle: l, image: ICONES_RULESET[v as Ruleset] }))}
            />
          </div>
          <div className="champ">
            Région
            <MenuDeroulant
              name="region"
              etiquette="Région"
              options={options(libelleRegion).map(([v, l]) => ({ valeur: v, libelle: l, image: DRAPEAUX[v as Region] }))}
            />
          </div>
        </div>
        <div className="rangee">
          <label className="champ">
            Prénom du personnage
            <input name="nom" required maxLength={NOM_MAX} pattern="\p{L}+" title={TITRE_NOM} autoComplete="off" />
          </label>
          <label className="champ">
            Nom du personnage
            <input name="nomDeFamille" maxLength={NOM_MAX} pattern="\p{L}+" title={TITRE_NOM} autoComplete="off" />
          </label>
        </div>
        <div className="rangee">
          <label className="champ">
            Logs <small className="fuseau">(facultatif, Warcraft Logs uniquement)</small>
            <input name="lienLogs" type="url" placeholder="https://fresh.warcraftlogs.com/character/…" />
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
