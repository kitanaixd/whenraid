import Link from "next/link";
import { notFound } from "next/navigation";
import type { Classe } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { exigerUtilisateur } from "@/lib/session";
import { afficherDate } from "@/lib/dates";
import { nomRaid } from "@/lib/raids";
import { accepteCandidatures, compoActuelle, estActive, estComplet, estEnAttente } from "@/lib/annonces";
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
import { accepter, annuler, candidater, envoyerLesInvitations, refuser } from "./actions";
import { BoutonInvitations } from "./BoutonInvitations";
import { nomEnJeu } from "@/lib/invitations";
import { rolesPourPlace } from "./eligibilite";
import { BoutonAnnuler } from "./BoutonAnnuler";

const NOMBRE_DE_CLASSES = Object.keys(libelleClasse).length;
const ORDRE_ROLES = Object.keys(libelleRole);
const ORDRE_CLASSES = Object.keys(libelleClasse);

function libellePlace(place: { classesAcceptees: Classe[]; role: string | null }) {
  const classes =
    place.classesAcceptees.length === NOMBRE_DE_CLASSES
      ? null
      : place.classesAcceptees.map((c) => libelleClasse[c]).join(", ");
  const role = place.role ? libelleRole[place.role as keyof typeof libelleRole] : null;
  if (!classes && !role) return "Place libre (toute classe, tout rôle)";
  return [classes, role].filter(Boolean).join(" ");
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
          Organisé par {estRl ? "toi" : annonce.createur.pseudo} — {libelleStatutAnnonce[annonce.statut]}
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
              {l.nombre} × {libelleClasse[l.classe]} {libelleRole[l.role]}
            </li>
          ))}
      </ul>
      {remplacants.length > 0 && (
        <p>
          + {remplacants.length} remplaçant{remplacants.length > 1 ? "s" : ""} :{" "}
          {remplacants
            .map((i) => `${i.personnage!.nom} (${libelleClasse[i.personnage!.classe]} ${libelleRole[i.role!]})`)
            .join(", ")}
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
          {["PUBLIEE", "COMPLETE"].includes(annonce.statut) && (
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
              <strong>{libellePlace(place)}</strong> — {libelleStatutPlace[place.statut]}
              {!estRl && candidats.length > 0 && ` (${candidats.length} candidat${candidats.length > 1 ? "s" : ""})`}

              {estRl && candidats.length > 0 && (
                <ul>
                  {candidats.map((i) => (
                    <li key={i.id}>
                      <strong>{i.utilisateur.pseudo}</strong> — {i.personnage?.nom} (
                      {i.personnage && libelleClasse[i.personnage.classe]} {i.personnage?.niveau}
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
                            <button type="submit">
                              {place.statut === "POURVUE" ? "Appeler en remplaçant" : "Accepter"}
                            </button>
                          </form>{" "}
                          <form action={refuser} style={{ display: "inline" }}>
                            <input type="hidden" name="inscriptionId" value={i.id} />
                            <button type="submit">Refuser</button>
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
                  <button type="submit">{place.statut === "POURVUE" ? "Liste d'attente" : "Candidater"}</button>
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
