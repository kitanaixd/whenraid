-- CreateEnum
CREATE TYPE "Classe" AS ENUM ('GUERRIER', 'PALADIN', 'CHASSEUR', 'VOLEUR', 'PRETRE', 'CHAMAN', 'MAGE', 'DEMONISTE', 'DRUIDE');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('TANK', 'SOIGNEUR', 'DPS_MELEE', 'DPS_DISTANCE');

-- CreateEnum
CREATE TYPE "Faction" AS ENUM ('ALLIANCE', 'HORDE');

-- CreateEnum
CREATE TYPE "Ruleset" AS ENUM ('NORMAL', 'PVP', 'HARDCORE');

-- CreateEnum
CREATE TYPE "Region" AS ENUM ('EU', 'US');

-- CreateEnum
CREATE TYPE "ReglesLoot" AS ENUM ('ROLL', 'LOOT_COUNCIL', 'DKP', 'RESERVE');

-- CreateEnum
CREATE TYPE "StatutAnnonce" AS ENUM ('BROUILLON', 'PUBLIEE', 'COMPLETE', 'ANNULEE', 'PASSEE', 'CLOTUREE');

-- CreateEnum
CREATE TYPE "StatutPlace" AS ENUM ('OUVERTE', 'POURVUE', 'ANNULEE');

-- CreateEnum
CREATE TYPE "StatutInscription" AS ENUM ('INSCRIT', 'LISTE_ATTENTE', 'CONFIRME', 'RETIRE', 'REFUSE');

-- CreateEnum
CREATE TYPE "ResultatParticipation" AS ENUM ('PRESENT', 'ABSENT', 'PARTI_EN_COURS', 'ANNULE_A_TEMPS');

-- CreateEnum
CREATE TYPE "SourceParticipation" AS ENUM ('VALIDATION_MANUELLE', 'ADDON');

-- CreateTable
CREATE TABLE "Utilisateur" (
    "id" TEXT NOT NULL,
    "discordId" TEXT NOT NULL,
    "pseudo" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "langues" TEXT[] DEFAULT ARRAY['fr']::TEXT[],
    "fuseauHoraire" TEXT NOT NULL DEFAULT 'Europe/Paris',
    "region" "Region",
    "creeLe" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Utilisateur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Personnage" (
    "id" TEXT NOT NULL,
    "utilisateurId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "nomDeFamille" TEXT,
    "classe" "Classe" NOT NULL,
    "spePrincipale" TEXT,
    "rolesJouables" "Role"[],
    "faction" "Faction" NOT NULL,
    "ruleset" "Ruleset" NOT NULL,
    "region" "Region" NOT NULL,
    "niveau" INTEGER NOT NULL,
    "estPrincipal" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Personnage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Groupe" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "proprietaireId" TEXT NOT NULL,
    "description" TEXT,
    "langue" TEXT NOT NULL DEFAULT 'fr',
    "vocalRequis" BOOLEAN NOT NULL DEFAULT false,
    "lienVocal" TEXT,
    "ruleset" "Ruleset" NOT NULL,
    "faction" "Faction" NOT NULL,

    CONSTRAINT "Groupe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupeComposition" (
    "id" TEXT NOT NULL,
    "groupeId" TEXT NOT NULL,
    "classe" "Classe" NOT NULL,
    "role" "Role" NOT NULL,
    "nombre" INTEGER NOT NULL,

    CONSTRAINT "GroupeComposition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Annonce" (
    "id" TEXT NOT NULL,
    "groupeId" TEXT,
    "createurId" TEXT NOT NULL,
    "contenu" TEXT NOT NULL,
    "taille" INTEGER NOT NULL,
    "debutUtc" TIMESTAMPTZ(3) NOT NULL,
    "dureeEstimee" INTEGER,
    "reglesLoot" "ReglesLoot" NOT NULL,
    "prerequis" TEXT,
    "langueRequise" TEXT,
    "vocalRequis" BOOLEAN NOT NULL DEFAULT false,
    "niveauMin" INTEGER,
    "statut" "StatutAnnonce" NOT NULL DEFAULT 'BROUILLON',
    "publieeLe" TIMESTAMPTZ(3),

    CONSTRAINT "Annonce_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Place" (
    "id" TEXT NOT NULL,
    "annonceId" TEXT NOT NULL,
    "classesAcceptees" "Classe"[],
    "role" "Role" NOT NULL,
    "statut" "StatutPlace" NOT NULL DEFAULT 'OUVERTE',

    CONSTRAINT "Place_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inscription" (
    "id" TEXT NOT NULL,
    "placeId" TEXT NOT NULL,
    "personnageId" TEXT,
    "groupeId" TEXT,
    "utilisateurId" TEXT NOT NULL,
    "statut" "StatutInscription" NOT NULL DEFAULT 'INSCRIT',
    "note" TEXT,
    "inscritLe" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Inscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alerte" (
    "id" TEXT NOT NULL,
    "utilisateurId" TEXT NOT NULL,
    "classes" "Classe"[],
    "roles" "Role"[],
    "contenus" TEXT[],
    "joursSemaine" INTEGER[],
    "plageHoraire" TEXT,
    "langue" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Alerte_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Participation" (
    "id" TEXT NOT NULL,
    "annonceId" TEXT NOT NULL,
    "personnageId" TEXT NOT NULL,
    "utilisateurId" TEXT,
    "resultat" "ResultatParticipation" NOT NULL,
    "source" "SourceParticipation" NOT NULL,
    "anonymise" BOOLEAN NOT NULL DEFAULT false,
    "enregistreLe" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Participation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Utilisateur_discordId_key" ON "Utilisateur"("discordId");

-- CreateIndex
CREATE INDEX "Personnage_utilisateurId_idx" ON "Personnage"("utilisateurId");

-- CreateIndex
CREATE INDEX "Groupe_proprietaireId_idx" ON "Groupe"("proprietaireId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupeComposition_groupeId_classe_role_key" ON "GroupeComposition"("groupeId", "classe", "role");

-- CreateIndex
CREATE INDEX "Annonce_statut_debutUtc_idx" ON "Annonce"("statut", "debutUtc");

-- CreateIndex
CREATE INDEX "Annonce_createurId_idx" ON "Annonce"("createurId");

-- CreateIndex
CREATE INDEX "Place_annonceId_idx" ON "Place"("annonceId");

-- CreateIndex
CREATE INDEX "Inscription_utilisateurId_idx" ON "Inscription"("utilisateurId");

-- CreateIndex
CREATE UNIQUE INDEX "Inscription_placeId_personnageId_key" ON "Inscription"("placeId", "personnageId");

-- CreateIndex
CREATE UNIQUE INDEX "Inscription_placeId_groupeId_key" ON "Inscription"("placeId", "groupeId");

-- CreateIndex
CREATE INDEX "Alerte_utilisateurId_idx" ON "Alerte"("utilisateurId");

-- CreateIndex
CREATE INDEX "Participation_personnageId_idx" ON "Participation"("personnageId");

-- CreateIndex
CREATE INDEX "Participation_utilisateurId_idx" ON "Participation"("utilisateurId");

-- CreateIndex
CREATE UNIQUE INDEX "Participation_annonceId_personnageId_key" ON "Participation"("annonceId", "personnageId");

-- AddForeignKey
ALTER TABLE "Personnage" ADD CONSTRAINT "Personnage_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Groupe" ADD CONSTRAINT "Groupe_proprietaireId_fkey" FOREIGN KEY ("proprietaireId") REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupeComposition" ADD CONSTRAINT "GroupeComposition_groupeId_fkey" FOREIGN KEY ("groupeId") REFERENCES "Groupe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Annonce" ADD CONSTRAINT "Annonce_groupeId_fkey" FOREIGN KEY ("groupeId") REFERENCES "Groupe"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Annonce" ADD CONSTRAINT "Annonce_createurId_fkey" FOREIGN KEY ("createurId") REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Place" ADD CONSTRAINT "Place_annonceId_fkey" FOREIGN KEY ("annonceId") REFERENCES "Annonce"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inscription" ADD CONSTRAINT "Inscription_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inscription" ADD CONSTRAINT "Inscription_personnageId_fkey" FOREIGN KEY ("personnageId") REFERENCES "Personnage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inscription" ADD CONSTRAINT "Inscription_groupeId_fkey" FOREIGN KEY ("groupeId") REFERENCES "Groupe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inscription" ADD CONSTRAINT "Inscription_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "Utilisateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alerte" ADD CONSTRAINT "Alerte_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "Utilisateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Participation" ADD CONSTRAINT "Participation_annonceId_fkey" FOREIGN KEY ("annonceId") REFERENCES "Annonce"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Participation" ADD CONSTRAINT "Participation_personnageId_fkey" FOREIGN KEY ("personnageId") REFERENCES "Personnage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Participation" ADD CONSTRAINT "Participation_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "Utilisateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── Contraintes écrites à la main (Prisma ne sait pas les exprimer) ─────────

-- Règle 1 : une Inscription porte exactement un personnage OU un groupe.
ALTER TABLE "Inscription"
  ADD CONSTRAINT "Inscription_personnage_xor_groupe"
  CHECK (num_nonnulls("personnageId", "groupeId") = 1);

-- Au plus un personnage principal par utilisateur.
CREATE UNIQUE INDEX "Personnage_un_principal_par_utilisateur"
  ON "Personnage" ("utilisateurId")
  WHERE "estPrincipal";
