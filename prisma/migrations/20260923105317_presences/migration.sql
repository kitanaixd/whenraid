-- AlterEnum
ALTER TYPE "TypeNotification" ADD VALUE 'VALIDER_PRESENCES';

-- AlterTable
ALTER TABLE "Annonce" ADD COLUMN     "presencesValideesLe" TIMESTAMPTZ(3),
ADD COLUMN     "rappelFinEnvoyeLe" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "Participation" ADD COLUMN     "distinction" BOOLEAN NOT NULL DEFAULT false;

