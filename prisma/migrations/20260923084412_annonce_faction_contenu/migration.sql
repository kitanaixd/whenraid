/*
  Warnings:

  - The `contenus` column on the `Alerte` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Added the required column `faction` to the `Annonce` table without a default value. This is not possible if the table is not empty.
  - Added the required column `region` to the `Annonce` table without a default value. This is not possible if the table is not empty.
  - Added the required column `ruleset` to the `Annonce` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `contenu` on the `Annonce` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "Contenu" AS ENUM ('MOLTEN_CORE', 'ONYXIA', 'ZUL_GURUB', 'BLACKWING_LAIR', 'AQ20', 'AQ40', 'NAXXRAMAS');

-- AlterTable
ALTER TABLE "Alerte" DROP COLUMN "contenus",
ADD COLUMN     "contenus" "Contenu"[];

-- AlterTable
ALTER TABLE "Annonce" ADD COLUMN     "faction" "Faction" NOT NULL,
ADD COLUMN     "region" "Region" NOT NULL,
ADD COLUMN     "ruleset" "Ruleset" NOT NULL,
DROP COLUMN "contenu",
ADD COLUMN     "contenu" "Contenu" NOT NULL;
