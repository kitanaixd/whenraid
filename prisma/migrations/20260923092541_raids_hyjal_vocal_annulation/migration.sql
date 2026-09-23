-- CreateEnum
CREATE TYPE "Vocal" AS ENUM ('AUCUN', 'DISCORD', 'TEAMSPEAK');

-- AlterEnum
BEGIN;
CREATE TYPE "Contenu_new" AS ENUM ('MONT_HYJAL', 'ONYXIA');
ALTER TABLE "Annonce" ALTER COLUMN "contenu" TYPE "Contenu_new" USING ("contenu"::text::"Contenu_new");
ALTER TABLE "Alerte" ALTER COLUMN "contenus" TYPE "Contenu_new"[] USING ("contenus"::text::"Contenu_new"[]);
ALTER TYPE "Contenu" RENAME TO "Contenu_old";
ALTER TYPE "Contenu_new" RENAME TO "Contenu";
DROP TYPE "public"."Contenu_old";
COMMIT;

-- AlterTable
ALTER TABLE "Annonce" DROP COLUMN "vocalRequis",
ADD COLUMN     "annuleeComplete" BOOLEAN,
ADD COLUMN     "annuleeLe" TIMESTAMPTZ(3),
ADD COLUMN     "vocal" "Vocal" NOT NULL DEFAULT 'AUCUN',
ADD COLUMN     "vocalDiscordLien" TEXT,
ADD COLUMN     "vocalTsAdresse" TEXT,
ADD COLUMN     "vocalTsMotDePasse" TEXT;

