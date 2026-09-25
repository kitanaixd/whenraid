import Image from "next/image";
import Link from "next/link";
import { signIn } from "@/lib/auth";
import { utilisateurConnecte } from "@/lib/session";
import { db } from "@/lib/db";
import { afficherDate, afficherDateCourte, jourAffiche, jourLocal } from "@/lib/dates";
import { nomRaid, raids } from "@/lib/raids";
import { affecterGroupe, rolesPourRaid } from "@/lib/eligibilite";
import { groupeHomogene, mesGroupes } from "@/lib/groupes";
import { chargerMesRaids } from "@/lib/mesRaids";
import { fiabiliteRls } from "@/lib/fiabilite";
import { BadgeFiabilite } from "./BadgeFiabilite";
import { IconeCroix, IconePlus } from "./Icones";
import { includeLigneRaid, resumeLigneRaid } from "@/lib/ligneRaid";
import { Contenu } from "@/generated/prisma/enums";
import {
  ClasseIcone,
  FactionIcone,
  NomClasse,
  NomRole,
  PastilleFaction,
  PastilleRuleset,
  RoleIcone,
} from "./ClasseIcone";
import { EnteteListe, GroupeInscrit, LigneListe, type Marque } from "./LigneListe";
import { Calendrier } from "./Calendrier";
import { MemoriserChoix } from "./MemoriserChoix";
import { COOKIE_CHOIX } from "@/lib/choixListe";
import { cookies } from "next/headers";
import { FormulaireAuto } from "./FormulaireAuto";
import { CurseurDuree } from "./CurseurDuree";
import { candidater, seDesinscrire } from "./annonces/[id]/actions";
import { BoutonDesinscrire } from "./annonces/[id]/BoutonDesinscrire";
import { nomEnJeu, rolePossible } from "@/lib/jeu";
import { dicoCourant } from "@/lib/langue";

const DUREES_MAX = [2, 3, 4, 6];
/** Paramètres de la liste gardés d'un lien à l'autre (personnage, filtres, mois du calendrier). */
const PARAMETRES = ["perso", "groupe", "raid", "jour", "mois", "duree", "q", "afficher", "spe", "tri"] as const;
/** Catégories de raids qu'on peut afficher ou cacher (filtre « Afficher »). */
const CATEGORIES = ["organise", "candidatures", "convie", "autres"] as const;
type Categorie = (typeof CATEGORIES)[number];

/** Texte comparable : minuscules, sans accents (« Hyjal Déjà » ≈ « hyjal deja »). */
const sansAccents = (texte: string) =>
  texte
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
type Parametres = Partial<Record<(typeof PARAMETRES)[number], string | null>>;

export default async function Accueil({ searchParams }: PageProps<"/">) {
  const [utilisateur, d] = await Promise.all([utilisateurConnecte(), dicoCourant()]);

  if (!utilisateur) {
    return (
      <main className="accueil-visiteur">
        <Image src="/logo.webp" alt="Logo WhenRaid" width={315} height={256} priority />
        <p className="surtitre">{d.accueil.visiteurSurtitre}</p>
        <h1>WhenRaid</h1>
        <div className="ornement" aria-hidden="true">
          ◆
        </div>
        <p className="accroche">{d.accueil.accroche}</p>
        <form
          action={async () => {
            "use server";
            await signIn("discord", { redirectTo: "/" });
          }}
        >
          <button type="submit" className="principal">
            {d.accueil.seConnecter}
          </button>
        </form>
        <p>
          <small>{d.accueil.rejoindreDiscord}</small>
        </p>
      </main>
    );
  }

  const fuseau = utilisateur.fuseauHoraire;
  const filtres = await searchParams;
  const valeur = (nom: string) => {
    const v = filtres[nom];
    return typeof v === "string" ? v : Array.isArray(v) ? v.join(",") : "";
  };
  // Raids choisis (plusieurs possibles) : « raid » répété par les cases, ou séparé par des virgules.
  const contenus = [...new Set(valeur("raid").split(","))].filter((c): c is Contenu => c in Contenu);
  const jour = /^\d{4}-\d{2}-\d{2}$/.test(valeur("jour")) ? valeur("jour") : null;
  const dureeMax = DUREES_MAX.includes(Number(valeur("duree"))) ? Number(valeur("duree")) : null;
  const aujourdHui = jourLocal(new Date(), fuseau);
  const mois = /^\d{4}-\d{2}$/.test(valeur("mois")) ? valeur("mois") : (jour ?? aujourdHui).slice(0, 7);

  /** Adresse de la liste avec les paramètres actuels, modifiés par `changements` (null = retiré). */
  const lienListe = (changements: Parametres) => {
    const params = new URLSearchParams();
    for (const nom of PARAMETRES) {
      const v = nom in changements ? changements[nom] : valeur(nom);
      if (v) params.set(nom, v);
    }
    const requete = params.toString();
    return requete ? `/?${requete}` : "/";
  };

  const [personnages, groupes] = await Promise.all([
    db.personnage.findMany({
      where: { utilisateurId: utilisateur.id, supprimeLe: null },
      orderBy: [{ estPrincipal: "desc" }, { nom: "asc" }],
    }),
    mesGroupes(utilisateur.id),
  ]);
  // Le joueur cherche un raid pour un de ses groupes, ou pour un personnage (par défaut : son principal).
  // Sans choix dans l'adresse, on reprend le dernier personnage ou groupe choisi (cookie).
  const biscuits = await cookies();
  const [typeRetenu, idRetenu] = (biscuits.get(COOKIE_CHOIX)?.value ?? "").split(":");
  const sansChoix = !valeur("groupe") && !valeur("perso");
  const groupeId = valeur("groupe") || (sansChoix && typeRetenu === "groupe" ? idRetenu : "");
  const persoId = valeur("perso") || (sansChoix && typeRetenu === "perso" ? idRetenu : "");
  const groupe = groupes.find((g) => g.id === groupeId);
  const persoChoisi = personnages.find((p) => p.id === persoId) ?? personnages[0];
  // Avec un groupe, la liste suit la faction, le ruleset et la région de mon personnage dans ce groupe.
  const perso = groupe ? groupe.membres.find((m) => m.utilisateurId === utilisateur.id)?.personnage : persoChoisi;
  // Un groupe ne peut candidater que si tous ses personnages existent encore et vont ensemble.
  const groupeValide =
    groupe && groupe.membres.every((m) => !m.personnage.supprimeLe) && groupeHomogene(groupe.membres);

  const [annoncesBrutes, mesRaids] = await Promise.all([
    perso
      ? db.annonce.findMany({
          where: {
            statut: { in: ["PUBLIEE", "COMPLETE"] },
            debutUtc: { gt: new Date() },
            ...(contenus.length > 0 && { contenu: { in: contenus } }),
            ...(dureeMax && { dureeEstimee: { lte: dureeMax * 60 } }),
            // Premier tri en base : même faction, ruleset et région que le personnage choisi.
            faction: perso.faction,
            ruleset: perso.ruleset,
            region: perso.region,
          },
          orderBy: { debutUtc: "asc" },
          take: 200,
          include: includeLigneRaid,
        })
      : Promise.resolve([]),
    chargerMesRaids(utilisateur.id),
  ]);
  const { convocations, candidatures, organises } = mesRaids;
  // Mes inscriptions en cours, par raid (tous personnages confondus) : pour marquer les lignes.
  const monInscription = new Map([...convocations, ...candidatures].map((i) => [i.place.annonce.id, i]));
  // Un raid n'apparaît que si le personnage choisi peut y tenir une place (classe, niveau…),
  // ou s'il y a déjà candidaté.
  // Filtre « Afficher » : les catégories cochées (toutes par défaut). « _ » marque un choix
  // fait (même vide), pour distinguer « rien de coché » de « pas de filtre ».
  const afficherBrut = valeur("afficher");
  const affichees = new Set<Categorie>(
    afficherBrut ? CATEGORIES.filter((c) => afficherBrut.split(",").includes(c)) : CATEGORIES,
  );
  const cachees = CATEGORIES.filter((c) => !affichees.has(c));
  const categorieDe = (a: { id: string; createurId: string }): Categorie => {
    if (a.createurId === utilisateur.id) return "organise";
    const i = monInscription.get(a.id);
    if (!i) return "autres";
    return i.statut === "CONFIRME" ? "convie" : "candidatures";
  };
  const ouverts = perso
    ? annoncesBrutes.filter(
        (a) =>
          affichees.has(categorieDe(a)) &&
          (monInscription.get(a.id)?.personnageId === perso.id ||
            (groupe
              ? groupeValide &&
                affecterGroupe(
                  a.places,
                  groupe.membres.map((m) => ({ perso: m.personnage, roles: m.roles })),
                  a,
                  ["OUVERTE", "POURVUE"],
                ) !== null
              : rolesPourRaid(perso, a.places, a).length > 0)),
      )
    : [];
  // « Ma spé manque » (seul, pas en groupe) : la compo n'a pas encore ma classe dans l'un de mes rôles.
  const speManquante = !groupe && valeur("spe") === "1" && perso;
  const rolesDeMaSpe = perso ? perso.rolesJouables.filter((r) => rolePossible(perso.classe, r)) : [];
  const visibles = speManquante
    ? ouverts.filter((a) => {
        const lignes = resumeLigneRaid(a).lignes;
        return rolesDeMaSpe.some((r) => !lignes.some((l) => l.classe === perso.classe && l.role === r && l.nombre > 0));
      })
    : ouverts;
  // Le calendrier compte les raids de chaque jour ; la liste ne garde que le jour choisi.
  const raidsParJour = new Map<string, number>();
  for (const a of visibles) {
    const j = jourLocal(a.debutUtc, fuseau);
    raidsParJour.set(j, (raidsParJour.get(j) ?? 0) + 1);
  }
  // Recherche : dans le titre donné par le RL et dans le nom du raid.
  const recherche = valeur("q").trim().slice(0, 40);
  const cherche = sansAccents(recherche);
  // Tri : par date (défaut) ou par remplissage (les plus proches d'être complets d'abord ;
  // les raids déjà complets, où l'on ne peut plus entrer, passent en dernier).
  const tri = valeur("tri") === "roster" ? "roster" : "date";
  const remplissage = (a: (typeof ouverts)[number]) =>
    a.statut === "COMPLETE" ? -1 : resumeLigneRaid(a).total / a.taille;
  const annonces = visibles
    .filter((a) => !jour || jourLocal(a.debutUtc, fuseau) === jour)
    .filter((a) => !cherche || sansAccents(`${a.titre ?? ""} ${nomRaid(a.contenu, d)}`).includes(cherche))
    .sort((x, y) =>
      tri === "roster"
        ? remplissage(y) - remplissage(x) || x.debutUtc.getTime() - y.debutUtc.getTime()
        : x.debutUtc.getTime() - y.debutUtc.getTime(),
    )
    .slice(0, 50);
  const fiabilite = await fiabiliteRls([...new Set(annonces.map((a) => a.createurId))]);
  const rolesPerso = perso ? perso.rolesJouables.filter((r) => rolePossible(perso.classe, r)) : [];
  const requete = lienListe({}).replace(/^\/\??/, "");
  const erreur = valeur("erreur");
  const filtreActif = Boolean(
    contenus.length > 0 || jour || dureeMax || recherche || cachees.length > 0 || speManquante,
  );
  /** Adresse avec les catégories affichées changées (toutes affichées : plus de paramètre). */
  const afficherAvec = (categories: Categorie[]) =>
    categories.length === CATEGORIES.length ? null : ["_", ...categories].join(",");
  /** Champs cachés qui gardent les paramètres actuels de la liste, sauf `sauf`. */
  const champsCaches = (...sauf: (typeof PARAMETRES)[number][]) =>
    PARAMETRES.filter((nom) => !sauf.includes(nom) && valeur(nom)).map((nom) => (
      <input key={nom} type="hidden" name={nom} value={valeur(nom)} />
    ));

  /** Bouton « Annuler » (ou « Me désister ») pour un raid où je suis inscrit. */
  const annulation = (annonceId: string) => {
    const i = monInscription.get(annonceId);
    if (!i) return undefined;
    const a = i.place.annonce;
    return (
      <BoutonDesinscrire
        action={seDesinscrire}
        inscriptionId={i.id}
        resume={`${nomRaid(a.contenu, d)} — ${afficherDate(a.debutUtc, fuseau, d)}`}
        convie={i.statut === "CONFIRME"}
        retourListe={requete}
      />
    );
  };

  /** Ce qui distingue un raid où je suis inscrit ou que j'organise. */
  const marqueDe = (annonceId: string, createurId: string): Marque | undefined => {
    if (createurId === utilisateur.id) return { type: "organise", texte: d.accueil.votreRaid };
    const i = monInscription.get(annonceId);
    if (!i) return undefined;
    const perso = i.personnage ? { classe: i.personnage.classe, nom: nomEnJeu(i.personnage) } : undefined;
    // Candidature de groupe : le nom du groupe et les classes des membres inscrits sur ce raid.
    const groupe =
      i.escouadeId && i.escouade
        ? {
            nom: i.escouade.nom,
            classes: i.place.annonce.places
              .flatMap((p) => p.inscriptions)
              .filter((x) => x.escouadeId === i.escouadeId && x.personnage)
              .map((x) => x.personnage!.classe),
          }
        : undefined;
    if (i.statut === "CONFIRME") return { type: "convie", texte: d.accueil.convie, perso, groupe };
    if (i.statut === "LISTE_ATTENTE") return { type: "attente", texte: d.accueil.reserve, perso, groupe };
    return { type: "candidat", texte: d.accueil.listeAttente, perso, groupe };
  };

  // Prochains raids : organisés, convocations et candidatures, du plus proche au plus lointain.
  const prochains = [
    ...organises.map((a) => {
      const marque: Marque = { type: "organise", texte: d.accueil.votreRaid };
      return { cle: a.id, annonce: a, marque, action: undefined };
    }),
    ...[...convocations, ...candidatures].map((i) => ({
      cle: i.id,
      annonce: i.place.annonce,
      marque: marqueDe(i.place.annonce.id, i.place.annonce.createurId),
      action: annulation(i.place.annonce.id),
    })),
  ].sort((x, y) => x.annonce.debutUtc.getTime() - y.annonce.debutUtc.getTime());

  /** Pastille d'un filtre actif, avec une croix pour le retirer. */
  const filtreRetirable = (libelle: React.ReactNode, sans: Parametres) => (
    <Link
      href={lienListe(sans)}
      className="pastille filtre-actif"
      aria-label={`${d.accueil.retirerFiltre} : ${String(libelle)}`}
    >
      {libelle}
      <IconeCroix />
    </Link>
  );

  return (
    <main className="accueil-large">
      <header className="accueil-connecte">
        <p className="surtitre">WoW Forever · {utilisateur.pseudo}</p>
        <h1>{d.accueil.titre}</h1>
      </header>

      {personnages.length === 0 ? (
        <section className="parchemin">
          <div className="encadre appel-perso">
            <p>{d.accueil.declarePerso}</p>
            <Link href="/personnages" className="bouton principal">
              {d.accueil.creerPerso}
            </Link>
          </div>
        </section>
      ) : (
        <div className="accueil-grille">
          {perso && <MemoriserChoix valeur={groupe ? `groupe:${groupe.id}` : `perso:${perso.id}`} />}
          {/* ─── À gauche : calendrier, durée et prochains raids (reste visible au défilement) ─── */}
          <aside className="accueil-filtres">
            <Calendrier
              mois={mois}
              jourChoisi={jour}
              aujourdHui={aujourdHui}
              raidsParJour={raidsParJour}
              lien={(j, m) => lienListe({ jour: j, mois: m })}
              d={d}
            >
              {/* Durée : un curseur, appliqué au relâchement. */}
              <CurseurDuree
                key={`duree-${dureeMax ?? ""}`}
                valeurs={DUREES_MAX}
                choisie={dureeMax}
                etiquettes={[...DUREES_MAX.map((h) => d.accueil.heuresMax(h)), d.accueil.toutes]}
                courtes={[...DUREES_MAX.map((h) => `${h} h`), "∞"]}
                label={d.accueil.duree}
              >
                {champsCaches("duree")}
              </CurseurDuree>
            </Calendrier>
            <section className="carte prochains" aria-labelledby="titre-prochains">
              <p className="surtitre" id="titre-prochains">
                {d.accueil.prochainsRaids}
              </p>
              {prochains.length === 0 ? (
                <p className="doux">{d.accueil.aucunProchain}</p>
              ) : (
                <ul className="liste-prochains">
                  {prochains.map(({ cle, annonce: a, marque, action }) => {
                    // Bulle des candidatures : seulement sur les raids que j'organise.
                    const enAttente = a.createurId === utilisateur.id ? resumeLigneRaid(a).enAttente : 0;
                    return (
                      // Toute la carte mène au raid (le lien la recouvre) ; le bouton d'action reste au-dessus.
                      <li key={cle} className={`prochain ligne-${marque?.type ?? ""} ${action ? "avec-action" : ""}`}>
                        {enAttente > 0 && (
                          <span className="bulle-candidatures" title={d.accueil.candidatures(enAttente)}>
                            <span aria-hidden="true">{enAttente}</span>
                            <span className="sr-only">{d.accueil.candidatures(enAttente)}</span>
                          </span>
                        )}
                        <Link href={`/annonces/${a.id}`} className="prochain-lien">
                          <strong>{a.titre ?? nomRaid(a.contenu, d)}</strong>
                          <span className="doux">
                            {a.titre && `${nomRaid(a.contenu, d)} · `}
                            {afficherDateCourte(a.debutUtc, fuseau)}
                          </span>
                        </Link>
                        <div className="prochain-bas">
                          {marque && <span className={`badge-raid badge-raid-${marque.type}`}>{marque.texte}</span>}
                          {marque?.groupe ? (
                            <GroupeInscrit groupe={marque.groupe} />
                          ) : (
                            marque?.perso && <ClasseIcone classe={marque.perso.classe} taille={18} />
                          )}
                          {marque?.detail && <span className="doux">{marque.detail}</span>}
                        </div>
                        {action && <span className="prochain-action">{action}</span>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </aside>

          {/* ─── Au centre : la liste des raids ─── */}
          <section className="accueil-centre" id="titre-raids" aria-label={d.accueil.raidsTitre}>
            {/* Choix du raid : une ligne de chips (plusieurs raids possibles), appliquée au clic. */}
            <FormulaireAuto key={`raid-${valeur("raid")}`} className="filtre-raids" label={d.calendrier.choixRaid}>
              {champsCaches("raid")}
              <fieldset className="rapide-roles choix-raids">
                <legend>{d.champ.raid}</legend>
                {(Object.keys(raids) as Contenu[]).map((c) => (
                  <label key={c} className="case-role">
                    <input type="checkbox" name="raid" value={c} defaultChecked={contenus.includes(c)} />
                    {nomRaid(c, d)}
                  </label>
                ))}
              </fieldset>
            </FormulaireAuto>
            {/* Afficher : mes raids, mes candidatures, là où je suis convié, les autres (cocher = afficher). */}
            <FormulaireAuto
              key={`afficher-${afficherBrut}-${valeur("spe")}`}
              className="filtre-afficher"
              label={d.accueil.afficher}
            >
              {champsCaches("afficher", "spe")}
              <input type="hidden" name="afficher" value="_" />
              <fieldset className="rapide-roles choix-raids">
                <legend>{d.accueil.afficher}</legend>
                {CATEGORIES.map((c) => (
                  <label key={c} className="case-role">
                    <input type="checkbox" name="afficher" value={c} defaultChecked={affichees.has(c)} />
                    {d.accueil.categories[c]}
                  </label>
                ))}
                {!groupe && perso && (
                  <label className="case-role spe-manquante" title={d.accueil.maSpeAide}>
                    <input type="checkbox" name="spe" value="1" defaultChecked={Boolean(speManquante)} />
                    {d.accueil.maSpe(d.classe[perso.classe])}
                  </label>
                )}
              </fieldset>
            </FormulaireAuto>
            {/* Recherche par titre : garde le personnage et les autres filtres. */}
            <div className="recherche-et-vue">
              <form className="recherche-raids" method="get" role="search" aria-label={d.accueil.rechercheAria}>
                {champsCaches("q")}
                <input
                  type="search"
                  name="q"
                  defaultValue={recherche}
                  placeholder={d.accueil.rechercher}
                  aria-label={d.accueil.rechercheAria}
                  maxLength={40}
                  autoComplete="off"
                />
              </form>
              <nav className="choix-tri" aria-label={d.accueil.tri.aria}>
                {(["date", "roster"] as const).map((t) => (
                  <Link
                    key={t}
                    href={lienListe({ tri: t === "date" ? null : t })}
                    className={tri === t ? "actif" : undefined}
                    aria-current={tri === t ? "true" : undefined}
                  >
                    {d.accueil.tri[t]}
                  </Link>
                ))}
              </nav>
            </div>
            {typeof erreur === "string" && erreur && (
              <p className="avertissement grave" role="alert">
                ⚠ {erreur}
              </p>
            )}
            {annonces.length === 0 ? (
              /* Aucun raid : un encart avec un vrai bouton pour en créer un. */
              <div className="carte liste-vide">
                <p>
                  {filtreActif
                    ? d.accueil.aucunFiltre
                    : d.accueil.aucunRaid(perso ? nomEnJeu(perso) : d.accueil.ceperso)}
                </p>
                <Link href="/annonces/nouvelle" className="bouton principal">
                  {d.entete.creerRaid}
                </Link>
              </div>
            ) : (
              <ul className="liste-raids vue-liste">
                <EnteteListe
                  d={d}
                  tri={tri}
                  lienDate={lienListe({ tri: null })}
                  lienRoster={lienListe({ tri: "roster" })}
                />
                {annonces.map((a) => {
                  const marque = marqueDe(a.id, a.createurId);
                  const libelleBouton = a.statut === "COMPLETE" ? d.accueil.reserveAria : d.accueil.candidater;
                  return (
                    <LigneListe
                      key={a.id}
                      annonce={a}
                      fuseau={fuseau}
                      d={d}
                      lien={`/annonces/${a.id}${perso ? `?perso=${perso.id}` : ""}`}
                      marque={marque}
                      bulleCandidatures={a.createurId === utilisateur.id}
                      auteur={
                        <>
                          <span className="liste-rl">{d.accueil.par(a.createur.pseudo)}</span>
                          <BadgeFiabilite fiabilite={fiabilite.get(a.createurId)} compact />
                        </>
                      }
                      action={
                        marque ? (
                          annulation(a.id)
                        ) : (
                          <button
                            type="submit"
                            form="candidature-rapide"
                            name="annonceId"
                            value={a.id}
                            className="bouton-icone principal"
                            aria-label={libelleBouton}
                            title={libelleBouton}
                          >
                            <IconePlus />
                          </button>
                        )
                      }
                    />
                  );
                })}
              </ul>
            )}
          </section>

          {/* ─── À droite : vue filtrée, personnage et candidature rapide (reste visible) ─── */}
          <aside className="accueil-perso">
            {perso && (
              /* La vue est déjà filtrée sur le personnage : on le montre, avec les filtres actifs. */
              <section className="carte filtres-actifs" aria-label={d.accueil.vueFiltree}>
                <p className="surtitre">{d.accueil.vueFiltree}</p>
                <div className="pastilles">
                  {groupe ? (
                    <span className="pastille">👥 {groupe.nom}</span>
                  ) : (
                    <span className="pastille">
                      <NomClasse classe={perso.classe} taille={16} />
                    </span>
                  )}
                  <PastilleFaction faction={perso.faction} />
                  <PastilleRuleset ruleset={perso.ruleset} region={perso.region} />
                  {jour &&
                    filtreRetirable(d.accueil.leJour(jourAffiche(jour)), {
                      jour: null,
                    })}
                  {recherche && filtreRetirable(d.accueil.recherche(recherche), { q: null })}
                  {speManquante && filtreRetirable(d.accueil.maSpe(d.classe[perso.classe]), { spe: null })}
                  {cachees.map((c) => (
                    <span key={c}>
                      {filtreRetirable(d.accueil.sansCategorie(d.accueil.categories[c]), {
                        afficher: afficherAvec([...affichees, c]),
                      })}
                    </span>
                  ))}
                  {contenus.map((c) => (
                    <span key={c}>
                      {filtreRetirable(nomRaid(c, d), { raid: contenus.filter((x) => x !== c).join(",") || null })}
                    </span>
                  ))}
                  {dureeMax &&
                    filtreRetirable(d.accueil.heuresMax(dureeMax), {
                      duree: null,
                    })}
                </div>
                {filtreActif && (
                  <Link href={lienListe({ jour: null, raid: null, duree: null, q: null })} className="lien-discret">
                    {d.accueil.toutEffacer}
                  </Link>
                )}
              </section>
            )}
            <nav className="carte choix-perso" aria-label={d.accueil.chercheRaidPourAria}>
              <p className="surtitre">{d.accueil.chercheRaidPour}</p>
              {perso && (
                // La note part avec la candidature rapide (formulaire plus bas, relié par form=).
                <label className="champ rapide-note">
                  {d.accueil.noteRl} <small className="fuseau">{d.accueil.noteRlAide}</small>
                  <input name="note" form="candidature-rapide" maxLength={80} placeholder={d.accueil.notePlaceholder} />
                </label>
              )}
              <ul>
                {personnages.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={lienListe({ perso: p.id, groupe: null, jour: null })}
                      className={`perso-choix ${!groupe && p.id === perso?.id ? "choisi" : ""}`}
                      aria-current={!groupe && p.id === perso?.id ? "true" : undefined}
                    >
                      <ClasseIcone classe={p.classe} taille={24} />
                      <span
                        className="classe"
                        style={
                          {
                            "--c": `var(--classe-${p.classe})`,
                          } as React.CSSProperties
                        }
                      >
                        {nomEnJeu(p)}
                      </span>
                      <span className="ruleset-perso">({d.ruleset[p.ruleset]})</span>
                      <FactionIcone faction={p.faction} taille={16} />
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="surtitre sous-titre-groupes">{d.groupes.rubrique}</p>
              {groupes.length > 0 && (
                <ul>
                  {groupes.map((g) => (
                    <li key={g.id}>
                      <Link
                        href={lienListe({ groupe: g.id, perso: null, jour: null })}
                        className={`perso-choix groupe-choix ${g.id === groupe?.id ? "choisi" : ""}`}
                        aria-current={g.id === groupe?.id ? "true" : undefined}
                      >
                        <span className="groupe-icones">
                          {g.membres.map((m) => (
                            <ClasseIcone key={m.id} classe={m.personnage.classe} taille={20} />
                          ))}
                        </span>
                        <span>{g.nom}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              <div className="boutons-groupes">
                <Link href="/groupes" className="bouton petit">
                  {d.groupes.gererGroupes}
                </Link>
              </div>
              {perso && (
                /* Candidature rapide : rôle(s) et note choisis une fois, puis « + » sur chaque raid.
                 Les boutons des lignes envoient ce formulaire avec l'identifiant de leur raid. */
                <form id="candidature-rapide" action={candidater} className="candidature-rapide integree">
                  <input type="hidden" name="depuis" value="liste" />
                  <input type="hidden" name="retour" value={requete} />
                  {groupe ? (
                    <>
                      <input type="hidden" name="escouadeId" value={groupe.id} />
                      <p className="surtitre">{d.groupes.candidatureDe(groupe.nom)}</p>
                      <ul className="membres-rapide">
                        {groupe.membres.map((m) => (
                          <li key={m.id}>
                            <ClasseIcone classe={m.personnage.classe} taille={20} />
                            <span
                              className="classe"
                              style={{ "--c": `var(--classe-${m.personnage.classe})` } as React.CSSProperties}
                            >
                              {nomEnJeu(m.personnage)}
                            </span>
                            <span className="roles-proposes">
                              {m.roles.map((r) => (
                                <RoleIcone key={r} role={r} taille={18} />
                              ))}
                            </span>
                          </li>
                        ))}
                      </ul>
                      {groupe.membres.length < 2 ? (
                        <p className="doux">{d.groupes.seul}</p>
                      ) : !groupeValide ? (
                        <p className="avertissement">{d.groupes.factionsMelangees}</p>
                      ) : (
                        <p className="doux">{d.groupes.toutOuRien}</p>
                      )}
                    </>
                  ) : (
                    <>
                      <input type="hidden" name="personnageId" value={perso.id} />
                      <p className="surtitre">{d.accueil.rapide(nomEnJeu(perso))}</p>
                      <fieldset className="rapide-roles">
                        <legend className="sr-only">{d.accueil.rolesProposes}</legend>
                        {rolesPerso.map((r, n) => (
                          <label key={r} className="case-role">
                            <input type="checkbox" name="roles" value={r} defaultChecked={n === 0} />
                            <NomRole role={r} taille={18} />
                          </label>
                        ))}
                      </fieldset>
                    </>
                  )}
                </form>
              )}
            </nav>
          </aside>
        </div>
      )}
    </main>
  );
}
