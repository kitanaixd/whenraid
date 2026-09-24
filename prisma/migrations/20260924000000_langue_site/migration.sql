-- CreateEnum
CREATE TYPE "Langue" AS ENUM ('en', 'fr');

-- AlterTable
ALTER TABLE "Utilisateur" ADD COLUMN     "langueSite" "Langue" NOT NULL DEFAULT 'en';


-- Les comptes existants sont ceux des premiers joueurs, francophones.
UPDATE "Utilisateur" SET "langueSite" = 'fr';
