import Link from "next/link";
import { redirect } from "next/navigation";
import { Classe, Contenu, ReglesLoot, Role, Vocal } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { exigerUtilisateur } from "@/lib/session";
import { localVersUtc } from "@/lib/dates";
import { raids } from "@/lib/raids";
import { nomEnJeu, rolePossible, rolesParClasse } from "@/lib/jeu";
import { ChoixCompo } from "./ChoixCompo";
import { MenuDeroulant } from "@/app/MenuDeroulant";
import { BoutonEnvoi } from "@/app/BoutonEnvoi";
import { choix, entier, ErreurFormulaire, messageErreur, texte } from "@/lib/formulaire";
import { options } from "@/lib/libelles";
import { dicoCourant, langueCourante } from "@/lib/langue";

const LANGUES = ["fr", "en"] as const;

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

    // La compo que le RL a déjà : uniquement les combinaisons possibles en jeu.
    const composition: { classe: Classe; role: Role; nombre: number }[] = [];
    for (const classe of Object.keys(rolesParClasse) as Classe[]) {
      for (const role of rolesParClasse[classe]) {
        const nombre = entier(form, `compo.${classe}.${role}`, { min: 0, max: taille, champ: "compo" }) ?? 0;
        if (nombre > 0) composition.push({ classe, role, nombre });
      }
    }
    const joueurs = composition.reduce((t, c) => t + c.nombre, 0);
    if (joueurs === 0) throw new ErreurFormulaire((d) => d.erreur.compoVide);
    if (joueurs >= taille) throw new ErreurFormulaire((d) => d.erreur.raidPlein(joueurs, taille));
    const nbPlaces = taille - joueurs;

    // Les besoins précis ; les places restantes sont libres.
    const toutes = Object.keys(Classe) as Classe[];
    const places: { role: Role | null; classesAcceptees: Classe[] }[] = [];
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

    const vocal = lireVocal(form);
    const langue = String(form.get("langueRequise") ?? "");
    const dureeHeures = entier(form, "dureeHeures", { min: 1, max: 8, champ: "duree" });

    const donnees = {
      createurId: utilisateur.id,
      contenu,
      titre: texte(form, "titre", { max: 20, champ: "titre" }),
      faction: personnage.faction,
      ruleset: personnage.ruleset,
      region: personnage.region,
      organisateurPersonnageId: personnage.id,
      taille,
      debutUtc,
      dureeEstimee: dureeHeures ? dureeHeures * 60 : null,
      reglesLoot: choix(form, "reglesLoot", ReglesLoot, "loot"),
      langueRequise: (LANGUES as readonly string[]).includes(langue) ? langue : null,
      ...vocal,
      niveauMin: entier(form, "niveauMin", { min: 1, max: 60, champ: "niveauMin" }),
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
          <label className="champ">
            <span>
              {d.champ.titre} <small className="fuseau">{d.creation.titreAide}</small>
            </span>
            <input name="titre" maxLength={20} placeholder={d.creation.titrePlaceholder} autoComplete="off" />
          </label>
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

        <h2>{d.creation.organisation}</h2>
        <div className="rangee">
          <label className="champ">
            {d.champ.loot}
            <select name="reglesLoot" required>
              {options(d.reglesLoot).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label className="champ">
            {d.champ.niveauMin}
            <input type="number" name="niveauMin" min={1} max={60} defaultValue={60} />
          </label>
          <label className="champ">
            {d.commun.langue}
            <select name="langueRequise" defaultValue={langue}>
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
                <input type="radio" name="vocal" value={v} defaultChecked={v === "AUCUN"} /> {l}
              </label>
            ))}
          </div>
          <div className="si-discord">
            <label className="champ">
              {d.creation.lienDiscord}
              <input name="vocalDiscordLien" type="url" maxLength={200} placeholder="https://discord.gg/abc123" />
            </label>
          </div>
          <div className="si-teamspeak rangee">
            <label className="champ">
              {d.creation.adresseTs}
              <input name="vocalTsAdresse" maxLength={100} placeholder="ts.my-server.com" />
            </label>
            <label className="champ">
              {d.creation.motDePasseTs}
              <input name="vocalTsMotDePasse" maxLength={100} />
            </label>
          </div>
          <p className="doux">{d.creation.vocalPrive}</p>
        </fieldset>
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
