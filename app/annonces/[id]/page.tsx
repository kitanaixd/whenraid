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
  libelleStatutPlace,
  libelleVocal,
} from "@/lib/libelles";
import { accepter, annuler, candidater, enregistrerPresences, envoyerLesInvitations, refuser } from "./actions";
import { BoutonInvitations } from "./BoutonInvitations";
import { nomEnJeu } from "@/lib/invitations";
import { rolesPourPlace } from "./eligibilite";
import { BoutonAnnuler } from "./BoutonAnnuler";
import { BoutonEnvoi } from "@/app/BoutonEnvoi";
import { ClasseIcone, NomClasse, NomRole, RoleIcone } from "@/app/ClasseIcone";
import { FormCandidature } from "./FormCandidature";
import { fiabiliteMercenaires, fiabiliteRls, texteBadge } from "@/lib/fiabilite";

const NOMBRE_DE_CLASSES = Object.keys(libelleClasse).length;
const ORDRE_ROLES = Object.keys(libelleRole);
const ORDRE_CLASSES = Object.keys(libelleClasse);

// Couleur des pastilles selon le statut.
const CLASSE_STATUT_ANNONCE: Record<string, string> = { PUBLIEE: "ouvert", COMPLETE: "complet", ANNULEE: "alerte" };
const CLASSE_STATUT_PLACE: Record<string, string> = { OUVERTE: "ouvert", POURVUE: "complet", ANNULEE: "" };
const CLASSE_STATUT_INSCRIPTION: Record<string, string> = {
  CONFIRME: "succes",
  LISTE_ATTENTE: "complet",
  INSCRIT: "ouvert",
};


export default async function PageAnnonce({ params, searchParams }: PageProps<"/annonces/[id]">) {
  const utilisateur = await exigerUtilisateur();
  const { id } = await params;
  const { erreur } = await searchParams;

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
  const titulaires = annonce.places.flatMap((p) =>
    p.inscriptions.filter((i) => i.statut === "CONFIRME").slice(0, 1),
  );
  const remplacants = confirmes.filter((i) => !titulaires.some((t) => t.id === i.id));
  const compo = compoActuelle(
    annonce.composition,
    confirmes.filter((i) => !remplacants.includes(i)).map((i) => ({ classe: i.personnage!.classe, role: i.role! })),
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
      : await db.personnage.findMany({ where: { utilisateurId: utilisateur.id }, orderBy: { nom: "asc" } });

  const roles = compoParRole(compo.lignes);
  const lignesTriees = [...compo.lignes].sort(
    (a, b) =>
      ORDRE_ROLES.indexOf(a.role) - ORDRE_ROLES.indexOf(b.role) ||
      ORDRE_CLASSES.indexOf(a.classe) - ORDRE_CLASSES.indexOf(b.classe),
  );
  const compoParGroupe = ORDRE_ROLES.map((role) => ({
    role: role as keyof typeof libelleRole,
    lignes: lignesTriees.filter((l) => l.role === role),
  })).filter((g) => g.lignes.length > 0);
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
          <span className={`pastille ${annonce.faction === "HORDE" ? "horde" : "alliance"}`}>
            {libelleFaction[annonce.faction]}
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
      {maCandidature && (
        <p className="encadre">
          {maCandidature.statut === "CONFIRME" ? "✔ Tu es convié" : "⏳ Ta candidature est envoyée"} avec{" "}
          {maCandidature.personnage && <ClasseIcone classe={maCandidature.personnage.classe} />}{" "}
          <strong>{maCandidature.personnage && nomEnJeu(maCandidature.personnage)}</strong>
          {maCandidature.role && (
            <>
              {" "}
              (<NomRole role={maCandidature.role} taille={18} />)
            </>
          )}{" "}
          —{" "}
          {libelleStatutInscription[maCandidature.statut]}.
          {maCandidature.statut === "LISTE_ATTENTE" &&
            " Le raid est plein : peu de chances d'être pris, mais le RL peut encore t'appeler en remplaçant."}
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
          <section aria-labelledby="titre-places">
            <p className="surtitre">
              {complet ? "Raid complet" : `${placesRestantes} place${placesRestantes > 1 ? "s" : ""} à pourvoir`}
            </p>
            <h2 id="titre-places">Places</h2>
            {complet && !estRl && ouvert && !maCandidature && (
              <p className="encadre">
                ⚠ Ce raid est complet : si tu candidates, tu seras en liste d&apos;attente avec peu de chances
                d&apos;être pris. Le RL pourra quand même t&apos;appeler en remplaçant.
              </p>
            )}
            <ul className="liste-places">
              {annonce.places.map((place) => {
                const candidats = place.inscriptions.filter((i) => estActive(i.statut));
                const persosEligibles = mesPersonnages
                  .map((p) => ({ perso: p, roles: rolesPourPlace(p, place, annonce) }))
                  .filter((c) => c.roles.length > 0);
                const toutes = place.classesAcceptees.length === NOMBRE_DE_CLASSES;
                return (
                  <li key={place.id} className={`carte place place-${place.statut.toLowerCase()}`}>
                    {!toutes && <p className="etiquette-place">Classes mises en avant</p>}
                    <div className="place-entete">
                      <div className="place-quoi">
                        {toutes ? (
                          <span className="place-libre">Toute classe</span>
                        ) : (
                          place.classesAcceptees.map((c) => <NomClasse key={c} classe={c} taille={26} />)
                        )}
                        <span className="place-role">
                          {place.role ? <NomRole role={place.role} taille={20} /> : "Tout rôle"}
                        </span>
                      </div>
                      <span className={`pastille ${CLASSE_STATUT_PLACE[place.statut]}`}>
                        {libelleStatutPlace[place.statut]}
                      </span>
                    </div>

                    {!estRl && candidats.length > 0 && (
                      <p className="doux">
                        {candidats.length} candidat{candidats.length > 1 ? "s" : ""}
                      </p>
                    )}

                    {estRl && candidats.length > 0 && (
                      <ul className="liste-candidats">
                        {candidats.map((i) => (
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
                                <span className="doux">
                                  niv. {i.personnage?.niveau}
                                  {i.role && (
                                    <>
                                      {" · "}
                                      <NomRole role={i.role} taille={18} />
                                    </>
                                  )}
                                </span>
                              </div>
                              <div className="doux">
                                <Link href={`/joueurs/${i.utilisateurId}`}>{i.utilisateur.pseudo}</Link> ·{" "}
                                {fiabCandidats.get(i.utilisateurId) && texteBadge(fiabCandidats.get(i.utilisateurId)!)}
                              </div>
                              {i.note && <blockquote className="note">« {i.note} »</blockquote>}
                            </div>
                            <div className="candidat-actions">
                              <span className={`pastille ${CLASSE_STATUT_INSCRIPTION[i.statut] ?? ""}`}>
                                {libelleStatutInscription[i.statut]}
                                {remplacants.some((r) => r.id === i.id) && " · remplaçant"}
                              </span>
                              {estEnAttente(i.statut) && annonce.statut !== "ANNULEE" && (
                                <div className="boutons">
                                  <form action={accepter}>
                                    <input type="hidden" name="inscriptionId" value={i.id} />
                                    <BoutonEnvoi className="petit principal" enCours="…">
                                      {place.statut === "POURVUE" ? "Remplaçant" : "Accepter"}
                                    </BoutonEnvoi>
                                  </form>
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

                    {persosEligibles.length > 0 && place.statut !== "ANNULEE" && (
                      <FormCandidature
                        action={candidater}
                        placeId={place.id}
                        listeAttente={place.statut === "POURVUE"}
                        persos={persosEligibles.map(({ perso, roles }) => ({
                          id: perso.id,
                          classe: perso.classe,
                          roles,
                          libelle: `${nomEnJeu(perso)} — ${libelleClasse[perso.classe]} niv. ${perso.niveau}`,
                        }))}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
            {!estRl && !maCandidature && ouvert && mesPersonnages.length === 0 && (
              <p className="doux">
                Pour candidater, déclare d&apos;abord <Link href="/personnages">un personnage</Link>.
              </p>
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
                  {g.lignes.map((l) => (
                    <li key={`${l.classe}.${l.role}`}>
                      <NomClasse classe={l.classe} />
                      <span className="compo-nombre">× {l.nombre}</span>
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
