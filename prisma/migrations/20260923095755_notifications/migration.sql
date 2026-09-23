-- CreateEnum
CREATE TYPE "TypeNotification" AS ENUM ('CANDIDATURE_ACCEPTEE', 'CANDIDATURE_REFUSEE', 'RAID_COMPLET', 'RAID_ANNULE', 'NOUVELLE_CANDIDATURE');

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "utilisateurId" TEXT NOT NULL,
    "type" "TypeNotification" NOT NULL,
    "annonceId" TEXT,
    "lue" BOOLEAN NOT NULL DEFAULT false,
    "creeLe" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_utilisateurId_lue_creeLe_idx" ON "Notification"("utilisateurId", "lue", "creeLe");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "Utilisateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_annonceId_fkey" FOREIGN KEY ("annonceId") REFERENCES "Annonce"("id") ON DELETE CASCADE ON UPDATE CASCADE;

