-- AlterTable
ALTER TABLE "Annonce" ADD COLUMN     "titre" TEXT;


-- Titre donné par le RL : 20 caractères au plus.
ALTER TABLE "Annonce" ADD CONSTRAINT "Annonce_titre_longueur" CHECK (char_length("titre") <= 20);
