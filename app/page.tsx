import Image from "next/image";
import Link from "next/link";
import { signIn } from "@/lib/auth";
import { utilisateurConnecte } from "@/lib/session";
import { db } from "@/lib/db";
import { afficherDate, localVersUtc } from "@/lib/dates";
import { nomRaid, raids } from "@/lib/raids";
import { rolesPourRaid } from "@/lib/eligibilite";
import { chargerMesRaids } from "@/lib/mesRaids";
import { fiabiliteRls, texteBadge } from "@/lib/fiabilite";
import { compoActuelle, compoParRole } from "@/lib/annonces";
import { Contenu, type Classe } from "@/generated/prisma/enums";
import type { AnnonceWhereInput } from "@/generated/prisma/models";
import { ClasseIcone, FactionIcone, NomRole, PastilleFaction, PastilleRuleset, RoleIcone } from "./ClasseIcone";
import { nomEnJeu } from "@/lib/jeu";

const NOMBRE_DE_CLASSES = 9;
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
      include: {
        createur: { select: { pseudo: true } },
        composition: true,
        places: {
          select: {
            id: true,
            statut: true,
            role: true,
            classesAcceptees: true,
            inscriptions: {
              where: { statut: "CONFIRME" },
              orderBy: { inscritLe: "asc" },
              take: 1, // le titulaire de la place (les suivants sont des remplaçants)
              select: { role: true, personnage: { select: { classe: true } } },
            },
          },
        },
      },
    }),
    chargerMesRaids(utilisateur.id),
  ]);
  const { convocations, candidatures, organises } = mesRaids;
  // Un raid n'apparaît que si le personnage choisi peut y tenir une place (classe, niveau…),
  // ou s'il y a déjà candidaté.
  const dejaInscrit = new Set(
    [...convocations, ...candidatures].filter((i) => i.personnageId === perso?.id).map((i) => i.place.annonce.id),
  );
  const annonces = perso
    ? annoncesBrutes
        .filter((a) => dejaInscrit.has(a.id) || rolesPourRaid(perso, a.places, a).length > 0)
        .slice(0, 50)
    : [];
  const fiabilite = await fiabiliteRls([...new Set(annonces.map((a) => a.createurId))]);

  return (
    <main>
      <header className="accueil-connecte">
        <p className="surtitre">WoW Forever · {utilisateur.pseudo}</p>
        <h1>Trouve ton prochain raid</h1>
        <div className="ornement" aria-hidden="true">◆</div>
      </header>

      {(convocations.length > 0 || candidatures.length > 0 || organises.length > 0) && (
        <section className="encadre" aria-labelledby="titre-mes-raids">
          <h2 id="titre-mes-raids">Tes raids</h2>
          {convocations.map((i) => (
            <p key={i.id}>
              ✔ <strong>Convié</strong> :{" "}
              <Link href={`/annonces/${i.place.annonce.id}`}>{nomRaid(i.place.annonce.contenu)}</Link> —{" "}
              <strong>{afficherDate(i.place.annonce.debutUtc, fuseau)}</strong> avec{" "}
              {i.personnage && <ClasseIcone classe={i.personnage.classe} />} <strong>{i.personnage && nomEnJeu(i.personnage)}</strong>
              {i.role && (
                <>
                  {" "}
                  (<NomRole role={i.role} taille={18} />)
                </>
              )}
            </p>
          ))}
          {organises.map((a) => (
            <p key={a.id}>
              ★ <strong>Tu organises</strong> : <Link href={`/annonces/${a.id}`}>{nomRaid(a.contenu)}</Link> —{" "}
              {afficherDate(a.debutUtc, fuseau)}
              {a.statut === "COMPLETE" && " (complet)"}
            </p>
          ))}
          {candidatures.length > 0 && (
            <>
              <p className="doux">Candidatures en attente :</p>
              <ul>
                {candidatures.map((i) => (
                  <li key={i.id}>
                    <Link href={`/annonces/${i.place.annonce.id}`}>{nomRaid(i.place.annonce.contenu)}</Link> —{" "}
                    {afficherDate(i.place.annonce.debutUtc, fuseau)} avec{" "}
                    {i.personnage && <ClasseIcone classe={i.personnage.classe} />} {i.personnage && nomEnJeu(i.personnage)}
                    {i.statut === "LISTE_ATTENTE" && " (liste d'attente)"}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      <section className="parchemin" aria-labelledby="titre-raids">
        <p className="surtitre">Ce soir et les jours à venir</p>
        <h2 id="titre-raids">Raids qui recrutent</h2>
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
            const ouvertes = a.places.filter((p) => p.statut === "OUVERTE");
            const titulaires = a.places.flatMap((p) =>
              p.inscriptions.flatMap((i) => (i.role && i.personnage ? [{ classe: i.personnage.classe, role: i.role }] : [])),
            );
            const compo = compoActuelle(a.composition, titulaires);
            const roles = compoParRole(compo.lignes);
            const placeLibre = ouvertes.some((p) => p.classesAcceptees.length === NOMBRE_DE_CLASSES);
            const classesRecherchees = [
              ...new Set(
                ouvertes.filter((p) => p.classesAcceptees.length < NOMBRE_DE_CLASSES).flatMap((p) => p.classesAcceptees),
              ),
            ] as Classe[];
            return (
              <li key={a.id} className="ligne-raid" data-fond={raids[a.contenu].image}>
                <Link href={`/annonces/${a.id}${perso ? `?perso=${perso.id}` : ""}`} className="ligne-raid-lien" aria-label={`${nomRaid(a.contenu)}, ${afficherDate(a.debutUtc, fuseau)}`} />
                <div className="ligne-raid-infos">
                  <h3>{nomRaid(a.contenu)}</h3>
                  <span className="quand">{afficherDate(a.debutUtc, fuseau)}</span>
                  <span className="pastilles">
                    <PastilleFaction faction={a.faction} />
                    <PastilleRuleset ruleset={a.ruleset} region={a.region} />
                    {a.statut === "COMPLETE" ? (
                      <span className="pastille complet">Complet · liste d&apos;attente</span>
                    ) : (
                      <span className="pastille ouvert">
                        {ouvertes.length} place{ouvertes.length > 1 ? "s" : ""} ouverte{ouvertes.length > 1 ? "s" : ""}
                      </span>
                    )}
                  </span>
                  <small>
                    par {a.createur.pseudo} · {texteBadge(fiabilite.get(a.createurId)!)}
                  </small>
                </div>
                <div className="ligne-raid-droite">
                  {a.statut !== "COMPLETE" && (
                    <div className="recherche" aria-label="Classes recherchées">
                      {classesRecherchees.map((c) => (
                        <ClasseIcone key={c} classe={c} taille={40} />
                      ))}
                      {placeLibre && <span className="pastille">Toutes classes</span>}
                    </div>
                  )}
                  <div className="compo-roles" title="Tanks · Soigneurs · DPS">
                    <span aria-label={`${roles.tanks} tanks`}>
                      <RoleIcone role="TANK" taille={34} /> {roles.tanks}
                    </span>
                    <span aria-label={`${roles.soigneurs} soigneurs`}>
                      <RoleIcone role="SOIGNEUR" taille={34} /> {roles.soigneurs}
                    </span>
                    <span aria-label={`${roles.dps} DPS`}>
                      <RoleIcone role="DPS" taille={34} /> {roles.dps}
                    </span>
                    <strong>
                      {compo.total}/{a.taille}
                    </strong>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        )}
      </section>
    </main>
  );
}
