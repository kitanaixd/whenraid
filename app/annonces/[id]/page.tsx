import Link from "next/link";
import { notFound } from "next/navigation";
import type { Classe } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { exigerUtilisateur } from "@/lib/session";
import { afficherDate } from "@/lib/dates";
import { nomRaid } from "@/lib/raids";
import {
  accepteCandidatures,
  compoActuelle,
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
import { ClasseIcone, NomClasse } from "@/app/ClasseIcone";
import { fiabiliteMercenaires, fiabiliteRls, texteBadge } from "@/lib/fiabilite";

const NOMBRE_DE_CLASSES = Object.keys(libelleClasse).length;
const ORDRE_ROLES = Object.keys(libelleRole);
const ORDRE_CLASSES = Object.keys(libelleClasse);

function LibellePlace({ place }: { place: { classesAcceptees: Classe[]; role: string | null } }) {
  const toutes = place.classesAcceptees.length === NOMBRE_DE_CLASSES;
  const role = place.role ? libelleRole[place.role as keyof typeof libelleRole] : null;
  if (toutes && !role) return <>Place libre (toute classe, tout rôle)</>;
  return (
    <span className="nom-classe">
      {!toutes && place.classesAcceptees.map((c) => <NomClasse key={c} classe={c} />)}
      {role && <span>{role}</span>}
    </span>
  );
}

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

  return (
    <main>
      <p>
        <Link href="/">← Accueil</Link>
      </p>
      <h1>{nomRaid(annonce.contenu)}</h1>
      <p>
        <strong>{afficherDate(annonce.debutUtc, fuseau)}</strong>
        {annonce.dureeEstimee && ` — environ ${annonce.dureeEstimee / 60} h`}
      </p>
      <ul>
        <li>
          {libelleFaction[annonce.faction]}, {libelleRuleset[annonce.ruleset]} {annonce.region}
        </li>
        <li>Loot : {libelleReglesLoot[annonce.reglesLoot]}</li>
        {annonce.niveauMin && <li>Niveau minimum : {annonce.niveauMin}</li>}
        {annonce.langueRequise && <li>Langue : {annonce.langueRequise === "fr" ? "français" : "anglais"}</li>}
        <li>Vocal : {libelleVocal[annonce.vocal]}</li>
        <li>
          Organisé par{" "}
          {estRl ? "toi" : <Link href={`/joueurs/${annonce.createurId}`}>{annonce.createur.pseudo}</Link>}{" "}
          <small>({texteBadge(fiabRl.get(annonce.createurId)!)})</small> — {libelleStatutAnnonce[annonce.statut]}
        </li>
      </ul>

      {annonce.statut === "ANNULEE" && (
        <p className="avertissement grave" role="status">
          Ce raid a été annulé{annonce.annuleeLe && ` le ${afficherDate(annonce.annuleeLe, fuseau)}`}.
        </p>
      )}
      {typeof erreur === "string" && <p role="alert">⚠ {erreur}</p>}
      {maCandidature && (
        <p className="encadre">
          {maCandidature.statut === "CONFIRME" ? "✔ Tu es convié" : "⏳ Ta candidature est envoyée"} avec{" "}
          {maCandidature.personnage && <ClasseIcone classe={maCandidature.personnage.classe} />}{" "}
          <strong>{maCandidature.personnage?.nom}</strong>
          {maCandidature.role && ` (${libelleRole[maCandidature.role]})`} —{" "}
          {libelleStatutInscription[maCandidature.statut]}.
          {maCandidature.statut === "LISTE_ATTENTE" &&
            " Le raid est plein : peu de chances d'être pris, mais le RL peut encore t'appeler en remplaçant."}
        </p>
      )}

      <h2>
        Compo actuelle — {compo.total}/{annonce.taille}
        {complet
          ? " (complet)"
          : `, ${placesRestantes} place${placesRestantes > 1 ? "s" : ""} restante${placesRestantes > 1 ? "s" : ""}`}
      </h2>
      <ul>
        {compo.lignes
          .sort(
            (a, b) =>
              ORDRE_ROLES.indexOf(a.role) - ORDRE_ROLES.indexOf(b.role) ||
              ORDRE_CLASSES.indexOf(a.classe) - ORDRE_CLASSES.indexOf(b.classe),
          )
          .map((l) => (
            <li key={`${l.classe}.${l.role}`}>
              {l.nombre} × <NomClasse classe={l.classe} /> {libelleRole[l.role]}
            </li>
          ))}
      </ul>
      {remplacants.length > 0 && (
        <p>
          + {remplacants.length} remplaçant{remplacants.length > 1 ? "s" : ""} :{" "}
          {remplacants.map((i, n) => (
            <span key={i.id}>
              {n > 0 && ", "}
              <ClasseIcone classe={i.personnage!.classe} /> {i.personnage!.nom} ({libelleRole[i.role!]})
            </span>
          ))}
        </p>
      )}

      {estRl && (
        <section>
          <h2>Espace RL</h2>
          {annonce.vocal === "DISCORD" && <p>Lien Discord : {annonce.vocalDiscordLien}</p>}
          {annonce.vocal === "TEAMSPEAK" && (
            <p>
              TeamSpeak : {annonce.vocalTsAdresse}
              {annonce.vocalTsMotDePasse && ` — mot de passe : ${annonce.vocalTsMotDePasse}`}
            </p>
          )}
          {annonce.vocal !== "AUCUN" && (
            <p>
              <small>
                Ces identifiants ne sont visibles que par toi. Le bot les enverra en MP aux joueurs confirmés quand
                tu enverras les invitations.
              </small>
            </p>
          )}
          {rlPeutAgir(annonce) && (
            <div>
              <BoutonInvitations
                action={envoyerLesInvitations}
                annonceId={annonce.id}
                resume={`${nomRaid(annonce.contenu)} — ${afficherDate(annonce.debutUtc, fuseau)}`}
                nbConfirmes={confirmes.length}
                vocal={
                  annonce.vocal === "DISCORD"
                    ? `Discord (${annonce.vocalDiscordLien})`
                    : annonce.vocal === "TEAMSPEAK"
                      ? `TeamSpeak (${annonce.vocalTsAdresse})`
                      : "aucun"
                }
                commandeWhisper={
                  annonce.organisateurPersonnage ? `/w ${nomEnJeu(annonce.organisateurPersonnage)} inv` : null
                }
                dejaEnvoyeesLe={annonce.invitationsEnvoyeesLe && afficherDate(annonce.invitationsEnvoyeesLe, fuseau)}
              />
            </div>
          )}
          {ouvert && (
            <BoutonAnnuler
              action={annuler}
              annonceId={annonce.id}
              resume={`${nomRaid(annonce.contenu)} — ${afficherDate(annonce.debutUtc, fuseau)}`}
              nbInscrits={confirmes.length}
              estComplet={complet}
            />
          )}
        </section>
      )}

      {estRl && presences.visible && (
        <section id="presences">
          <h2>Feuille de présence</h2>
          {annonce.presencesValideesLe ? (
            <p className="encadre">✔ Présences validées le {afficherDate(annonce.presencesValideesLe, fuseau)}.</p>
          ) : (
            <p>
              <small>
                Signale les absents pendant le raid, puis valide la fin du raid une fois terminé. Tout le monde est
                présent par défaut.
              </small>
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
                          <Link href={`/joueurs/${i.utilisateurId}`}>{i.utilisateur.pseudo}</Link> —{" "}
                          <ClasseIcone classe={i.personnage!.classe} /> {i.personnage!.nom}
                        </td>
                        <td>
                          <select
                            name={`presence.${i.id}`}
                            defaultValue={p?.resultat ?? "PRESENT"}
                            disabled={!presences.modifiable}
                            aria-label={`Présence de ${i.personnage!.nom}`}
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
                            aria-label={`${i.personnage!.nom} s'est distingué`}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {presences.modifiable && (
                <p>
                  <BoutonEnvoi enCours="Enregistrement…">Enregistrer</BoutonEnvoi>{" "}
                  {presences.validable && (
                    <BoutonEnvoi name="valider" value="1" className="principal" enCours="Validation…">
                      Valider la fin du raid
                    </BoutonEnvoi>
                  )}
                </p>
              )}
            </form>
          )}
        </section>
      )}

      <h2>Places</h2>
      {complet && !estRl && ouvert && !maCandidature && (
        <p className="encadre">
          ⚠ Ce raid est complet : si tu candidates, tu seras en liste d&apos;attente avec peu de chances d&apos;être
          pris. Le RL pourra quand même t&apos;appeler en remplaçant.
        </p>
      )}
      <ol>
        {annonce.places.map((place) => {
          const candidats = place.inscriptions.filter((i) => estActive(i.statut));
          const choix = mesPersonnages.flatMap((p) =>
            rolesPourPlace(p, place, annonce).map((role) => ({ valeur: `${p.id}:${role}`, perso: p, role })),
          );
          return (
            <li key={place.id}>
              <strong>
                <LibellePlace place={place} />
              </strong>{" "}
              — {libelleStatutPlace[place.statut]}
              {!estRl && candidats.length > 0 && ` (${candidats.length} candidat${candidats.length > 1 ? "s" : ""})`}

              {estRl && candidats.length > 0 && (
                <ul>
                  {candidats.map((i) => (
                    <li key={i.id}>
                      <strong>
                        <Link href={`/joueurs/${i.utilisateurId}`}>{i.utilisateur.pseudo}</Link>
                      </strong>{" "}
                      <small>{fiabCandidats.get(i.utilisateurId) && texteBadge(fiabCandidats.get(i.utilisateurId)!)}</small>{" "}
                      — {i.personnage && <ClasseIcone classe={i.personnage.classe} />} {i.personnage?.nom} (niv.{" "}
                      {i.personnage?.niveau}
                      {i.role && `, ${libelleRole[i.role]}`}) — {libelleStatutInscription[i.statut]}
                      {remplacants.some((r) => r.id === i.id) && " (remplaçant)"}
                      {i.note && (
                        <>
                          <br />« {i.note} »
                        </>
                      )}
                      {estEnAttente(i.statut) && annonce.statut !== "ANNULEE" && (
                        <>
                          <br />
                          <form action={accepter} style={{ display: "inline" }}>
                            <input type="hidden" name="inscriptionId" value={i.id} />
                            <BoutonEnvoi enCours="…">
                              {place.statut === "POURVUE" ? "Appeler en remplaçant" : "Accepter"}
                            </BoutonEnvoi>
                          </form>{" "}
                          <form action={refuser} style={{ display: "inline" }}>
                            <input type="hidden" name="inscriptionId" value={i.id} />
                            <BoutonEnvoi enCours="…">Refuser</BoutonEnvoi>
                          </form>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {choix.length > 0 && place.statut !== "ANNULEE" && (
                <form action={candidater}>
                  <input type="hidden" name="placeId" value={place.id} />
                  <select name="choix" aria-label="Personnage et rôle">
                    {choix.map((c) => (
                      <option key={c.valeur} value={c.valeur}>
                        {c.perso.nom} ({libelleClasse[c.perso.classe]} {c.perso.niveau}) — {libelleRole[c.role]}
                      </option>
                    ))}
                  </select>{" "}
                  <input
                    name="note"
                    maxLength={80}
                    placeholder="Note pour le RL (80 caractères max)"
                    aria-label="Note pour le RL"
                    size={36}
                  />{" "}
                  <BoutonEnvoi enCours="Envoi…">
                    {place.statut === "POURVUE" ? "Liste d'attente" : "Candidater"}
                  </BoutonEnvoi>
                </form>
              )}
            </li>
          );
        })}
      </ol>
      {!estRl && !maCandidature && ouvert && mesPersonnages.length === 0 && (
        <p>
          Pour candidater, déclare d&apos;abord <Link href="/personnages">un personnage</Link>.
        </p>
      )}
    </main>
  );
}
