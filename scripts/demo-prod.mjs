// Raids de démonstration en production, pour que les joueurs puissent tester les candidatures.
//
//   Ajouter :   node --env-file=.env.prod.local scripts/demo-prod.mjs ajouter
//   Supprimer : node --env-file=.env.prod.local scripts/demo-prod.mjs supprimer
//
// .env.prod.local (jamais envoyé sur GitHub) contient DATABASE_URL_PROD, l'adresse directe
// (sans « -pooler ») de la branche main de Neon. Tous les identifiants créés commencent par « demo_ ».
import pg from "pg";

const RL = "cmudugde8000010dxjvrnomwk"; // Kitanai
const CLASSES = ["GUERRIER", "PALADIN", "CHASSEUR", "VOLEUR", "PRETRE", "CHAMAN", "MAGE", "DEMONISTE", "DRUIDE"];
const RAIDS = [
  { contenu: "BARROW_DEEPS_10", taille: 10, duree: 120 },
  { contenu: "MONT_HYJAL_20", taille: 20, duree: 180 },
  { contenu: "ONYXIA", taille: 40, duree: 90 },
];

const url = process.env.DATABASE_URL_PROD;
if (!url) throw new Error("DATABASE_URL_PROD absente : lance le script avec --env-file=.env.prod.local");
const hote = new URL(url).hostname;
if (!hote.startsWith("ep-blue-bird") || hote.includes("-pooler")) {
  throw new Error("Ce n'est pas la base de prod en connexion directe : rien n'est fait.");
}

const mode = process.argv[2];
const c = new pg.Client(url);
await c.connect();
try {
  if (mode === "ajouter") await ajouter();
  else if (mode === "supprimer") await supprimer();
  else console.log("Indique « ajouter » ou « supprimer ».");
} finally {
  await c.end();
}

async function ajouter() {
  const deja = (await c.query(`select count(*)::int n from "Annonce" where id like 'demo_%'`)).rows[0].n;
  if (deja > 0) throw new Error(`Il y a déjà ${deja} raids de démo en prod : rien n'est ajouté.`);
  const swallow = (
    await c.query(`select id from "Personnage" where "utilisateurId"=$1 and nom='Swallow' and "supprimeLe" is null`, [RL])
  ).rows[0]?.id;

  // 12 combinaisons : raid × faction × ruleset, mélangées pour varier les jours.
  const combos = [];
  for (const r of RAIDS) for (const faction of ["ALLIANCE", "HORDE"]) for (const ruleset of ["NORMAL", "PVP"]) {
    combos.push({ ...r, faction, ruleset });
  }
  const ordre = [0, 7, 2, 9, 4, 11, 1, 6, 3, 8, 5, 10];

  await c.query("begin");
  try {
    for (let i = 0; i < 12; i++) {
      const r = combos[ordre[i]];
      // 2 raids par jour du 24 au 29/09, à 20:00 et 21:30 heure de Paris (UTC+2).
      const debut = new Date(Date.UTC(2026, 8, 24 + Math.floor(i / 2), i % 2 === 0 ? 18 : 19, i % 2 === 0 ? 0 : 30));
      const id = `demo_${String(i + 1).padStart(2, "0")}`;
      const avecSwallow = swallow && r.faction === "ALLIANCE" && r.ruleset === "NORMAL";
      await c.query(
        `insert into "Annonce"(id,"createurId",taille,"debutUtc","dureeEstimee","reglesLoot",faction,region,ruleset,contenu,statut,"organisateurPersonnageId")
         values ($1,$2,$3,$4,$5,'ROLL',$6,'EU',$7,$8,'PUBLIEE',$9)`,
        [id, RL, r.taille, debut, r.duree, r.faction, r.ruleset, r.contenu, avecSwallow ? swallow : null],
      );
      // Le RL compte dans la compo (1 guerrier tank) ; toutes les autres places sont ouvertes à tous.
      await c.query(`insert into "CompositionAnnonce"(id,"annonceId",classe,role,nombre) values ($1,$2,'GUERRIER','TANK',1)`, [
        `${id}_c`,
        id,
      ]);
      for (let p = 1; p < r.taille; p++) {
        await c.query(`insert into "Place"(id,"annonceId",role,"classesAcceptees") values ($1,$2,null,$3)`, [
          `${id}_p${p}`,
          id,
          CLASSES,
        ]);
      }
      console.log(`${id}  ${r.contenu.padEnd(13)} ${r.faction.padEnd(8)} ${r.ruleset.padEnd(6)} ${debut.toISOString()}`);
    }
    await c.query("commit");
  } catch (e) {
    await c.query("rollback");
    throw e;
  }
  console.log("12 raids de démo ajoutés.");
}

async function supprimer() {
  const participations = (await c.query(`select count(*)::int n from "Participation" where "annonceId" like 'demo_%'`)).rows[0].n;
  if (participations > 0) {
    throw new Error(`${participations} présences sont déjà enregistrées sur des raids de démo : annule-les depuis le site plutôt.`);
  }
  await c.query("begin");
  try {
    const n = (sql) => c.query(sql).then((r) => r.rowCount);
    const notifs = await n(`delete from "Notification" where "annonceId" like 'demo_%'`);
    const inscriptions = await n(`delete from "Inscription" where "placeId" like 'demo_%'`);
    await n(`delete from "Place" where "annonceId" like 'demo_%'`);
    await n(`delete from "CompositionAnnonce" where "annonceId" like 'demo_%'`);
    const raids = await n(`delete from "Annonce" where id like 'demo_%'`);
    await c.query("commit");
    console.log(`Supprimé : ${raids} raids, ${inscriptions} candidatures, ${notifs} notifications.`);
  } catch (e) {
    await c.query("rollback");
    throw e;
  }
}
