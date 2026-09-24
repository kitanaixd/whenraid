// Organisation d'un raid (vocal, loot, niveau minimum, langue) : lecture et champs,
// communs à la création et à la modification d'un raid.
import { Classe, ReglesLoot, Role, Vocal } from "@/generated/prisma/enums";
import { rolePossible, rolesParClasse } from "@/lib/jeu";
import { choix, entier, ErreurFormulaire, texte } from "@/lib/formulaire";
import type { Dico } from "@/lib/i18n";
import { options } from "@/lib/libelles";

export const LANGUES = ["fr", "en"] as const;

// Ces valeurs partent telles quelles en MP Discord aux joueurs : format strict, sans espace.
const LIEN_DISCORD = /^https:\/\/(discord\.gg|discord\.com\/invite)\/[A-Za-z0-9-]+$/;
const ADRESSE_TS = /^[A-Za-z0-9.-]+(:\d{1,5})?$/;

function lireVocal(form: FormData) {
  const vocal = choix(form, "vocal", Vocal, "vocal");
  if (vocal === "DISCORD") {
    const lien = texte(form, "vocalDiscordLien", { requis: true, max: 200, champ: "lienDiscord" })!;
    if (!LIEN_DISCORD.test(lien)) throw new ErreurFormulaire((d) => d.erreur.lienDiscord);
    return { vocal, vocalDiscordLien: lien, vocalTsAdresse: null, vocalTsMotDePasse: null };
  }
  if (vocal === "TEAMSPEAK") {
    const adresse = texte(form, "vocalTsAdresse", { requis: true, max: 100, champ: "adresseTs" })!;
    if (!ADRESSE_TS.test(adresse)) throw new ErreurFormulaire((d) => d.erreur.adresseTs);
    const motDePasse = texte(form, "vocalTsMotDePasse", { max: 100, champ: "motDePasseTs" });
    if (motDePasse && /\s/.test(motDePasse)) throw new ErreurFormulaire((d) => d.erreur.motDePasseTs);
    return { vocal, vocalDiscordLien: null, vocalTsAdresse: adresse, vocalTsMotDePasse: motDePasse };
  }
  return { vocal, vocalDiscordLien: null, vocalTsAdresse: null, vocalTsMotDePasse: null };
}

/** Lit et valide le titre, la durée et l'organisation d'un raid. */
export function lireOrganisation(form: FormData) {
  const langue = String(form.get("langueRequise") ?? "");
  const dureeHeures = entier(form, "dureeHeures", { min: 1, max: 8, champ: "duree" });
  return {
    titre: texte(form, "titre", { max: 20, champ: "titre" }),
    dureeEstimee: dureeHeures ? dureeHeures * 60 : null,
    reglesLoot: choix(form, "reglesLoot", ReglesLoot, "loot"),
    langueRequise: (LANGUES as readonly string[]).includes(langue) ? langue : null,
    niveauMin: entier(form, "niveauMin", { min: 1, max: 60, champ: "niveauMin" }),
    ...lireVocal(form),
  };
}

type Organisation = {
  reglesLoot: ReglesLoot;
  niveauMin: number | null;
  langueRequise: string | null;
  vocal: Vocal;
  vocalDiscordLien: string | null;
  vocalTsAdresse: string | null;
  vocalTsMotDePasse: string | null;
};

/** Champ du titre du raid (facultatif, 20 caractères). */
export function ChampTitre({ d, valeur }: { d: Dico; valeur?: string | null }) {
  return (
    <label className="champ">
      <span>
        {d.champ.titre} <small className="fuseau">{d.creation.titreAide}</small>
      </span>
      <input
        name="titre"
        maxLength={20}
        placeholder={d.creation.titrePlaceholder}
        autoComplete="off"
        defaultValue={valeur ?? ""}
      />
    </label>
  );
}

/** Section « Organisation » : loot, niveau minimum, langue et vocal (vides ou pré-remplis). */
export function ChampsOrganisation({
  d,
  langueParDefaut,
  annonce,
}: {
  d: Dico;
  langueParDefaut: string;
  annonce?: Organisation;
}) {
  return (
    <>
      <h2>{d.creation.organisation}</h2>
      <div className="rangee">
        <label className="champ">
          {d.champ.loot}
          <select name="reglesLoot" required defaultValue={annonce?.reglesLoot}>
            {options(d.reglesLoot).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="champ">
          {d.champ.niveauMin}
          <input
            type="number"
            name="niveauMin"
            min={1}
            max={60}
            defaultValue={annonce ? (annonce.niveauMin ?? "") : 60}
          />
        </label>
        <label className="champ">
          {d.commun.langue}
          <select name="langueRequise" defaultValue={annonce ? (annonce.langueRequise ?? "") : langueParDefaut}>
            {LANGUES.map((v) => (
              <option key={v} value={v}>
                {d.langueParlee[v]}
              </option>
            ))}
            <option value="">{d.creation.peuImporte}</option>
          </select>
        </label>
      </div>
      <fieldset className="vocal">
        <legend>{d.champ.vocal}</legend>
        <div className="cases">
          {options(d.vocal).map(([v, l]) => (
            <label key={v}>
              <input
                type="radio"
                name="vocal"
                value={v}
                defaultChecked={v === (annonce?.vocal ?? "AUCUN")}
              />{" "}
              {l}
            </label>
          ))}
        </div>
        <div className="si-discord">
          <label className="champ">
            {d.creation.lienDiscord}
            <input
              name="vocalDiscordLien"
              type="url"
              maxLength={200}
              placeholder="https://discord.gg/abc123"
              defaultValue={annonce?.vocalDiscordLien ?? ""}
            />
          </label>
        </div>
        <div className="si-teamspeak rangee">
          <label className="champ">
            {d.creation.adresseTs}
            <input
              name="vocalTsAdresse"
              maxLength={100}
              placeholder="ts.my-server.com"
              defaultValue={annonce?.vocalTsAdresse ?? ""}
            />
          </label>
          <label className="champ">
            {d.creation.motDePasseTs}
            <input name="vocalTsMotDePasse" maxLength={100} defaultValue={annonce?.vocalTsMotDePasse ?? ""} />
          </label>
        </div>
        <p className="doux">{d.creation.vocalPrive}</p>
      </fieldset>
    </>
  );
}

/** Une place à pourvoir : un rôle (ou tout rôle) et les classes acceptées. */
export type SpecPlace = { role: Role | null; classesAcceptees: Classe[] };

/**
 * Lit la compo déclarée par le RL et ses besoins précis, et en déduit les places
 * ouvertes. `disponibles` : places que le RL répartit (taille du raid, moins les
 * joueurs déjà acceptés à la modification). Sans `pleinAutorise`, au moins une place doit rester.
 */
export function lireCompoEtBesoins(form: FormData, disponibles: number, { pleinAutorise }: { pleinAutorise: boolean }) {
  // La compo que le RL a déjà : uniquement les combinaisons possibles en jeu.
  const composition: { classe: Classe; role: Role; nombre: number }[] = [];
  for (const classe of Object.keys(rolesParClasse) as Classe[]) {
    for (const role of rolesParClasse[classe]) {
      const nombre = entier(form, `compo.${classe}.${role}`, { min: 0, max: disponibles, champ: "compo" }) ?? 0;
      if (nombre > 0) composition.push({ classe, role, nombre });
    }
  }
  const joueurs = composition.reduce((t, c) => t + c.nombre, 0);
  if (joueurs === 0) throw new ErreurFormulaire((d) => d.erreur.compoVide);
  if (joueurs > disponibles || (!pleinAutorise && joueurs === disponibles)) {
    throw new ErreurFormulaire((d) => d.erreur.raidPlein(joueurs, disponibles));
  }
  const nbPlaces = disponibles - joueurs;

  // Les besoins précis ; les places restantes sont libres.
  const toutes = Object.keys(Classe) as Classe[];
  const places: SpecPlace[] = [];
  const numerosDeLignes = [...form.keys()]
    .map((k) => /^exigences\.(\d+)\.nombre$/.exec(k)?.[1])
    .filter((n): n is string => n !== undefined)
    .slice(0, 20);
  for (const i of numerosDeLignes) {
    const nombre = entier(form, `exigences.${i}.nombre`, { min: 0, max: nbPlaces, champ: "nombre" }) ?? 0;
    if (nombre === 0) continue;
    const classe = form.get(`exigences.${i}.classe`) ? choix(form, `exigences.${i}.classe`, Classe, "classe") : null;
    const role = form.get(`exigences.${i}.role`) ? choix(form, `exigences.${i}.role`, Role, "role") : null;
    if (classe && role && !rolePossible(classe, role)) {
      throw new ErreurFormulaire((d) => d.erreur.rolImpossible(d.classe[classe], d.role[role]));
    }
    for (let n = 0; n < nombre; n++) places.push({ role, classesAcceptees: classe ? [classe] : toutes });
  }
  if (places.length > nbPlaces) {
    const demandees = places.length;
    throw new ErreurFormulaire((d) => d.erreur.tropDePlaces(demandees, nbPlaces));
  }
  while (places.length < nbPlaces) places.push({ role: null, classesAcceptees: toutes });
  return { composition, places };
}
