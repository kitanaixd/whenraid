import Image from "next/image";
import Link from "next/link";
import { signIn } from "@/lib/auth";
import { utilisateurConnecte } from "@/lib/session";
import { db } from "@/lib/db";
import { afficherDate, localVersUtc } from "@/lib/dates";
import { nomRaid, raids } from "@/lib/raids";
import { rolesPourRaid } from "@/lib/eligibilite";
import { chargerMesRaids } from "@/lib/mesRaids";
import { fiabiliteRls } from "@/lib/fiabilite";
import { BadgeFiabilite } from "./BadgeFiabilite";
import { includeLigneRaid, resumeLigneRaid } from "@/lib/ligneRaid";
import { Contenu } from "@/generated/prisma/enums";
import type { AnnonceWhereInput } from "@/generated/prisma/models";
import { ClasseIcone, FactionIcone, NomRole } from "./ClasseIcone";
import { LigneRaid, type Marque } from "./LigneRaid";
import { candidater, seDesinscrire } from "./annonces/[id]/actions";
import { BoutonDesinscrire } from "./annonces/[id]/BoutonDesinscrire";
import { nomEnJeu, rolePossible } from "@/lib/jeu";

const DUREES_MAX = [2, 3, 4, 6];

/** Le lendemain d'une date « AAAA-MM-JJ », au même format. */
function lendemain(date: string) {
  const [a, m, j] = date.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, j + 1)).toISOString().slice(0, 10);
}

export default async function Accueil({ searchParams }: PageProps<"/">) {
  const utilisateur = await utilisateurConnecte();

  if (!utilisateur) {
    return (
      <main className="accueil-visiteur">
        <Image src="/logo.webp" alt="Logo WhenRaid" width={315} height={256} priority />
        <p className="surtitre">Le rendez-vous des raids de WoW Forever</p>
        <h1>WhenRaid</h1>
        <div className="ornement" aria-hidden="true">◆</div>
        <p className="accroche">
          Ton groupe cherche un soigneur pour ce soir ? Tu cherches un raid qui a besoin de ta classe ? Trouvez-vous
          en quelques clics.
        </p>
        <form
          action={async () => {
            "use server";
            await signIn("discord", { redirectTo: "/" });
          }}
        >
          <button type="submit" className="principal">
            Se connecter avec Discord
          </button>
        </form>
        <p>
          <small>En te connectant, tu rejoins le serveur Discord WhenRaid, qui t&apos;envoie tes convocations.</small>
        </p>
      </main>
    );
  }

  const fuseau = utilisateur.fuseauHoraire;
  const filtres = await searchParams;
  const valeur = (nom: string) => (typeof filtres[nom] === "string" ? (filtres[nom] as string) : "");
  const contenu = valeur("raid") in Contenu ? (valeur("raid") as Contenu) : null;
  const du = valeur("du");
  const au = valeur("au");
  const dureeMax = DUREES_MAX.includes(Number(valeur("duree"))) ? Number(valeur("duree")) : null;
  const debutMin = (du && localVersUtc(du, "00:00", fuseau)) || null;
  const debutMax = (au && /^\d{4}-\d{2}-\d{2}$/.test(au) && localVersUtc(lendemain(au), "00:00", fuseau)) || null;
  const filtreActif = Boolean(contenu || debutMin || debutMax || dureeMax);

  const personnages = await db.personnage.findMany({
    where: { utilisateurId: utilisateur.id, supprimeLe: null },
    orderBy: [{ estPrincipal: "desc" }, { nom: "asc" }],
  });
  // Le joueur choisit le personnage pour lequel il cherche un raid (par défaut : son principal).
  const perso = personnages.find((p) => p.id === valeur("perso")) ?? personnages[0];
  // Lien vers la même liste avec un autre personnage, en gardant les autres filtres.
  const lienPerso = (id: string) => {
    const params = new URLSearchParams({ perso: id });
    for (const nom of ["raid", "du", "au", "duree"]) if (valeur(nom)) params.set(nom, valeur(nom));
    return `/?${params}`;
  };
  const where: AnnonceWhereInput = {
    statut: { in: ["PUBLIEE", "COMPLETE"] },
    debutUtc: { gt: new Date(), ...(debutMin && { gte: debutMin }), ...(debutMax && { lt: debutMax }) },
    ...(contenu && { contenu }),
    ...(dureeMax && { dureeEstimee: { lte: dureeMax * 60 } }),
    // Premier tri en base : même faction, ruleset et région que le personnage choisi.
    ...(perso ? { faction: perso.faction, ruleset: perso.ruleset, region: perso.region } : { id: "" }),
  };

  const [annoncesBrutes, mesRaids] = await Promise.all([
    db.annonce.findMany({
      where,
      orderBy: { debutUtc: "asc" },
      take: 100,
      include: includeLigneRaid,
    }),
    chargerMesRaids(utilisateur.id),
  ]);
  const { convocations, candidatures, organises } = mesRaids;
  // Mes inscriptions en cours, par raid (tous personnages confondus) : pour marquer les lignes.
  const monInscription = new Map([...convocations, ...candidatures].map((i) => [i.place.annonce.id, i]));
  // Un raid n'apparaît que si le personnage choisi peut y tenir une place (classe, niveau…),
  // ou s'il y a déjà candidaté.
  const annonces = perso
    ? annoncesBrutes
        .filter(
          (a) =>
            monInscription.get(a.id)?.personnageId === perso.id || rolesPourRaid(perso, a.places, a).length > 0,
        )
        .slice(0, 50)
    : [];
  const fiabilite = await fiabiliteRls([...new Set(annonces.map((a) => a.createurId))]);
  const rolesPerso = perso ? perso.rolesJouables.filter((r) => rolePossible(perso.classe, r)) : [];
  const requete = new URLSearchParams(
    ["perso", "raid", "du", "au", "duree"].flatMap((n) => (valeur(n) ? [[n, valeur(n)]] : [])),
  ).toString();
  const erreur = valeur("erreur");

  /** Bouton « Annuler » (ou « Me désister ») pour un raid où je suis inscrit. */
  const annulation = (annonceId: string) => {
    const i = monInscription.get(annonceId);
    if (!i) return undefined;
    const a = i.place.annonce;
    return (
      <BoutonDesinscrire
        action={seDesinscrire}
        inscriptionId={i.id}
        resume={`${nomRaid(a.contenu)} — ${afficherDate(a.debutUtc, fuseau)}`}
        convie={i.statut === "CONFIRME"}
        retourListe={requete}
      />
    );
  };

  /** Ce qui distingue un raid où je suis inscrit ou que j'organise. */
  const marqueDe = (annonceId: string, createurId: string): Marque | undefined => {
    if (createurId === utilisateur.id) return { type: "organise", texte: "★ Votre raid" };
    const i = monInscription.get(annonceId);
    if (!i) return undefined;
    const perso = i.personnage ? { classe: i.personnage.classe, nom: nomEnJeu(i.personnage) } : undefined;
    if (i.statut === "CONFIRME") return { type: "convie", texte: "✔ Convié", perso };
    if (i.statut === "LISTE_ATTENTE") return { type: "attente", texte: "Réserve", perso };
    return { type: "candidat", texte: "⏳ Liste d'attente", perso };
  };

  return (
    <main>
      <header className="accueil-connecte">
        <p className="surtitre">WoW Forever · {utilisateur.pseudo}</p>
        <h1>Trouve ton prochain raid</h1>
        <div className="ornement" aria-hidden="true">◆</div>
      </header>

      {(convocations.length > 0 || candidatures.length > 0 || organises.length > 0) && (
        <section className="parchemin" aria-labelledby="titre-mes-raids">
          <p className="surtitre">Organisés, convocations, candidatures</p>
          <h2 id="titre-mes-raids">Tes raids</h2>
          <ul className="liste-raids">
            {organises.map((a) => {
              const n = resumeLigneRaid(a).enAttente;
              return (
                <LigneRaid
                  key={a.id}
                  compact
                  annonce={a}
                  fuseau={fuseau}
                  lien={`/annonces/${a.id}`}
                  marque={{
                    type: "organise",
                    texte: "★ Votre raid",
                    detail: n > 0 ? `${n} candidature${n > 1 ? "s" : ""}` : undefined,
                  }}
                />
              );
            })}
            {[...convocations, ...candidatures].map((i) => (
              <LigneRaid
                key={i.id}
                compact
                annonce={i.place.annonce}
                fuseau={fuseau}
                lien={`/annonces/${i.place.annonce.id}`}
                marque={marqueDe(i.place.annonce.id, i.place.annonce.createurId)}
                action={annulation(i.place.annonce.id)}
              />
            ))}
          </ul>
        </section>
      )}

      <section className="parchemin" aria-labelledby="titre-raids">
        <p className="surtitre">Ce soir et les jours à venir</p>
        <h2 id="titre-raids">Raids qui recrutent</h2>
        {typeof erreur === "string" && erreur && (
          <p className="avertissement grave" role="alert">
            ⚠ {erreur}
          </p>
        )}
        {personnages.length === 0 ? (
          <div className="encadre appel-perso">
            <p>
              Déclare ton premier personnage pour voir les raids qui te correspondent : faction, ruleset, région,
              classe et niveau.
            </p>
            <Link href="/personnages" className="bouton principal">
              Créer mon personnage
            </Link>
          </div>
        ) : (
          <>
          <nav className="choix-perso" aria-label="Personnage pour lequel chercher un raid">
            <p className="etiquette-place">Je cherche un raid pour</p>
            <ul>
              {personnages.map((p) => (
                <li key={p.id}>
                  <Link
                    href={lienPerso(p.id)}
                    className={`perso-choix ${p.id === perso?.id ? "choisi" : ""}`}
                    aria-current={p.id === perso?.id ? "true" : undefined}
                  >
                    <ClasseIcone classe={p.classe} taille={26} />
                    <span className="classe" style={{ "--c": `var(--classe-${p.classe})` } as React.CSSProperties}>
                      {nomEnJeu(p)}
                    </span>
                    <FactionIcone faction={p.faction} taille={18} />
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          {perso && (
            /* Candidature rapide : rôle(s) et note choisis une fois, puis « Candidater » sur chaque raid.
               Les boutons des lignes envoient ce formulaire avec l'identifiant de leur raid. */
            <form id="candidature-rapide" action={candidater} className="candidature-rapide">
              <input type="hidden" name="personnageId" value={perso.id} />
              <input type="hidden" name="depuis" value="liste" />
              <input type="hidden" name="retour" value={requete} />
              <p className="etiquette-place">Candidature rapide avec {nomEnJeu(perso)}</p>
              <div className="rapide-champs">
                <fieldset className="rapide-roles">
                  <legend className="sr-only">Rôles proposés</legend>
                  {rolesPerso.map((r, n) => (
                    <label key={r} className="case-role">
                      <input type="checkbox" name="roles" value={r} defaultChecked={n === 0} />
                      <NomRole role={r} taille={20} />
                    </label>
                  ))}
                </fieldset>
                <label className="champ rapide-note">
                  Note pour les RL <small className="fuseau">(facultatif, envoyée avec chaque candidature)</small>
                  <input name="note" maxLength={80} placeholder="Ex. : stuff T2, dispo jusqu'à minuit" />
                </label>
              </div>
            </form>
          )}
          <form className="filtres" method="get" role="search" aria-label="Filtrer les raids">
            {perso && <input type="hidden" name="perso" value={perso.id} />}
            <label className="champ">
              Raid
              <select name="raid" defaultValue={contenu ?? ""}>
                <option value="">Tous les raids</option>
                {(Object.keys(raids) as Contenu[]).map((c) => (
                  <option key={c} value={c}>
                    {nomRaid(c)}
                  </option>
                ))}
              </select>
            </label>
            <label className="champ">
              Du
              <input type="date" name="du" defaultValue={du} />
            </label>
            <label className="champ">
              Au
              <input type="date" name="au" defaultValue={au} />
            </label>
            <label className="champ">
              Durée
              <select name="duree" defaultValue={dureeMax ?? ""}>
                <option value="">Toutes</option>
                {DUREES_MAX.map((h) => (
                  <option key={h} value={h}>
                    {h} h maximum
                  </option>
                ))}
              </select>
            </label>
            <div className="filtres-boutons">
              <button type="submit" className="principal petit">
                Filtrer
              </button>
              {filtreActif && (
                <Link href={perso ? `/?perso=${perso.id}` : "/"} className="bouton petit">
                  Effacer
                </Link>
              )}
            </div>
          </form>
          </>
        )}
        {personnages.length === 0 ? null : annonces.length === 0 ? (
          <p className="doux">
            {filtreActif
              ? "Aucun raid ne correspond à ces filtres."
              : `Aucun raid ouvert à ${perso ? nomEnJeu(perso) : "ce personnage"} pour l'instant.`}{" "}
            <Link href="/annonces/nouvelle">Crée le tien !</Link>
          </p>
        ) : (
          <ul className="liste-raids">
            {annonces.map((a) => {
              const marque = marqueDe(a.id, a.createurId);
              return (
                <LigneRaid
                  key={a.id}
                  annonce={a}
                  fuseau={fuseau}
                  lien={`/annonces/${a.id}${perso ? `?perso=${perso.id}` : ""}`}
                  marque={marque}
                  auteur={
                    <>
                      par {a.createur.pseudo} <BadgeFiabilite fiabilite={fiabilite.get(a.createurId)} />
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
                        className="petit principal"
                      >
                        {a.statut === "COMPLETE" ? "Réserve" : "Candidater"}
                      </button>
                    )
                  }
                />
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
