import Link from "next/link";
import { redirect } from "next/navigation";
import { Classe, Contenu, ReglesLoot, Role, Vocal } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { exigerUtilisateur } from "@/lib/session";
import { localVersUtc } from "@/lib/dates";
import { raids } from "@/lib/raids";
import { rolePossible, rolesParClasse } from "@/lib/jeu";
import { ChoixCompo } from "./ChoixCompo";
import { BoutonEnvoi } from "@/app/BoutonEnvoi";
import { choix, entier, ErreurFormulaire, texte } from "@/lib/formulaire";
import {
  libelleClasse,
  libelleFaction,
  libelleReglesLoot,
  libelleRole,
  libelleRuleset,
  libelleVocal,
  options,
} from "@/lib/libelles";

const LANGUES = { fr: "Français", en: "Anglais" } as const;

// Ces valeurs partent telles quelles en MP Discord aux joueurs : format strict, sans espace.
const LIEN_DISCORD = /^https:\/\/(discord\.gg|discord\.com\/invite)\/[A-Za-z0-9-]+$/;
const ADRESSE_TS = /^[A-Za-z0-9.-]+(:\d{1,5})?$/;

function lireVocal(form: FormData) {
  const vocal = choix(form, "vocal", Vocal);
  if (vocal === "DISCORD") {
    const lien = texte(form, "vocalDiscordLien", { requis: true, max: 200 })!;
    if (!LIEN_DISCORD.test(lien)) {
      throw new ErreurFormulaire("Le lien Discord doit ressembler à https://discord.gg/abc123.");
    }
    return { vocal, vocalDiscordLien: lien, vocalTsAdresse: null, vocalTsMotDePasse: null };
  }
  if (vocal === "TEAMSPEAK") {
    const adresse = texte(form, "vocalTsAdresse", { requis: true, max: 100 })!;
    if (!ADRESSE_TS.test(adresse)) {
      throw new ErreurFormulaire("L'adresse TeamSpeak doit ressembler à ts.mon-serveur.fr ou ts.mon-serveur.fr:9987.");
    }
    const motDePasse = texte(form, "vocalTsMotDePasse", { max: 100 });
    if (motDePasse && /\s/.test(motDePasse)) {
      throw new ErreurFormulaire("Le mot de passe TeamSpeak ne doit pas contenir d'espace.");
    }
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

    // La compo que le RL a déjà : uniquement les combinaisons possibles en jeu.
    const composition: { classe: Classe; role: Role; nombre: number }[] = [];
    for (const classe of Object.keys(rolesParClasse) as Classe[]) {
      for (const role of rolesParClasse[classe]) {
        const nombre = entier(form, `compo.${classe}.${role}`, { min: 0, max: taille }) ?? 0;
        if (nombre > 0) composition.push({ classe, role, nombre });
      }
    }
    const joueurs = composition.reduce((t, c) => t + c.nombre, 0);
    if (joueurs === 0) throw new ErreurFormulaire("Indique ta compo actuelle (compte-toi dedans).");
    if (joueurs >= taille) throw new ErreurFormulaire(`Ton raid a déjà ${joueurs} joueurs sur ${taille} : il ne reste aucune place.`);
    const nbPlaces = taille - joueurs;

    // Les besoins précis ; les places restantes sont libres.
    const toutes = Object.keys(Classe) as Classe[];
    const places: { role: Role | null; classesAcceptees: Classe[] }[] = [];
    const numerosDeLignes = [...form.keys()]
      .map((k) => /^exigences\.(\d+)\.nombre$/.exec(k)?.[1])
      .filter((n): n is string => n !== undefined)
      .slice(0, 20);
    for (const i of numerosDeLignes) {
      const nombre = entier(form, `exigences.${i}.nombre`, { min: 0, max: nbPlaces }) ?? 0;
      if (nombre === 0) continue;
      const classe = form.get(`exigences.${i}.classe`) ? choix(form, `exigences.${i}.classe`, Classe) : null;
      const role = form.get(`exigences.${i}.role`) ? choix(form, `exigences.${i}.role`, Role) : null;
      if (classe && role && !rolePossible(classe, role)) {
        throw new ErreurFormulaire(`Un ${libelleClasse[classe]} ne peut pas jouer ${libelleRole[role]}.`);
      }
      for (let n = 0; n < nombre; n++) places.push({ role, classesAcceptees: classe ? [classe] : toutes });
    }
    if (places.length > nbPlaces) {
      throw new ErreurFormulaire(`Tu demandes ${places.length} places précises, mais il n'en reste que ${nbPlaces}.`);
    }
    while (places.length < nbPlaces) places.push({ role: null, classesAcceptees: toutes });

    const vocal = lireVocal(form);
    const langue = String(form.get("langueRequise") ?? "");
    const dureeHeures = entier(form, "dureeHeures", { min: 1, max: 8 });

    const donnees = {
      createurId: utilisateur.id,
      contenu,
      faction: personnage.faction,
      ruleset: personnage.ruleset,
      region: personnage.region,
      organisateurPersonnageId: personnage.id,
      taille,
      debutUtc,
      dureeEstimee: dureeHeures ? dureeHeures * 60 : null,
      reglesLoot: choix(form, "reglesLoot", ReglesLoot),
      langueRequise: langue in LANGUES ? langue : null,
      ...vocal,
      niveauMin: entier(form, "niveauMin", { min: 1, max: 60 }),
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
      <form action={creerAnnonce} className="formulaire">
        <ChoixCompo
          fuseau={utilisateur.fuseauHoraire}
          personnage={
            <label className="champ">
              Avec quel personnage ?
              <select name="personnageId" required>
                {personnages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nom} — {libelleClasse[p.classe]}, {libelleFaction[p.faction]}, {libelleRuleset[p.ruleset]}{" "}
                    {p.region}
                  </option>
                ))}
              </select>
            </label>
          }
        />

        <h2>Organisation</h2>
        <div className="rangee">
          <label className="champ">
            Loot
            <select name="reglesLoot" required>
              {options(libelleReglesLoot).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label className="champ">
            Niveau minimum
            <input type="number" name="niveauMin" min={1} max={60} defaultValue={60} />
          </label>
          <label className="champ">
            Langue
            <select name="langueRequise" defaultValue="fr">
              {options(LANGUES).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
              <option value="">Peu importe</option>
            </select>
          </label>
        </div>
        <fieldset className="vocal">
          <legend>Vocal</legend>
          <div className="cases">
            {options(libelleVocal).map(([v, l]) => (
              <label key={v}>
                <input type="radio" name="vocal" value={v} defaultChecked={v === "AUCUN"} /> {l}
              </label>
            ))}
          </div>
          <div className="si-discord">
            <label className="champ">
              Lien d&apos;invitation Discord
              <input name="vocalDiscordLien" type="url" maxLength={200} placeholder="https://discord.gg/abc123" />
            </label>
          </div>
          <div className="si-teamspeak rangee">
            <label className="champ">
              Adresse du serveur TeamSpeak
              <input name="vocalTsAdresse" maxLength={100} placeholder="ts.mon-serveur.fr" />
            </label>
            <label className="champ">
              Mot de passe (facultatif)
              <input name="vocalTsMotDePasse" maxLength={100} />
            </label>
          </div>
          <p className="doux">
            Les joueurs ne verront jamais ces identifiants sur le site : le bot WhenRaid les enverra en MP aux joueurs
            confirmés quand tu enverras les invitations.
          </p>
        </fieldset>
        <p className="doux">
          À la fin prévue (début + durée), le bot t&apos;enverra un MP pour valider les présences. Sans validation sous
          24 h, tous les joueurs confirmés seront comptés présents.
        </p>
        <div>
          <BoutonEnvoi className="principal" enCours="Publication…">
            Publier le raid
          </BoutonEnvoi>
        </div>
      </form>
    </main>
  );
}
