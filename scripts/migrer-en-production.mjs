// Lancé par `npm run build`. Sur Vercel, en production uniquement, applique les
// migrations Prisma en attente avant de construire le site : le code et la base
// changent ensemble. Si une migration échoue, le build s'arrête et l'ancienne
// version reste en ligne. En local et en prévisualisation, on ne touche à rien.
import { execSync } from "node:child_process";

if (process.env.VERCEL_ENV === "production") {
  console.log("[migrations] Production : application des migrations en attente…");
  execSync("npx prisma migrate deploy", { stdio: "inherit" });
} else {
  console.log(`[migrations] Ignorées (environnement : ${process.env.VERCEL_ENV ?? "local"}).`);
}
