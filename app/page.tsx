import Image from "next/image";
import Link from "next/link";
import { signIn } from "@/lib/auth";
import { utilisateurConnecte } from "@/lib/session";
import { db } from "@/lib/db";
import { afficherDate, afficherDateCourte, jourAffiche, jourLocal } from "@/lib/dates";
import { nomRaid, raids } from "@/lib/raids";
import { rolesPourRaid } from "@/lib/eligibilite";
import { chargerMesRaids } from "@/lib/mesRaids";
import { fiabiliteRls } from "@/lib/fiabilite";
import { BadgeFiabilite } from "./BadgeFiabilite";
import { IconeCroix, IconePlus } from "./Icones";
import { includeLigneRaid, resumeLigneRaid } from "@/lib/ligneRaid";
import { Contenu } from "@/generated/prisma/enums";
import { ClasseIcone, FactionIcone, NomClasse, NomRole, PastilleFaction, PastilleRuleset } from "./ClasseIcone";
import { LigneRaid, type Marque } from "./LigneRaid";
import { Calendrier } from "./Calendrier";
import { candidater, seDesinscrire } from "./annonces/[id]/actions";
import { BoutonDesinscrire } from "./annonces/[id]/BoutonDesinscrire";
import { nomEnJeu, rolePossible } from "@/lib/jeu";
import { dicoCourant } from "@/lib/langue";

const DUREES_MAX = [2, 3, 4, 6];
/** Paramètres de la liste gardés d'un lien à l'autre (personnage, filtres, mois du calendrier). */
const PARAMETRES = ["perso", "raid", "jour", "mois", "duree"] as const;
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
  const valeur = (nom: string) => (typeof filtres[nom] === "string" ? (filtres[nom] as string) : "");
  const contenu = valeur("raid") in Contenu ? (valeur("raid") as Contenu) : null;
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

  const personnages = await db.personnage.findMany({
    where: { utilisateurId: utilisateur.id, supprimeLe: null },
    orderBy: [{ estPrincipal: "desc" }, { nom: "asc" }],
  });
  // Le joueur choisit le personnage pour lequel il cherche un raid (par défaut : son principal).
  const perso = personnages.find((p) => p.id === valeur("perso")) ?? personnages[0];

  const [annoncesBrutes, mesRaids] = await Promise.all([
    perso
      ? db.annonce.findMany({
          where: {
            statut: { in: ["PUBLIEE", "COMPLETE"] },
            debutUtc: { gt: new Date() },
            ...(contenu && { contenu }),
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
  const ouverts = perso
    ? annoncesBrutes.filter(
        (a) => monInscription.get(a.id)?.personnageId === perso.id || rolesPourRaid(perso, a.places, a).length > 0,
      )
    : [];
  // Le calendrier compte les raids de chaque jour ; la liste ne garde que le jour choisi.
  const raidsParJour = new Map<string, number>();
  for (const a of ouverts) {
    const j = jourLocal(a.debutUtc, fuseau);
    raidsParJour.set(j, (raidsParJour.get(j) ?? 0) + 1);
  }
  const annonces = (jour ? ouverts.filter((a) => jourLocal(a.debutUtc, fuseau) === jour) : ouverts).slice(0, 50);
  const fiabilite = await fiabiliteRls([...new Set(annonces.map((a) => a.createurId))]);
  const rolesPerso = perso ? perso.rolesJouables.filter((r) => rolePossible(perso.classe, r)) : [];
  const requete = lienListe({}).replace(/^\/\??/, "");
  const erreur = valeur("erreur");
  const filtreActif = Boolean(contenu || jour || dureeMax);

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
    if (i.statut === "CONFIRME") return { type: "convie", texte: d.accueil.convie, perso };
    if (i.statut === "LISTE_ATTENTE") return { type: "attente", texte: d.accueil.reserve, perso };
    return { type: "candidat", texte: d.accueil.listeAttente, perso };
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
          {/* ─── À gauche : vue filtrée, choix du raid et calendrier (reste visible au défilement) ─── */}
          <aside className="accueil-filtres">
            {perso && (
              /* La vue est déjà filtrée sur le personnage : on le montre, avec les filtres actifs. */
              <section className="carte filtres-actifs" aria-label={d.accueil.vueFiltree}>
                <p className="surtitre">{d.accueil.vueFiltree}</p>
                <div className="pastilles">
                  <span className="pastille">
                    <NomClasse classe={perso.classe} taille={16} /> {d.commun.niv(perso.niveau)}
                  </span>
                  <PastilleFaction faction={perso.faction} />
                  <PastilleRuleset ruleset={perso.ruleset} region={perso.region} />
                  {jour &&
                    filtreRetirable(d.accueil.leJour(jourAffiche(jour)), {
                      jour: null,
                    })}
                  {contenu && filtreRetirable(nomRaid(contenu, d), { raid: null })}
                  {dureeMax &&
                    filtreRetirable(d.accueil.heuresMax(dureeMax), {
                      duree: null,
                    })}
                </div>
                {filtreActif && (
                  <Link href={lienListe({ jour: null, raid: null, duree: null })} className="lien-discret">
                    {d.accueil.toutEffacer}
                  </Link>
                )}
              </section>
            )}
            <form className="carte filtres" method="get" role="search" aria-label={d.accueil.filtrerAria}>
              <p className="surtitre">{d.calendrier.choixRaid}</p>
              {perso && <input type="hidden" name="perso" value={perso.id} />}
              {jour && <input type="hidden" name="jour" value={jour} />}
              <input type="hidden" name="mois" value={mois} />
              <label className="champ">
                {d.champ.raid}
                <select name="raid" defaultValue={contenu ?? ""}>
                  <option value="">{d.accueil.tousLesRaids}</option>
                  {(Object.keys(raids) as Contenu[]).map((c) => (
                    <option key={c} value={c}>
                      {nomRaid(c, d)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="champ">
                {d.accueil.duree}
                <select name="duree" defaultValue={dureeMax ?? ""}>
                  <option value="">{d.accueil.toutes}</option>
                  {DUREES_MAX.map((h) => (
                    <option key={h} value={h}>
                      {d.accueil.heuresMax(h)}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" className="principal petit">
                {d.accueil.filtrer}
              </button>
            </form>
            <Calendrier
              mois={mois}
              jourChoisi={jour}
              aujourdHui={aujourdHui}
              raidsParJour={raidsParJour}
              lien={(j, m) => lienListe({ jour: j, mois: m })}
              d={d}
            />
          </aside>

          {/* ─── Au centre : la liste des raids ─── */}
          <section className="accueil-centre" id="titre-raids" aria-label={d.accueil.raidsTitre}>
            {typeof erreur === "string" && erreur && (
              <p className="avertissement grave" role="alert">
                ⚠ {erreur}
              </p>
            )}
            {annonces.length === 0 ? (
              <p className="doux">
                {filtreActif ? d.accueil.aucunFiltre : d.accueil.aucunRaid(perso ? nomEnJeu(perso) : d.accueil.ceperso)}{" "}
                <Link href="/annonces/nouvelle">{d.accueil.creeTien}</Link>
              </p>
            ) : (
              <ul className="liste-raids">
                {annonces.map((a) => {
                  const marque = marqueDe(a.id, a.createurId);
                  const libelleBouton = a.statut === "COMPLETE" ? d.accueil.reserveAria : d.accueil.candidater;
                  return (
                    <LigneRaid
                      key={a.id}
                      annonce={a}
                      fuseau={fuseau}
                      d={d}
                      lien={`/annonces/${a.id}${perso ? `?perso=${perso.id}` : ""}`}
                      marque={marque}
                      auteur={
                        <>
                          {d.accueil.par(a.createur.pseudo)} <BadgeFiabilite fiabilite={fiabilite.get(a.createurId)} />
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

          {/* ─── À droite : personnage, candidature rapide, prochains raids (reste visible) ─── */}
          <aside className="accueil-perso">
            <nav className="carte choix-perso" aria-label={d.accueil.chercheRaidPourAria}>
              <p className="surtitre">{d.accueil.chercheRaidPour}</p>
              <ul>
                {personnages.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={lienListe({ perso: p.id, jour: null })}
                      className={`perso-choix ${p.id === perso?.id ? "choisi" : ""}`}
                      aria-current={p.id === perso?.id ? "true" : undefined}
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
                      <FactionIcone faction={p.faction} taille={16} />
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
            {perso && (
              /* Candidature rapide : rôle(s) et note choisis une fois, puis « + » sur chaque raid.
                 Les boutons des lignes envoient ce formulaire avec l'identifiant de leur raid. */
              <form id="candidature-rapide" action={candidater} className="carte candidature-rapide">
                <input type="hidden" name="personnageId" value={perso.id} />
                <input type="hidden" name="depuis" value="liste" />
                <input type="hidden" name="retour" value={requete} />
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
                <label className="champ rapide-note">
                  {d.accueil.noteRl} <small className="fuseau">{d.accueil.noteRlAide}</small>
                  <input name="note" maxLength={80} placeholder={d.accueil.notePlaceholder} />
                </label>
              </form>
            )}
            <section className="carte prochains" aria-labelledby="titre-prochains">
              <p className="surtitre" id="titre-prochains">
                {d.accueil.prochainsRaids}
              </p>
              {prochains.length === 0 ? (
                <p className="doux">{d.accueil.aucunProchain}</p>
              ) : (
                <ul className="liste-prochains">
                  {prochains.map(({ cle, annonce: a, marque, action }) => {
                    const enAttente = resumeLigneRaid(a).enAttente;
                    return (
                      <li key={cle} className={`prochain ligne-${marque?.type ?? ""}`}>
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
                          {marque?.perso && <ClasseIcone classe={marque.perso.classe} taille={18} />}
                          {marque?.detail && <span className="doux">{marque.detail}</span>}
                          {action && <span className="prochain-action">{action}</span>}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </aside>
        </div>
      )}
    </main>
  );
}
