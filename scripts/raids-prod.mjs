// Remet la prod à zéro côté raids, puis crée 50 raids de démonstration au nom de Kitanai.
//
//   Voir ce qui serait fait (rien n'est modifié) :
//     node --env-file=.env.prod.local scripts/raids-prod.mjs
//   Le faire vraiment :
//     node --env-file=.env.prod.local scripts/raids-prod.mjs --confirmer
//
// ⚠ Supprime TOUS les raids de la prod (y compris ceux des autres joueurs), avec leurs candidatures,
// présences (historique de fiabilité) et notifications. Les comptes, personnages et groupes restent.
// .env.prod.local (jamais envoyé sur GitHub) contient DATABASE_URL_PROD, l'adresse directe de la prod.
import pg from "pg";

const RL = "cmudugde8000010dxjvrnomwk"; // Kitanai
const NOMBRE = 50;
const RAIDS = [
  { contenu: "MONT_HYJAL_10", taille: 10, duree: 180 },
  { contenu: "MONT_HYJAL_20", taille: 20, duree: 180 },
  { contenu: "ONYXIA", taille: 40, duree: 120 },
];
const TOUTES = ["CHASSEUR", "DEMONISTE", "DRUIDE", "GUERRIER", "MAGE", "PALADIN", "PRETRE", "VOLEUR", "CHAMAN"];
const LOOTS = ["ROLL", "ROLL", "LOOT_COUNCIL", "DKP", "RESERVE"];
// Titres (20 caractères max), selon le raid.
const COMMUNS = ["Clean run chill", "Raid des copains", "Guilde + pugs", "Première tentative", "Soirée détente", "Full reroll"];
const TITRES = {
  MONT_HYJAL_10: ["Hyjal du jeudi", "Speedrun Hyjal", ...COMMUNS],
  MONT_HYJAL_20: ["Hyjal du jeudi", "Speedrun Hyjal", "Farm T2", ...COMMUNS],
  ONYXIA: ["Ony express", "Onyxia du dimanche", "Farm T2", ...COMMUNS],
};

const url = process.env.DATABASE_URL_PROD;
if (!url) throw new Error("DATABASE_URL_PROD absente : lance le script avec --env-file=.env.prod.local");
const hote = new URL(url).hostname;
if (!hote.startsWith("ep-blue-bird") || hote.includes("-pooler")) {
  throw new Error("Ce n'est pas la base de prod en connexion directe : rien n'est fait.");
}
const confirme = process.argv.includes("--confirmer");

// Tirage pseudo-aléatoire reproductible (mêmes raids à chaque lancement).
let graine = 42;
const hasard = () => ((graine = (graine * 1103515245 + 12345) % 2147483648) / 2147483648);
const choisir = (liste) => liste[Math.floor(hasard() * liste.length)];

/** Classes jouables pour un rôle, selon la faction (paladins côté Alliance, chamans côté Horde). */
function classesPour(role, faction) {
  const parRole = {
    TANK: ["GUERRIER", "DRUIDE", faction === "ALLIANCE" ? "PALADIN" : "CHAMAN"],
    SOIGNEUR: ["PRETRE", "DRUIDE", faction === "ALLIANCE" ? "PALADIN" : "CHAMAN"],
    DPS: ["MAGE", "VOLEUR", "DEMONISTE", "CHASSEUR", "GUERRIER", faction === "ALLIANCE" ? "PALADIN" : "CHAMAN"],
  };
  return parRole[role];
}

/** Un raid : 50 à 70 % de la compo déjà là (le RL en guerrier tank compris), le reste ouvert. */
function preparer(i, monde, r) {
  const remplis = Math.max(2, Math.round(r.taille * (0.5 + hasard() * 0.2)));
  // Répartition cible : ~10 % de tanks, ~25 % de soigneurs, le reste en DPS.
  const tanksVoulus = Math.max(1, Math.round(r.taille / 10));
  const soinsVoulus = Math.max(2, Math.round(r.taille / 4));
  const compo = new Map();
  const ajouter = (classe, role) => compo.set(`${classe}.${role}`, (compo.get(`${classe}.${role}`) ?? 0) + 1);
  ajouter("GUERRIER", "TANK"); // le RL
  let tanks = 1;
  let soins = 0;
  for (let n = 1; n < remplis; n++) {
    const role = tanks < tanksVoulus && hasard() < 0.5 ? "TANK" : soins < soinsVoulus && hasard() < 0.4 ? "SOIGNEUR" : "DPS";
    if (role === "TANK") tanks++;
    if (role === "SOIGNEUR") soins++;
    ajouter(choisir(classesPour(role, monde.faction)), role);
  }
  // Places ouvertes : d'abord les rôles qui manquent (tanks, soigneurs), puis 1 classe précise parfois,
  // le reste ouvert à tous.
  const ouvertes = r.taille - remplis;
  const places = [];
  for (let t = tanks; t < tanksVoulus && places.length < ouvertes; t++) places.push({ role: "TANK", classes: TOUTES });
  for (let s = soins; s < soinsVoulus && places.length < ouvertes; s++) places.push({ role: "SOIGNEUR", classes: TOUTES });
  if (places.length < ouvertes && hasard() < 0.5) {
    places.push({ role: null, classes: [choisir(classesPour("DPS", monde.faction))] });
  }
  while (places.length < ouvertes) places.push({ role: null, classes: TOUTES });

  // 50 raids sur 14 jours à partir du 26/09, entre 19:00 et 22:00 heure de Paris (UTC+2).
  const jour = 26 + Math.floor(i / 4);
  const heure = 17 + (i % 4); // 19:00, 20:00, 21:00, 22:00 à Paris
  const debut = new Date(Date.UTC(2026, 8, jour, heure, i % 2 === 0 ? 0 : 30));
  return {
    id: `demo_${String(i + 1).padStart(2, "0")}`,
    ...r,
    ...monde,
    debut,
    loot: choisir(LOOTS),
    titre: hasard() < 0.4 ? choisir(TITRES[r.contenu]) : null,
    compo,
    places,
    remplis,
  };
}

// Tous les mondes (faction × ruleset × région), chacun avec les 3 raids, dans un ordre mélangé.
const mondes = [];
for (const faction of ["ALLIANCE", "HORDE"]) {
  for (const ruleset of ["NORMAL", "PVP", "RP", "HARDCORE"]) {
    for (const region of ["EU", "US"]) mondes.push({ faction, ruleset, region });
  }
}
const combos = mondes.flatMap((m) => RAIDS.map((r) => [m, r]));
const tirage = [...combos].sort(() => hasard() - 0.5);
while (tirage.length < NOMBRE) tirage.push(choisir(combos));
const nouveaux = tirage.slice(0, NOMBRE).map(([m, r], i) => preparer(i, m, r));

const c = new pg.Client(url);
await c.connect();
try {
  const compter = async (sql) => (await c.query(sql)).rows[0].n;
  const raids = await compter(`select count(*)::int n from "Annonce"`);
  const autres = await compter(`select count(*)::int n from "Annonce" where "createurId" <> '${RL}'`);
  const inscriptions = await compter(`select count(*)::int n from "Inscription"`);
  const presences = await compter(`select count(*)::int n from "Participation"`);
  const notifications = await compter(`select count(*)::int n from "Notification" where "annonceId" is not null`);
  console.log(`À supprimer : ${raids} raids (dont ${autres} d'autres joueurs), ${inscriptions} candidatures,`);
  console.log(`              ${presences} présences (historique de fiabilité), ${notifications} notifications de raid.`);
  console.log(`À créer : ${nouveaux.length} raids au nom de Kitanai :`);
  for (const r of nouveaux) {
    console.log(
      `  ${r.id}  ${r.contenu.padEnd(13)} ${r.faction.padEnd(8)} ${r.ruleset.padEnd(8)} ${r.region}  ` +
        `${r.debut.toISOString().slice(0, 16)}  ${String(r.remplis).padStart(2)}/${r.taille}  ${r.titre ?? ""}`,
    );
  }
  if (!confirme) {
    console.log("\nRien n'a été modifié. Relance avec --confirmer pour le faire vraiment.");
  } else {
    await c.query("begin");
    try {
      await c.query(`delete from "Notification" where "annonceId" is not null`);
      await c.query(`delete from "Participation"`);
      await c.query(`delete from "Inscription"`);
      await c.query(`delete from "Place"`);
      await c.query(`delete from "CompositionAnnonce"`);
      await c.query(`delete from "Annonce"`);
      for (const r of nouveaux) {
        await c.query(
          `insert into "Annonce"(id,"createurId",taille,"debutUtc","dureeEstimee","reglesLoot",faction,region,ruleset,contenu,statut,"publieeLe",titre,vocal)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'PUBLIEE',now(),$11,'AUCUN')`,
          [r.id, RL, r.taille, r.debut, r.duree, r.loot, r.faction, r.region, r.ruleset, r.contenu, r.titre],
        );
        let n = 0;
        for (const [cle, nombre] of r.compo) {
          const [classe, role] = cle.split(".");
          await c.query(`insert into "CompositionAnnonce"(id,"annonceId",classe,role,nombre) values ($1,$2,$3,$4,$5)`, [
            `${r.id}_c${++n}`,
            r.id,
            classe,
            role,
            nombre,
          ]);
        }
        for (const [p, place] of r.places.entries()) {
          await c.query(`insert into "Place"(id,"annonceId",role,"classesAcceptees") values ($1,$2,$3,$4)`, [
            `${r.id}_p${p + 1}`,
            r.id,
            place.role,
            place.classes,
          ]);
        }
      }
      await c.query("commit");
      console.log(`\nFait : ${raids} raids supprimés, ${nouveaux.length} raids créés.`);
    } catch (e) {
      await c.query("rollback");
      throw e;
    }
  }
} finally {
  await c.end();
}
