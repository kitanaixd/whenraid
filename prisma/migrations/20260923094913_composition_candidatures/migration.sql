-- AlterTable
ALTER TABLE "Inscription" ADD COLUMN     "role" "Role";

-- AlterTable
ALTER TABLE "Place" ALTER COLUMN "role" DROP NOT NULL;

-- CreateTable
CREATE TABLE "CompositionAnnonce" (
    "id" TEXT NOT NULL,
    "annonceId" TEXT NOT NULL,
    "classe" "Classe" NOT NULL,
    "role" "Role" NOT NULL,
    "nombre" INTEGER NOT NULL,

    CONSTRAINT "CompositionAnnonce_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompositionAnnonce_annonceId_classe_role_key" ON "CompositionAnnonce"("annonceId", "classe", "role");

-- AddForeignKey
ALTER TABLE "CompositionAnnonce" ADD CONSTRAINT "CompositionAnnonce_annonceId_fkey" FOREIGN KEY ("annonceId") REFERENCES "Annonce"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Note du candidat : 80 caractères maximum.
ALTER TABLE "Inscription"
  ADD CONSTRAINT "Inscription_note_80_caracteres"
  CHECK (char_length("note") <= 80);

-- Une ligne de compo compte au moins un joueur.
ALTER TABLE "CompositionAnnonce"
  ADD CONSTRAINT "CompositionAnnonce_nombre_positif"
  CHECK ("nombre" > 0);
