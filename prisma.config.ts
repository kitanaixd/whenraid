import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Même fichier de secrets que Next.js (jamais commité).
config({ path: ".env.local" });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Les migrations passent par la connexion directe (non poolée) de Neon ;
    // l'application, elle, utilise DATABASE_URL (poolée) dans lib/db.ts.
    url: process.env["DATABASE_URL_UNPOOLED"] ?? process.env["DATABASE_URL"],
  },
});
