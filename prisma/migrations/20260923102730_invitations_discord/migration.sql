-- AlterTable
ALTER TABLE "Annonce" ADD COLUMN     "invitationsEnvoyeesLe" TIMESTAMPTZ(3),
ADD COLUMN     "organisateurPersonnageId" TEXT,
ADD COLUMN     "rappelRlEnvoyeLe" TIMESTAMPTZ(3);

-- AddForeignKey
ALTER TABLE "Annonce" ADD CONSTRAINT "Annonce_organisateurPersonnageId_fkey" FOREIGN KEY ("organisateurPersonnageId") REFERENCES "Personnage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

