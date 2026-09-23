import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { exigerUtilisateur } from "@/lib/session";
import { afficherDate } from "@/lib/dates";
import { nomRaid, raids } from "@/lib/raids";
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
  libelleClasse,
  libelleFaction,
  libelleReglesLoot,
  libelleRole,
  libelleRuleset,
  libelleStatutAnnonce,
  libelleStatutInscription,
  libelleVocal,
} from "@/lib/libelles";
import { accepter, annuler, candidater, enregistrerPresences, envoyerLesInvitations, refuser } from "./actions";
import { BoutonInvitations } from "./BoutonInvitations";
import { nomEnJeu } from "@/lib/invitations";
import { placePourRoles, rolesPourRaid, rolesProposes } from "@/lib/eligibilite";
import type { Classe, Role } from "@/generated/prisma/enums";
import { BoutonAnnuler } from "./BoutonAnnuler";
import { BoutonEnvoi } from "@/app/BoutonEnvoi";
import { ClasseIcone, NomClasse, NomRole, PastilleFaction, RoleIcone } from "@/app/ClasseIcone";
import { FormCandidature } from "./FormCandidature";
import { fiabiliteMercenaires, fiabiliteRls, texteBadge } from "@/lib/fiabilite";

const NOMBRE_DE_CLASSES = Object.keys(libelleClasse).length;
const ORDRE_ROLES = Object.keys(libelleRole);
const ORDRE_CLASSES = Object.keys(libelleClasse);

// Couleur des pastilles selon le statut.
const CLASSE_STATUT_ANNONCE: Record<string, string> = { PUBLIEE: "ouvert", COMPLETE: "complet", ANNULEE: "alerte" };
const CLASSE_STATUT_INSCRIPTION: Record<string, string> = {
  CONFIRME: "succes",
  LISTE_ATTENTE: "complet",
  INSCRIT: "ouvert",
};


export default async function PageAnnonce({ params, searchParams }: PageProps<"/annonces/[id]">) {
  const utilisateur = await exigerUtilisateur();
  const { id } = await params;
  const { erreur, perso: persoChoisi } = await searchParams;

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
            include: { personnage: true, utilisateur: { select: { pseudo: true } } },
          },
        },
      },
    },
  });
  if (!annonce) notFound();

  const fuseau = utilisateur.fuseauHoraire;
  const estRl = annonce.createurId === utilisateur.id;
  const inscriptions = annonce.places.flatMap((p) => p.inscriptions.map((i) => ({ ...i, place: p })));
  const confirmes = inscriptions.filter((i) => i.statut === "CONFIRME" && i.personnage && i.role);
  // Par place, le premier confirmé est titulaire ; les suivants sont des remplaçants.
  const premiers = annonce.places.flatMap((p) =>
    p.inscriptions.filter((i) => i.statut === "CONFIRME").slice(0, 1),
  );
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

  const roles = compoParRole(compo.lignes);
  // Compo joueur par joueur : les membres déclarés par le RL (sans nom) puis les joueurs acceptés.
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
      .map((i) => ({ cle: i.id, classe: i.personnage!.classe, role: i.role!, nom: nomEnJeu(i.personnage!) })),
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

  // Candidatures en attente (vue du RL) : « Accepter » s'il reste une place compatible, sinon « Remplaçant ».
  const candidatsEnAttente = inscriptions
    .filter((i) => estEnAttente(i.statut))
    .sort((x, y) => Number(x.statut === "LISTE_ATTENTE") - Number(y.statut === "LISTE_ATTENTE"))
    .map((i) => ({
      ...i,
      // Pour chaque rôle proposé : reste-t-il une place ouverte ? (sinon « Remplaçant »)
      choixRoles: rolesProposes(i).map((role) => ({
        role,
        ouverte: Boolean(
          i.personnage && placePourRoles(annonce.places, i.personnage, [role], annonce)?.ouverte,
        ),
      })),
    }));
  const persosCandidats = mesPersonnages
    .map((p) => ({ perso: p, roles: rolesPourRaid(p, annonce.places, annonce) }))
    .filter((c) => c.roles.length > 0);
  const organisateur = annonce.organisateurPersonnage;
  const resumeRaid = `${nomRaid(annonce.contenu)} — ${afficherDate(annonce.debutUtc, fuseau)}`;

  return (
    <main data-fond={raids[annonce.contenu].image}>
      <Link href="/" className="retour">
        ← Tous les raids
      </Link>

      <header className="entete-raid">
        <p className="surtitre">
          {libelleFaction[annonce.faction]} · {libelleRuleset[annonce.ruleset]} {annonce.region}
        </p>
        <h1>{nomRaid(annonce.contenu)}</h1>
        <div className="ornement" aria-hidden="true">
          ◆
        </div>
        <p className="quand-raid">
          {afficherDate(annonce.debutUtc, fuseau)}
          {annonce.dureeEstimee && <span className="doux"> · environ {annonce.dureeEstimee / 60} h</span>}
        </p>
        <div className="pastilles centre">
          <PastilleFaction faction={annonce.faction} />
          <span className="pastille">
            Ruleset : {libelleRuleset[annonce.ruleset]} · {annonce.region}
          </span>
          <span className="pastille">Loot : {libelleReglesLoot[annonce.reglesLoot]}</span>
          <span className="pastille">Vocal : {libelleVocal[annonce.vocal]}</span>
          {annonce.langueRequise && (
            <span className="pastille">{annonce.langueRequise === "fr" ? "Français" : "Anglais"}</span>
          )}
          {annonce.niveauMin && <span className="pastille">Niveau {annonce.niveauMin}+</span>}
          <span className={`pastille ${CLASSE_STATUT_ANNONCE[annonce.statut] ?? ""}`}>
            {libelleStatutAnnonce[annonce.statut]}
          </span>
        </div>
      </header>

      {annonce.statut === "ANNULEE" && (
        <p className="avertissement grave" role="status">
          Ce raid a été annulé{annonce.annuleeLe && ` le ${afficherDate(annonce.annuleeLe, fuseau)}`}.
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
          <p className="surtitre">Espace RL</p>
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
                  — mot de passe : <code>{annonce.vocalTsMotDePasse}</code>
                </>
              )}
            </p>
          )}
          {annonce.vocal !== "AUCUN" && (
            <p className="doux">
              Visibles par toi seul : le bot les enverra en MP aux joueurs confirmés avec les invitations.
            </p>
          )}
          <div className="actions-rl">
            {rlPeutAgir(annonce) && (
              <BoutonInvitations
                action={envoyerLesInvitations}
                annonceId={annonce.id}
                resume={resumeRaid}
                nbConfirmes={confirmes.length}
                vocal={
                  annonce.vocal === "DISCORD"
                    ? `Discord (${annonce.vocalDiscordLien})`
                    : annonce.vocal === "TEAMSPEAK"
                      ? `TeamSpeak (${annonce.vocalTsAdresse})`
                      : "aucun"
                }
                commandeWhisper={organisateur ? `/w ${nomEnJeu(organisateur)} inv` : null}
                dejaEnvoyeesLe={annonce.invitationsEnvoyeesLe && afficherDate(annonce.invitationsEnvoyeesLe, fuseau)}
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
          <p className="surtitre">Feuille de présence</p>
          {annonce.presencesValideesLe ? (
            <p className="encadre">✔ Présences validées le {afficherDate(annonce.presencesValideesLe, fuseau)}.</p>
          ) : (
            <p className="doux">
              Signale les absents pendant le raid, puis valide la fin du raid une fois terminé. Tout le monde est
              présent par défaut.
            </p>
          )}
          {confirmes.length === 0 ? (
            <p>Aucun joueur confirmé sur ce raid.</p>
          ) : (
            <form action={enregistrerPresences}>
              <input type="hidden" name="annonceId" value={annonce.id} />
              <table>
                <thead>
                  <tr>
                    <th>Joueur</th>
                    <th>Présence</th>
                    <th>S&apos;est distingué</th>
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
                            aria-label={`Présence de ${nomEnJeu(i.personnage!)}`}
                          >
                            <option value="PRESENT">Présent</option>
                            <option value="ABSENT">Absent</option>
                            <option value="PARTI_EN_COURS">Parti en cours</option>
                          </select>
                        </td>
                        <td>
                          <input
                            type="checkbox"
                            name={`distinction.${i.id}`}
                            defaultChecked={p?.distinction ?? false}
                            disabled={!presences.modifiable}
                            aria-label={`${nomEnJeu(i.personnage!)} s'est distingué`}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {presences.modifiable && (
                <div className="actions-rl">
                  <BoutonEnvoi enCours="Enregistrement…">Enregistrer</BoutonEnvoi>
                  {presences.validable && (
                    <BoutonEnvoi name="valider" value="1" className="principal" enCours="Validation…">
                      Valider la fin du raid
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
            <p className="surtitre">
              {complet ? "Raid complet" : `${placesRestantes} place${placesRestantes > 1 ? "s" : ""} à pourvoir`}
            </p>
            <h2>Le raid</h2>
          </header>

          <section className="carte" aria-labelledby="titre-recherche">
            <p className="surtitre" id="titre-recherche">
              Recherché
            </p>
            <ul className="liste-besoins">
              {besoins.map((b) => (
                <li key={b.cle} className={`besoin ${b.ouvertes === 0 ? "besoin-pourvu" : ""}`}>
                  <div className="besoin-quoi">
                    {b.classes.length === NOMBRE_DE_CLASSES ? (
                      <span className="place-libre">Toute classe</span>
                    ) : (
                      b.classes.map((c) => <NomClasse key={c} classe={c} taille={24} />)
                    )}
                    <span className="place-role">
                      {b.role ? <NomRole role={b.role} taille={20} /> : "Tout rôle"}
                    </span>
                  </div>
                  <span className={`pastille ${b.ouvertes === 0 ? "complet" : "ouvert"}`}>
                    {b.ouvertes === 0
                      ? `${b.total} pourvue${b.total > 1 ? "s" : ""}`
                      : `${b.ouvertes} / ${b.total} à pourvoir`}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {estRl ? (
            <section className="carte" aria-labelledby="titre-candidatures">
              <p className="surtitre" id="titre-candidatures">
                Candidatures reçues · {candidatsEnAttente.length}
              </p>
              {candidatsEnAttente.length === 0 ? (
                <p className="doux">Aucune candidature en attente pour le moment.</p>
              ) : (
                <ul className="liste-candidats">
                  {candidatsEnAttente.map((i) => (
                    <li key={i.id} className="candidat">
                      <div className="candidat-infos">
                        <div>
                          {i.personnage && <ClasseIcone classe={i.personnage.classe} taille={26} />}{" "}
                          <strong
                            className="classe"
                            style={
                              i.personnage
                                ? ({ "--c": `var(--classe-${i.personnage.classe})` } as React.CSSProperties)
                                : undefined
                            }
                          >
                            {i.personnage && nomEnJeu(i.personnage)}
                          </strong>{" "}
                          <span className="doux">niv. {i.personnage?.niveau}</span>
                        </div>
                        <div className="roles-proposes">
                          {i.choixRoles.map((c) => (
                            <NomRole key={c.role} role={c.role} taille={18} />
                          ))}
                        </div>
                        <div className="doux">
                          <Link href={`/joueurs/${i.utilisateurId}`}>{i.utilisateur.pseudo}</Link> ·{" "}
                          {fiabCandidats.get(i.utilisateurId) && texteBadge(fiabCandidats.get(i.utilisateurId)!)}
                        </div>
                        {i.personnage?.lienLogs && (
                          <a href={i.personnage.lienLogs} target="_blank" rel="noopener noreferrer nofollow">
                            Voir ses logs (Warcraft Logs) ↗
                          </a>
                        )}
                        {i.note && <blockquote className="note">« {i.note} »</blockquote>}
                      </div>
                      <div className="candidat-actions">
                        <span className={`pastille ${CLASSE_STATUT_INSCRIPTION[i.statut] ?? ""}`}>
                          {libelleStatutInscription[i.statut]}
                        </span>
                        {rlPeutAgir(annonce) && (
                          <div className="boutons">
                            {i.choixRoles.map((c) => (
                              <form key={c.role} action={accepter}>
                                <input type="hidden" name="inscriptionId" value={i.id} />
                                <input type="hidden" name="role" value={c.role} />
                                <BoutonEnvoi className="petit principal" enCours="…">
                                  <span className="nom-classe">
                                    {c.ouverte ? "Accepter" : "Remplaçant"}
                                    {i.choixRoles.length > 1 && ` · ${libelleRole[c.role]}`}
                                  </span>
                                </BoutonEnvoi>
                              </form>
                            ))}
                            <form action={refuser}>
                              <input type="hidden" name="inscriptionId" value={i.id} />
                              <BoutonEnvoi className="petit" enCours="…">
                                Refuser
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
              <p className="surtitre" id="titre-candidature">
                Candidature
              </p>
              {maCandidature ? (
                <p>
                  {maCandidature.statut === "CONFIRME" ? "✔ Tu es convié" : "⏳ Ta candidature est envoyée"} avec{" "}
                  {maCandidature.personnage && <ClasseIcone classe={maCandidature.personnage.classe} />}{" "}
                  <strong>{maCandidature.personnage && nomEnJeu(maCandidature.personnage)}</strong>
                  {/* En attente : les rôles proposés ; convié : le rôle retenu par le RL. */}
                  {(maCandidature.statut === "CONFIRME" ? [maCandidature.role!] : rolesProposes(maCandidature)).map(
                    (r) => (
                      <span key={r}>
                        {" "}
                        <NomRole role={r} taille={18} />
                      </span>
                    ),
                  )}{" "}
                  — {libelleStatutInscription[maCandidature.statut]}.
                  {maCandidature.statut === "LISTE_ATTENTE" &&
                    " Aucune place compatible n'est libre : peu de chances d'être pris, mais le RL peut encore t'appeler en remplaçant."}
                </p>
              ) : !ouvert ? (
                <p className="doux">Ce raid n&apos;accepte plus de candidatures.</p>
              ) : mesPersonnages.length === 0 ? (
                <p className="doux">
                  Pour candidater, déclare d&apos;abord <Link href="/personnages">un personnage</Link>.
                </p>
              ) : persosCandidats.length === 0 ? (
                <p className="doux">
                  Aucun de tes personnages ne correspond aux places de ce raid (faction, serveur, niveau ou classe).
                </p>
              ) : (
                <>
                  {complet && (
                    <p className="encadre">
                      ⚠ Ce raid est complet : si tu candidates, tu seras en liste d&apos;attente avec peu de chances
                      d&apos;être pris. Le RL pourra quand même t&apos;appeler en remplaçant.
                    </p>
                  )}
                  <FormCandidature
                    action={candidater}
                    annonceId={annonce.id}
                    listeAttente={complet}
                    persoInitial={typeof persoChoisi === "string" ? persoChoisi : undefined}
                    persos={persosCandidats.map(({ perso, roles }) => ({
                      id: perso.id,
                      classe: perso.classe,
                      roles,
                      libelle: `${nomEnJeu(perso)} — ${libelleClasse[perso.classe]} niv. ${perso.niveau}`,
                    }))}
                  />
                </>
              )}
            </section>
          )}

          <section className="carte" aria-labelledby="titre-acceptes">
            <p className="surtitre" id="titre-acceptes">
              Joueurs acceptés · {titulaires.length}
            </p>
            {titulaires.length + remplacants.length === 0 ? (
              <p className="doux">Personne n&apos;a encore été accepté.</p>
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
                        {nomEnJeu(i.personnage!)}
                      </strong>
                    </span>
                    <span className="doux">
                      <NomRole role={i.role!} taille={18} />
                      {remplacants.includes(i) && " · remplaçant"}
                      {estRl && (
                        <>
                          {" · "}
                          <Link href={`/joueurs/${i.utilisateurId}`}>{i.utilisateur.pseudo}</Link>
                        </>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="colonne-compo">
          <header className="entete-colonne">
            <p className="surtitre">
              {compo.total}/{annonce.taille} joueurs
            </p>
            <h2 id="titre-compo">Compo</h2>
          </header>
          <section className="carte compo-panneau" aria-labelledby="titre-compo">
            <div className="compo-chiffres">
              <div>
                <RoleIcone role="TANK" taille={30} />
                <strong>{roles.tanks}</strong>
                <small>Tanks</small>
              </div>
              <div>
                <RoleIcone role="SOIGNEUR" taille={30} />
                <strong>{roles.soigneurs}</strong>
                <small>Soigneurs</small>
              </div>
              <div>
                <RoleIcone role="DPS" taille={30} />
                <strong>{roles.dps}</strong>
                <small>DPS</small>
              </div>
            </div>
            <p className="compo-total">
              <strong>
                {compo.total}/{annonce.taille}
              </strong>{" "}
              <span className="doux">
                {complet
                  ? "· complet"
                  : `· ${placesRestantes} place${placesRestantes > 1 ? "s" : ""} restante${placesRestantes > 1 ? "s" : ""}`}
              </span>
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
                          <span className="classe" style={{ "--c": `var(--classe-${m.classe})` } as React.CSSProperties}>
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
                <h3>Remplaçants</h3>
                <ul>
                  {remplacants.map((i) => (
                    <li key={i.id}>
                      <span className="nom-classe">
                        <ClasseIcone classe={i.personnage!.classe} /> {nomEnJeu(i.personnage!)}
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

          <section className="carte organisateur" aria-label="Organisateur">
            <p className="surtitre">Organisé par</p>
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
              {estRl ? "Toi" : <Link href={`/joueurs/${annonce.createurId}`}>{annonce.createur.pseudo}</Link>} ·{" "}
              {texteBadge(fiabRl.get(annonce.createurId)!)}
            </p>
          </section>
        </aside>
      </div>
    </main>
  );
}
