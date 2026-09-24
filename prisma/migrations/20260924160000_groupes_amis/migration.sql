-- AlterEnum
ALTER TYPE "TypeNotification" ADD VALUE 'CANDIDATURE_GROUPE';

-- AlterTable
ALTER TABLE "Inscription" ADD COLUMN     "escouadeId" TEXT;

-- CreateTable
CREATE TABLE "Escouade" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "chefId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "creeLe" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Escouade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MembreEscouade" (
    "id" TEXT NOT NULL,
    "escouadeId" TEXT NOT NULL,
    "utilisateurId" TEXT NOT NULL,
    "personnageId" TEXT NOT NULL,
    "roles" "Role"[],
    "rejointLe" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MembreEscouade_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Escouade_code_key" ON "Escouade"("code");

-- CreateIndex
CREATE INDEX "Escouade_chefId_idx" ON "Escouade"("chefId");

-- CreateIndex
CREATE INDEX "MembreEscouade_utilisateurId_idx" ON "MembreEscouade"("utilisateurId");

-- CreateIndex
CREATE UNIQUE INDEX "MembreEscouade_escouadeId_utilisateurId_key" ON "MembreEscouade"("escouadeId", "utilisateurId");

-- CreateIndex
CREATE INDEX "Inscription_escouadeId_idx" ON "Inscription"("escouadeId");

-- AddForeignKey
ALTER TABLE "Inscription" ADD CONSTRAINT "Inscription_escouadeId_fkey" FOREIGN KEY ("escouadeId") REFERENCES "Escouade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Escouade" ADD CONSTRAINT "Escouade_chefId_fkey" FOREIGN KEY ("chefId") REFERENCES "Utilisateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembreEscouade" ADD CONSTRAINT "MembreEscouade_escouadeId_fkey" FOREIGN KEY ("escouadeId") REFERENCES "Escouade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembreEscouade" ADD CONSTRAINT "MembreEscouade_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "Utilisateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembreEscouade" ADD CONSTRAINT "MembreEscouade_personnageId_fkey" FOREIGN KEY ("personnageId") REFERENCES "Personnage"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Nom du groupe : 24 caractères au plus.
ALTER TABLE "Escouade" ADD CONSTRAINT "Escouade_nom_longueur" CHECK (char_length("nom") BETWEEN 1 AND 24);
