import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { exigerUtilisateur } from "@/lib/session";
import { afficherDate } from "@/lib/dates";
import { nomRaid, raids } from "@/lib/raids";
import { optionsTriees } from "@/lib/libelles";
import {
  accepteCandidatures,
  compoActuelle,
  compoParRole,
  estActive,
  estComplet,
  estEnAttente,
  etatPresences,
  rlPeutAgir,
} from "@/lib/annonces";
import {
  accepter,
  accepterGroupe,
  annuler,
  candidater,
  enregistrerLogsRaid,
  enregistrerPresences,
  envoyerLesInvitations,
  refuser,
  refuserGroupe,
  retirerJoueur,
  envoyerMessage,
  seDesinscrire,
} from "./actions";
import { BoutonDesinscrire } from "./BoutonDesinscrire";
import { BoutonRetirerJoueur } from "./BoutonRetirerJoueur";
import { BoutonMessage } from "./BoutonMessage";
import { GrilleRaid } from "../nouvelle/GrilleRaid";
import { IconeWarcraftLogs } from "@/app/Icones";
import { commenceBientot } from "@/lib/profil";
import { BoutonInvitations } from "./BoutonInvitations";
import { nomEnJeu } from "@/lib/invitations";
import { placePourRoles, rolesPourRaid, rolesProposes } from "@/lib/eligibilite";
import { Classe, Role } from "@/generated/prisma/enums";
import { BoutonAnnuler } from "./BoutonAnnuler";
import { BoutonEnvoi } from "@/app/BoutonEnvoi";
import { ClasseIcone, NomClasse, NomRole, PastilleFaction, PastilleRuleset, RoleIcone } from "@/app/ClasseIcone";
import { FormCandidature } from "./FormCandidature";
import { fiabiliteMercenaires, fiabiliteRls } from "@/lib/fiabilite";
import { BadgeFiabilite } from "@/app/BadgeFiabilite";
import { dicoCourant } from "@/lib/langue";

const NOMBRE_DE_CLASSES = Object.keys(Classe).length;
const ORDRE_ROLES = Object.keys(Role);

// Couleur des pastilles selon le statut.
const TYPE_STATUT: Record<string, string> = { INSCRIT: "candidat", LISTE_ATTENTE: "attente", CONFIRME: "convie" };
const CLASSE_STATUT_ANNONCE: Record<string, string> = { PUBLIEE: "ouvert", COMPLETE: "complet", ANNULEE: "alerte" };
const CLASSE_STATUT_INSCRIPTION: Record<string, string> = {
  CONFIRME: "succes",
  LISTE_ATTENTE: "complet",
  INSCRIT: "ouvert",
};

export default async function PageAnnonce({ params, searchParams }: PageProps<"/annonces/[id]">) {
  const utilisateur = await exigerUtilisateur();
  const d = await dicoCourant();
  const { id } = await params;
  const { erreur, info, perso: persoChoisi } = await searchParams;

  const annonce = await db.annonce.findUnique({
    where: { id },
    include: {
      createur: { select: { pseudo: true } },
      organisateurPersonnage: true,
      composition: true,
      participations: true,
      places: {
        orderBy: [{ role: "asc" }, { id: "asc" }],
        include: {
          inscriptions: {
            orderBy: { inscritLe: "asc" },
            include: {
              personnage: true,
              utilisateur: { select: { pseudo: true } },
              escouade: { select: { nom: true } },
            },
          },
        },
      },
    },
  });
  if (!annonce) notFound();

  const fuseau = utilisateur.fuseauHoraire;
  const date = (instant: Date) => afficherDate(instant, fuseau, d);
  const estRl = annonce.createurId === utilisateur.id;
  const inscriptions = annonce.places.flatMap((p) => p.inscriptions.map((i) => ({ ...i, place: p })));
  const confirmes = inscriptions.filter((i) => i.statut === "CONFIRME" && i.personnage && i.role);
  // Par place, le premier confirmé est titulaire ; les suivants sont des remplaçants.
  const premiers = annonce.places.flatMap((p) => p.inscriptions.filter((i) => i.statut === "CONFIRME").slice(0, 1));
  const titulaires = confirmes.filter((i) => premiers.some((t) => t.id === i.id));
  const remplacants = confirmes.filter((i) => !titulaires.includes(i));
  const compo = compoActuelle(
    annonce.composition,
    titulaires.map((i) => ({ classe: i.personnage!.classe, role: i.role! })),
  );
  const placesRestantes = annonce.places.filter((p) => p.statut === "OUVERTE").length;
  const complet = estComplet(annonce.places);
  const maCandidature = inscriptions.find((i) => i.utilisateurId === utilisateur.id && estActive(i.statut));
  const ouvert = accepteCandidatures(annonce);
  const presences = etatPresences(annonce);
  // Logs du raid : réservés au RL et aux joueurs qui y participent (confirmés ou présents à la feuille).
  const participe =
    inscriptions.some((i) => i.utilisateurId === utilisateur.id && i.statut === "CONFIRME") ||
    annonce.participations.some((p) => p.utilisateurId === utilisateur.id);
  const voitLogs = estRl ? annonce.statut !== "BROUILLON" : participe && annonce.lienLogs !== null;
  const [fiabRl, fiabCandidats] = await Promise.all([
    fiabiliteRls([annonce.createurId]),
    estRl ? fiabiliteMercenaires([...new Set(inscriptions.map((i) => i.utilisateurId))]) : new Map(),
  ]);
  const participationDe = (personnageId: string | null) =>
    annonce.participations.find((p) => p.personnageId === personnageId);
  const mesPersonnages =
    estRl || maCandidature || !ouvert
      ? []
      : await db.personnage.findMany({
          where: { utilisateurId: utilisateur.id, supprimeLe: null },
          orderBy: { nom: "asc" },
        });

  // Classes par ordre alphabétique (dans la langue affichée).
  const ORDRE_CLASSES = optionsTriees(d.classe).map(([c]) => c);
  const roles = compoParRole(compo.lignes);
  // Compo joueur par joueur : les membres déclarés par le RL (sans nom) puis les joueurs acceptés.
  // Confidentialité : seul le RL voit qui a candidaté ou qui est accepté ; les autres joueurs ne voient
  // que la classe (et leur propre personnage), pour qu'on ne puisse pas démarcher les membres du raid.
  const nomVisible = (i: {
    utilisateurId: string;
    personnage: { nom: string; nomDeFamille: string | null; classe: Classe } | null;
  }) => (estRl || i.utilisateurId === utilisateur.id ? nomEnJeu(i.personnage!) : d.classe[i.personnage!.classe]);
  const membres = [
    ...annonce.composition.flatMap((c) =>
      Array.from({ length: c.nombre }, (_, n) => ({
        cle: `${c.classe}.${c.role}.${n}`,
        classe: c.classe,
        role: c.role,
        nom: null as string | null,
      })),
    ),
    ...confirmes
      .filter((i) => !remplacants.includes(i))
      .map((i) => ({
        cle: i.id,
        classe: i.personnage!.classe,
        role: i.role!,
        nom: estRl || i.utilisateurId === utilisateur.id ? nomEnJeu(i.personnage!) : null,
      })),
  ].sort(
    (a, b) =>
      ORDRE_ROLES.indexOf(a.role) - ORDRE_ROLES.indexOf(b.role) ||
      ORDRE_CLASSES.indexOf(a.classe) - ORDRE_CLASSES.indexOf(b.classe),
  );
  const compoParGroupe = ORDRE_ROLES.map((role) => ({
    role: role as Role,
    membres: membres.filter((m) => m.role === role),
  })).filter((g) => g.membres.length > 0);

  // Besoins : les places identiques (mêmes classes, même rôle) sont regroupées sur une ligne.
  const besoins: { cle: string; classes: Classe[]; role: Role | null; total: number; ouvertes: number }[] = [];
  for (const p of annonce.places) {
    if (p.statut === "ANNULEE") continue;
    const classes = [...p.classesAcceptees].sort((x, y) => ORDRE_CLASSES.indexOf(x) - ORDRE_CLASSES.indexOf(y));
    const cle = `${classes.join(",")}|${p.role ?? ""}`;
    let besoin = besoins.find((x) => x.cle === cle);
    if (!besoin) besoins.push((besoin = { cle, classes, role: p.role, total: 0, ouvertes: 0 }));
    besoin.total++;
    if (p.statut === "OUVERTE") besoin.ouvertes++;
  }
  const precision = (b: (typeof besoins)[number]) => (b.classes.length < NOMBRE_DE_CLASSES ? 0 : 2) + (b.role ? 0 : 1);
  besoins.sort((x, y) => precision(x) - precision(y));
  /** Libellé d'un besoin : « 6 Voleurs », « 2 DPS », « 3 places libres » (au pluriel si besoin). */
  const libelleBesoin = (b: (typeof besoins)[number]) => {
    const pluriel = b.total > 1;
    if (b.classes.length < NOMBRE_DE_CLASSES) {
      const noms = b.classes.map((c) => (pluriel ? d.raid.besoin.classes(d.classe[c]) : d.classe[c])).join(" / ");
      return `${b.total} ${noms}`;
    }
    if (b.role) return `${b.total} ${pluriel ? d.rolesPluriel[b.role] : d.role[b.role]}`;
    return d.raid.besoin.placesLibres(b.total);
  };
  /** Ce que le besoin accepte : le rôle demandé, ou n'importe lequel. */
  const detailBesoin = (b: (typeof besoins)[number]) => {
    if (b.classes.length < NOMBRE_DE_CLASSES) return b.role ? d.role[b.role] : d.raid.besoin.toutRole;
    return b.role ? d.raid.besoin.touteClasse : d.raid.besoin.libre;
  };

  // Candidatures en attente (vue du RL) : « Accepter » s'il reste une place compatible, sinon « Remplaçant ».
  const candidatsEnAttente = inscriptions
    .filter((i) => estEnAttente(i.statut))
    .sort((x, y) => Number(x.statut === "LISTE_ATTENTE") - Number(y.statut === "LISTE_ATTENTE"))
    .map((i) => ({
      ...i,
      // Pour chaque rôle proposé : reste-t-il une place ouverte ? (sinon « Remplaçant »)
      choixRoles: rolesProposes(i).map((role) => ({
        role,
        ouverte: Boolean(i.personnage && placePourRoles(annonce.places, i.personnage, [role], annonce)?.ouverte),
      })),
    }));
  const candidatsSeuls = candidatsEnAttente.filter((i) => !i.escouadeId);
  const groupesEnAttente = [...new Set(candidatsEnAttente.map((i) => i.escouadeId).filter((e) => e !== null))].map(
    (escouadeId) => {
      const membres = candidatsEnAttente.filter((i) => i.escouadeId === escouadeId);
      return { escouadeId, nom: membres[0].escouade?.nom ?? "", membres };
    },
  );
  const persosCandidats = mesPersonnages
    .map((p) => ({ perso: p, roles: rolesPourRaid(p, annonce.places, annonce) }))
    .filter((c) => c.roles.length > 0);
  /** Écrire au joueur : le bot WhenRaid lui envoie le message en MP Discord (visible du seul RL). */
  const ecrireSurDiscord = (i: { id: string; utilisateur: { pseudo: string } }) => (
    <BoutonMessage action={envoyerMessage} inscriptionId={i.id} pseudo={i.utilisateur.pseudo} />
  );
  // Retirer un joueur à moins de 2 h du début pèse sur la fiabilité du RL.
  const retraitPenalise = commenceBientot(annonce.debutUtc);
  const organisateur = annonce.organisateurPersonnage;
  const resumeRaid = `${annonce.titre ?? nomRaid(annonce.contenu, d)} — ${date(annonce.debutUtc)}`;

  return (
    <main data-fond={raids[annonce.contenu].image}>
      <Link href="/" className="retour">
        {d.commun.tousLesRaids}
      </Link>

      <header className="entete-raid">
        <p className="surtitre">
          {d.faction[annonce.faction]} · {d.ruleset[annonce.ruleset]} {annonce.region}
        </p>
        <h1>{annonce.titre ?? nomRaid(annonce.contenu, d)}</h1>
        <div className="ornement" aria-hidden="true">
          ◆
        </div>
        <p className="quand-raid">
          {annonce.titre && `${nomRaid(annonce.contenu, d)} · `}
          {date(annonce.debutUtc)}
          {annonce.dureeEstimee && <span className="doux">{d.raid.environ(annonce.dureeEstimee / 60)}</span>}
        </p>
        <div className="pastilles centre">
          <PastilleFaction faction={annonce.faction} />
          <PastilleRuleset ruleset={annonce.ruleset} region={annonce.region} />
          <span className="pastille">{d.raid.loot(d.reglesLoot[annonce.reglesLoot])}</span>
          <span className="pastille">{d.raid.vocal(d.vocal[annonce.vocal])}</span>
          {(annonce.langueRequise === "fr" || annonce.langueRequise === "en") && (
            <span className="pastille">{d.langueParlee[annonce.langueRequise]}</span>
          )}
          <span className={`pastille ${CLASSE_STATUT_ANNONCE[annonce.statut] ?? ""}`}>
            {d.statutAnnonce[annonce.statut]}
          </span>
        </div>
        <div className="grille-entete">
          {/* Aperçu façon cadres de raid : joueurs (compo déclarée et acceptés), places réservées et libres. */}
          <GrilleRaid
            taille={annonce.taille}
            cases={[
              ...membres.map((m) => ({ type: "membre" as const, classe: m.classe, role: m.role, nom: m.nom })),
              ...annonce.places
                .filter((p) => p.statut === "OUVERTE")
                .map((p) =>
                  p.classesAcceptees.length >= NOMBRE_DE_CLASSES && !p.role
                    ? { type: "libre" as const }
                    : {
                        type: "besoin" as const,
                        classe: p.classesAcceptees.length === 1 ? p.classesAcceptees[0] : undefined,
                        role: p.role ?? undefined,
                      },
                ),
            ]}
          />
        </div>
      </header>

      {annonce.statut === "ANNULEE" && (
        <p className="avertissement grave" role="status">
          {d.raid.annule}
          {annonce.annuleeLe && d.raid.annuleLe(date(annonce.annuleeLe))}.
        </p>
      )}
      {info === "message" && (
        <p className="avertissement succes" role="status">
          {d.retrait.envoye}
        </p>
      )}
      {typeof erreur === "string" && (
        <p className="avertissement grave" role="alert">
          ⚠ {erreur}
        </p>
      )}
      <div className="bloc-rl">
        {estRl && (
          <section className="carte espace-rl">
            <p className="surtitre">{d.raid.espaceRl}</p>
            {annonce.vocal === "DISCORD" && (
              <p>
                Discord : <code>{annonce.vocalDiscordLien}</code>
              </p>
            )}
            {annonce.vocal === "TEAMSPEAK" && (
              <p>
                TeamSpeak : <code>{annonce.vocalTsAdresse}</code>
                {annonce.vocalTsMotDePasse && (
                  <>
                    {" "}
                    — {d.raid.motDePasse} <code>{annonce.vocalTsMotDePasse}</code>
                  </>
                )}
              </p>
            )}
            {annonce.vocal !== "AUCUN" && <p className="doux">{d.raid.identifiantsPrives}</p>}
            <div className="actions-rl">
              {(annonce.statut === "PUBLIEE" || annonce.statut === "COMPLETE") && (
                <Link href={`/annonces/${annonce.id}/modifier`} className="bouton">
                  {d.edition.bouton}
                </Link>
              )}
              {rlPeutAgir(annonce) && (
                <BoutonInvitations
                  action={envoyerLesInvitations}
                  annonceId={annonce.id}
                  resume={resumeRaid}
                  nbConfirmes={confirmes.length}
                  nbAInviter={confirmes.filter((i) => !i.invitationEnvoyeeLe).length}
                  vocal={
                    annonce.vocal === "DISCORD"
                      ? `Discord (${annonce.vocalDiscordLien})`
                      : annonce.vocal === "TEAMSPEAK"
                        ? `TeamSpeak (${annonce.vocalTsAdresse})`
                        : d.raid.aucunVocal
                  }
                  commandeWhisper={organisateur ? `/w ${nomEnJeu(organisateur)} inv` : null}
                  dejaEnvoyeesLe={annonce.invitationsEnvoyeesLe && date(annonce.invitationsEnvoyeesLe)}
                />
              )}
              {ouvert && (
                <BoutonAnnuler
                  action={annuler}
                  annonceId={annonce.id}
                  resume={resumeRaid}
                  nbInscrits={confirmes.length}
                  estComplet={complet}
                />
              )}
            </div>
          </section>
        )}

        {estRl && presences.visible && (
          <section id="presences" className="carte">
            <p className="surtitre">{d.raid.feuillePresence}</p>
            {annonce.presencesValideesLe ? (
              <p className="encadre">{d.raid.presencesValidees(date(annonce.presencesValideesLe))}</p>
            ) : (
              <p className="doux">{d.raid.presencesAide}</p>
            )}
            {confirmes.length === 0 ? (
              <p>{d.raid.aucunConfirme}</p>
            ) : (
              <form action={enregistrerPresences}>
                <input type="hidden" name="annonceId" value={annonce.id} />
                <table>
                  <thead>
                    <tr>
                      <th>{d.raid.joueur}</th>
                      <th>{d.raid.presence}</th>
                      <th>{d.raid.distingue}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {confirmes.map((i) => {
                      const p = participationDe(i.personnageId);
                      return (
                        <tr key={i.id}>
                          <td>
                            <ClasseIcone classe={i.personnage!.classe} /> {nomEnJeu(i.personnage!)}{" "}
                            <small>
                              (<Link href={`/joueurs/${i.utilisateurId}`}>{i.utilisateur.pseudo}</Link>)
                            </small>
                          </td>
                          <td>
                            <select
                              name={`presence.${i.id}`}
                              defaultValue={p?.resultat ?? "PRESENT"}
                              disabled={!presences.modifiable}
                              aria-label={d.raid.presenceDe(nomEnJeu(i.personnage!))}
                            >
                              <option value="PRESENT">{d.raid.present}</option>
                              <option value="ABSENT">{d.raid.absent}</option>
                              <option value="PARTI_EN_COURS">{d.raid.partiEnCours}</option>
                            </select>
                          </td>
                          <td>
                            <input
                              type="checkbox"
                              name={`distinction.${i.id}`}
                              defaultChecked={p?.distinction ?? false}
                              disabled={!presences.modifiable}
                              aria-label={d.raid.aDistingue(nomEnJeu(i.personnage!))}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {presences.modifiable && (
                  <div className="actions-rl">
                    <BoutonEnvoi enCours={d.commun.enregistrement}>{d.raid.enregistrer}</BoutonEnvoi>
                    {presences.validable && (
                      <BoutonEnvoi name="valider" value="1" className="principal" enCours={d.raid.validation}>
                        {d.raid.validerFin}
                      </BoutonEnvoi>
                    )}
                  </div>
                )}
              </form>
            )}
          </section>
        )}
      </div>

      <div className="grille-raid">
        <div className="colonne-principale">
          <header className="entete-colonne">
            <p className="surtitre">{complet ? d.raid.raidComplet : d.raid.placesAPourvoir(placesRestantes)}</p>
            <h2>{d.raid.leRaid}</h2>
          </header>

          <section className="carte" aria-labelledby="titre-recherche">
            <p className="surtitre" id="titre-recherche">
              {d.raid.recherche}
            </p>
            <ul className="liste-besoins-v2">
              {besoins.map((b) => {
                const pris = b.total - b.ouvertes;
                const classeUnique = b.classes.length === 1 ? b.classes[0] : null;
                return (
                  <li key={b.cle} className={b.ouvertes === 0 ? "pourvu" : undefined}>
                    <span className="besoin-icone">
                      {classeUnique ? (
                        <ClasseIcone classe={classeUnique} taille={30} />
                      ) : b.role ? (
                        <RoleIcone role={b.role} taille={28} />
                      ) : (
                        <span className="besoin-libre" aria-hidden="true">
                          ✦
                        </span>
                      )}
                    </span>
                    <span className="besoin-texte">
                      <strong
                        className={classeUnique ? "classe" : undefined}
                        style={
                          classeUnique ? ({ "--c": `var(--classe-${classeUnique})` } as React.CSSProperties) : undefined
                        }
                      >
                        {libelleBesoin(b)}
                      </strong>
                      <span className="doux">
                        {b.role && classeUnique && <RoleIcone role={b.role} taille={16} />} {detailBesoin(b)}
                      </span>
                    </span>
                    <span className="besoin-etat">
                      <span className="jauge" aria-hidden="true">
                        <span style={{ width: `${(pris / b.total) * 100}%` }} />
                      </span>
                      <span className={b.ouvertes === 0 ? "pourvu-texte" : "a-pourvoir"}>
                        {b.ouvertes === 0 ? d.raid.besoin.pourvu : d.raid.besoin.aPourvoir(b.ouvertes, b.total)}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>

          {estRl ? (
            <section className="carte" aria-labelledby="titre-candidatures">
              <p className="surtitre" id="titre-candidatures">
                {d.raid.candidaturesRecues(candidatsEnAttente.length)}
              </p>
              {candidatsEnAttente.length === 0 ? (
                <p className="doux">{d.raid.aucuneCandidature}</p>
              ) : (
                <ul className="liste-candidats">
                  {groupesEnAttente.map((g) => (
                    <li key={g.escouadeId} className="candidat candidat-groupe">
                      <form action={accepterGroupe} className="groupe-candidat">
                        <input type="hidden" name="annonceId" value={annonce.id} />
                        <input type="hidden" name="escouadeId" value={g.escouadeId} />
                        <div className="groupe-candidat-tete">
                          <strong>{d.groupes.enTete(g.nom, g.membres.length)}</strong>
                          <span className={`pastille ${CLASSE_STATUT_INSCRIPTION[g.membres[0].statut] ?? ""}`}>
                            {d.statutInscription[g.membres[0].statut]}
                          </span>
                        </div>
                        <p className="doux">{d.groupes.toutOuRien}</p>
                        <ul className="membres-candidats">
                          {g.membres.map((i) => (
                            <li key={i.id}>
                              <span className="nom-classe">
                                {i.personnage && <ClasseIcone classe={i.personnage.classe} taille={24} />}
                                <strong
                                  className="classe"
                                  style={
                                    i.personnage
                                      ? ({ "--c": `var(--classe-${i.personnage.classe})` } as React.CSSProperties)
                                      : undefined
                                  }
                                >
                                  {i.personnage && nomEnJeu(i.personnage)}
                                </strong>
                              </span>
                              <span className="doux">
                                <Link href={`/joueurs/${i.utilisateurId}`}>{i.utilisateur.pseudo}</Link> ·{" "}
                                <BadgeFiabilite fiabilite={fiabCandidats.get(i.utilisateurId)} />
                                {i.personnage?.lienLogs && (
                                  <>
                                    {" · "}
                                    <a href={i.personnage.lienLogs} target="_blank" rel="noopener noreferrer nofollow">
                                      <IconeWarcraftLogs /> {d.commun.logs}
                                    </a>
                                  </>
                                )}
                              </span>
                              {ecrireSurDiscord(i)}
                              {/* Le RL choisit le rôle de chacun parmi ceux proposés. */}
                              <select
                                name={`role.${i.id}`}
                                aria-label={d.groupes.roleDe(i.personnage ? nomEnJeu(i.personnage) : "")}
                                defaultValue={i.role ?? undefined}
                                disabled={!rlPeutAgir(annonce)}
                              >
                                {rolesProposes(i).map((r) => (
                                  <option key={r} value={r}>
                                    {d.role[r]}
                                  </option>
                                ))}
                              </select>
                            </li>
                          ))}
                        </ul>
                        {g.membres[0].note && <blockquote className="note">« {g.membres[0].note} »</blockquote>}
                        {rlPeutAgir(annonce) && (
                          <div className="boutons">
                            <BoutonEnvoi className="petit principal" enCours={d.commun.enCours}>
                              {d.groupes.accepterGroupe}
                            </BoutonEnvoi>
                            <BoutonEnvoi className="petit" enCours={d.commun.enCours} formAction={refuserGroupe}>
                              {d.groupes.refuserGroupe}
                            </BoutonEnvoi>
                          </div>
                        )}
                      </form>
                    </li>
                  ))}
                  {candidatsSeuls.map((i) => (
                    <li key={i.id} className="candidat">
                      <div className="candidat-infos">
                        <div className="candidat-nom">
                          {i.personnage && <ClasseIcone classe={i.personnage.classe} taille={26} />}
                          <strong
                            className="classe"
                            style={
                              i.personnage
                                ? ({ "--c": `var(--classe-${i.personnage.classe})` } as React.CSSProperties)
                                : undefined
                            }
                          >
                            {i.personnage && nomEnJeu(i.personnage)}
                          </strong>
                        </div>
                        <div className="roles-proposes">
                          {i.choixRoles.map((c) => (
                            <NomRole key={c.role} role={c.role} taille={18} />
                          ))}
                        </div>
                        <div className="doux candidat-joueur">
                          <Link href={`/joueurs/${i.utilisateurId}`}>{i.utilisateur.pseudo}</Link>
                          <BadgeFiabilite fiabilite={fiabCandidats.get(i.utilisateurId)} />
                        </div>
                        {i.personnage?.lienLogs && (
                          <a href={i.personnage.lienLogs} target="_blank" rel="noopener noreferrer nofollow">
                            <IconeWarcraftLogs /> {d.raid.voirLogsWcl}
                          </a>
                        )}
                        {i.note && <blockquote className="note">« {i.note} »</blockquote>}
                      </div>
                      <div className="candidat-actions">
                        <span className={`pastille ${CLASSE_STATUT_INSCRIPTION[i.statut] ?? ""}`}>
                          {d.statutInscription[i.statut]}
                        </span>
                        {rlPeutAgir(annonce) && (
                          <div className="boutons">
                            {ecrireSurDiscord(i)}
                            {i.choixRoles.map((c) => (
                              <form key={c.role} action={accepter}>
                                <input type="hidden" name="inscriptionId" value={i.id} />
                                <input type="hidden" name="role" value={c.role} />
                                <BoutonEnvoi className="petit principal" enCours={d.commun.enCours}>
                                  <span className="nom-classe">
                                    {c.ouverte ? d.raid.accepter : d.raid.remplacant}
                                    {i.choixRoles.length > 1 && ` · ${d.role[c.role]}`}
                                  </span>
                                </BoutonEnvoi>
                              </form>
                            ))}
                            <form action={refuser}>
                              <input type="hidden" name="inscriptionId" value={i.id} />
                              <BoutonEnvoi className="petit" enCours={d.commun.enCours}>
                                {d.raid.refuser}
                              </BoutonEnvoi>
                            </form>
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : (
            <section className="carte" aria-labelledby="titre-candidature">
              <div className="candidature-tete">
                <p className="surtitre" id="titre-candidature">
                  {d.raid.candidature}
                </p>
                {maCandidature && (
                  <span className={`badge-raid badge-raid-${TYPE_STATUT[maCandidature.statut] ?? "candidat"}`}>
                    {maCandidature.statut === "CONFIRME"
                      ? d.accueil.convie
                      : maCandidature.statut === "LISTE_ATTENTE"
                        ? d.accueil.reserve
                        : d.accueil.listeAttente}
                  </span>
                )}
              </div>
              {maCandidature && (
                <>
                  {maCandidature.escouade && (
                    <p className="candidature-groupe">
                      {d.groupes.enTete(
                        maCandidature.escouade.nom,
                        inscriptions.filter((i) => i.escouadeId === maCandidature.escouadeId && estActive(i.statut))
                          .length,
                      )}
                    </p>
                  )}
                  <ul className="candidature-persos">
                    {/* Seul : mon personnage ; en groupe : tous les membres inscrits sur ce raid. */}
                    {(maCandidature.escouadeId
                      ? inscriptions.filter((i) => i.escouadeId === maCandidature.escouadeId && estActive(i.statut))
                      : [maCandidature]
                    ).map(
                      (i) =>
                        i.personnage && (
                          <li key={i.id} className={i.id === maCandidature.id ? "moi" : undefined}>
                            <ClasseIcone classe={i.personnage.classe} taille={30} />
                            <div>
                              <strong
                                className="classe"
                                style={{ "--c": `var(--classe-${i.personnage.classe})` } as React.CSSProperties}
                              >
                                {nomEnJeu(i.personnage)}
                              </strong>
                              <span className="doux">
                                {d.classe[i.personnage.classe]}
                                {maCandidature.escouadeId && ` · ${i.utilisateur.pseudo}`}
                              </span>
                            </div>
                            {/* En attente : les rôles proposés ; convié : le rôle retenu par le RL. */}
                            <span className="roles-proposes">
                              {(i.statut === "CONFIRME" ? [i.role!] : rolesProposes(i)).map((r) => (
                                <NomRole key={r} role={r} taille={18} />
                              ))}
                            </span>
                          </li>
                        ),
                    )}
                  </ul>
                  {maCandidature.statut === "LISTE_ATTENTE" && <p className="doux">{d.raid.listeAttenteAide}</p>}
                  {ouvert && (
                    <div className="candidature-actions">
                      <BoutonDesinscrire
                        action={seDesinscrire}
                        inscriptionId={maCandidature.id}
                        resume={resumeRaid}
                        convie={maCandidature.statut === "CONFIRME"}
                      />
                    </div>
                  )}
                </>
              )}
              {maCandidature ? null : !ouvert ? (
                <p className="doux">{d.raid.plusDeCandidatures}</p>
              ) : mesPersonnages.length === 0 ? (
                <p className="doux">
                  {d.raid.declarePersoAvant} <Link href="/personnages">{d.raid.unPersonnage}</Link>.
                </p>
              ) : persosCandidats.length === 0 ? (
                <p className="doux">{d.raid.aucunPersoCompatible}</p>
              ) : (
                <>
                  {complet && <p className="encadre">{d.raid.completAvertissement}</p>}
                  <FormCandidature
                    action={candidater}
                    annonceId={annonce.id}
                    listeAttente={complet}
                    persoInitial={typeof persoChoisi === "string" ? persoChoisi : undefined}
                    persos={persosCandidats.map(({ perso, roles }) => ({
                      id: perso.id,
                      classe: perso.classe,
                      roles,
                      libelle: `${nomEnJeu(perso)} — ${d.classe[perso.classe]}`,
                    }))}
                  />
                </>
              )}
            </section>
          )}

          <section className="carte" aria-labelledby="titre-acceptes">
            <p className="surtitre" id="titre-acceptes">
              {d.raid.joueursAcceptes(titulaires.length)}
            </p>
            {titulaires.length + remplacants.length === 0 ? (
              <p className="doux">{d.raid.personneAccepte}</p>
            ) : (
              <ul className="liste-acceptes">
                {[...titulaires, ...remplacants].map((i) => (
                  <li key={i.id}>
                    <span className="nom-classe">
                      <ClasseIcone classe={i.personnage!.classe} taille={24} />
                      <strong
                        className="classe"
                        style={{ "--c": `var(--classe-${i.personnage!.classe})` } as React.CSSProperties}
                      >
                        {nomVisible(i)}
                      </strong>
                    </span>
                    <span className="doux">
                      <NomRole role={i.role!} taille={18} />
                      {remplacants.includes(i) && d.raid.remplacantMin}
                      {estRl && (
                        <>
                          {" · "}
                          <Link href={`/joueurs/${i.utilisateurId}`}>{i.utilisateur.pseudo}</Link>
                        </>
                      )}
                    </span>
                    {estRl && (
                      <span className="actions-joueur">
                        {ecrireSurDiscord(i)}
                        {rlPeutAgir(annonce) && (
                          <BoutonRetirerJoueur
                            action={retirerJoueur}
                            inscriptionId={i.id}
                            nom={nomEnJeu(i.personnage!)}
                            penalite={retraitPenalise}
                          />
                        )}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="colonne-compo">
          <header className="entete-colonne">
            <p className="surtitre">{d.raid.joueurs(compo.total, annonce.taille)}</p>
            <h2 id="titre-compo">{d.raid.compo}</h2>
          </header>
          <section className="carte organisateur" aria-label={d.raid.organisateur}>
            <p className="surtitre">{d.raid.organisePar}</p>
            {organisateur && (
              <p className="organisateur-perso">
                <ClasseIcone classe={organisateur.classe} taille={32} />
                <strong
                  className="classe"
                  style={{ "--c": `var(--classe-${organisateur.classe})` } as React.CSSProperties}
                >
                  {nomEnJeu(organisateur)}
                </strong>
              </p>
            )}
            <p className="doux">
              {estRl ? d.commun.toi : <Link href={`/joueurs/${annonce.createurId}`}>{annonce.createur.pseudo}</Link>} ·{" "}
              <BadgeFiabilite fiabilite={fiabRl.get(annonce.createurId)} />
            </p>
          </section>
          <section className="carte compo-panneau" aria-labelledby="titre-compo">
            <div className="compo-chiffres">
              <div>
                <RoleIcone role="TANK" taille={30} />
                <strong>{roles.tanks}</strong>
                <small>{d.rolesPluriel.TANK}</small>
              </div>
              <div>
                <RoleIcone role="SOIGNEUR" taille={30} />
                <strong>{roles.soigneurs}</strong>
                <small>{d.rolesPluriel.SOIGNEUR}</small>
              </div>
              <div>
                <RoleIcone role="DPS" taille={30} />
                <strong>{roles.dps}</strong>
                <small>{d.rolesPluriel.DPS}</small>
              </div>
            </div>
            <p className="compo-total">
              <strong>
                {compo.total}/{annonce.taille}
              </strong>{" "}
              <span className="doux">{complet ? d.raid.complet : d.raid.placesRestantes(placesRestantes)}</span>
            </p>
            {compoParGroupe.map((g) => (
              <div key={g.role} className="compo-groupe">
                <h3>
                  <NomRole role={g.role} taille={18} />
                </h3>
                <ul>
                  {g.membres.map((m) => (
                    <li key={m.cle}>
                      {m.nom ? (
                        <span className="nom-classe">
                          <ClasseIcone classe={m.classe} />
                          <span
                            className="classe"
                            style={{ "--c": `var(--classe-${m.classe})` } as React.CSSProperties}
                          >
                            {m.nom}
                          </span>
                        </span>
                      ) : (
                        <NomClasse classe={m.classe} />
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {remplacants.length > 0 && (
              <div className="compo-groupe">
                <h3>{d.raid.remplacants}</h3>
                <ul>
                  {remplacants.map((i) => (
                    <li key={i.id}>
                      <span className="nom-classe">
                        <ClasseIcone classe={i.personnage!.classe} /> {nomVisible(i)}
                      </span>
                      <span className="compo-nombre">
                        <NomRole role={i.role!} taille={18} />
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {voitLogs && (
            <section className="carte logs-raid" aria-labelledby="titre-logs">
              <p className="surtitre" id="titre-logs">
                <IconeWarcraftLogs taille={18} /> {d.raid.logsRaid}
              </p>
              {annonce.lienLogs && (
                <a href={annonce.lienLogs} target="_blank" rel="noopener noreferrer nofollow" className="bouton petit">
                  <IconeWarcraftLogs taille={18} /> {d.raid.logsVoir}
                </a>
              )}
              {estRl && (
                <form action={enregistrerLogsRaid} className="formulaire-logs">
                  <input type="hidden" name="annonceId" value={annonce.id} />
                  <p className="doux">{d.raid.logsAide}</p>
                  <input
                    type="url"
                    name="lienLogs"
                    maxLength={300}
                    aria-label={d.raid.logsLien}
                    placeholder="https://fresh.warcraftlogs.com/reports/…"
                    defaultValue={annonce.lienLogs ?? ""}
                  />
                  <BoutonEnvoi className="petit" enCours={d.commun.enregistrement}>
                    {d.raid.logsEnregistrer}
                  </BoutonEnvoi>
                </form>
              )}
            </section>
          )}
        </aside>
      </div>
    </main>
  );
}
