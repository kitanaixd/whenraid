-- AlterEnum
ALTER TYPE "TypeNotification" ADD VALUE 'RETIRE_PAR_RL';

-- AlterTable
ALTER TABLE "Inscription" ADD COLUMN     "retireParRlLe" TIMESTAMPTZ(3);

