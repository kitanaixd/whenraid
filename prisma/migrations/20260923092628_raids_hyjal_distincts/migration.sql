-- AlterEnum
BEGIN;
CREATE TYPE "Contenu_new" AS ENUM ('MONT_HYJAL_10', 'MONT_HYJAL_20', 'ONYXIA');
ALTER TABLE "Annonce" ALTER COLUMN "contenu" TYPE "Contenu_new" USING ("contenu"::text::"Contenu_new");
ALTER TABLE "Alerte" ALTER COLUMN "contenus" TYPE "Contenu_new"[] USING ("contenus"::text::"Contenu_new"[]);
ALTER TYPE "Contenu" RENAME TO "Contenu_old";
ALTER TYPE "Contenu_new" RENAME TO "Contenu";
DROP TYPE "public"."Contenu_old";
COMMIT;

