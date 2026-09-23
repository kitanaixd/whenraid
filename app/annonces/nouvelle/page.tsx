import Link from "next/link";
import { redirect } from "next/navigation";
import { Classe, Contenu, ReglesLoot, Role, Vocal } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { exigerUtilisateur } from "@/lib/session";
import { localVersUtc } from "@/lib/dates";
import { raids } from "@/lib/raids";
import { LIGNES_EXIGENCES, rolePossible, rolesParClasse } from "@/lib/jeu";
import { ChoixCompo } from "./ChoixCompo";
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

// Ces valeurs seront envoyées en jeu par /w : pas d'espace, format strict.
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
    for (const i of LIGNES_EXIGENCES) {
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
        ...vocal,
        niveauMin: entier(form, "niveauMin", { min: 1, max: 60 }),
        statut: "PUBLIEE",
        publieeLe: new Date(),
        composition: { create: composition },
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
        <ChoixCompo />
        <h2>Quand et comment</h2>
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
        </p>
        <fieldset className="vocal">
          <legend>Vocal</legend>
          {options(libelleVocal).map(([v, l]) => (
            <label key={v}>
              <input type="radio" name="vocal" value={v} defaultChecked={v === "AUCUN"} /> {l}{" "}
            </label>
          ))}
          <p className="si-discord">
            <label>
              Lien d&apos;invitation Discord{" "}
              <input name="vocalDiscordLien" type="url" maxLength={200} placeholder="https://discord.gg/abc123" />
            </label>
          </p>
          <p className="si-teamspeak">
            <label>
              Adresse du serveur TeamSpeak{" "}
              <input name="vocalTsAdresse" maxLength={100} placeholder="ts.mon-serveur.fr" />
            </label>{" "}
            <label>
              Mot de passe (facultatif) <input name="vocalTsMotDePasse" maxLength={100} />
            </label>
          </p>
          <p>
            <small>
              Les joueurs ne verront jamais ces identifiants sur le site : ils leur seront envoyés en jeu par
              l&apos;addon au moment du raid.
            </small>
          </p>
        </fieldset>

        <p>
          <button type="submit">Publier le raid</button>
        </p>
      </form>
    </main>
  );
}
