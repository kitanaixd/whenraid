-- Fusion des rôles DPS_MELEE et DPS_DISTANCE en un seul rôle DPS, sans perte de données.

CREATE TYPE "Role_new" AS ENUM ('TANK', 'SOIGNEUR', 'DPS');

-- 1. Compositions : une même classe peut avoir une ligne CàC et une ligne distance.
--    On additionne les nombres dans une seule ligne, puis on supprime l'autre.
CREATE TEMP TABLE fusion_compo AS
  SELECT "annonceId", classe, SUM(nombre) AS total, MIN(id) AS garde
  FROM "CompositionAnnonce"
  WHERE role IN ('DPS_MELEE', 'DPS_DISTANCE')
  GROUP BY "annonceId", classe;
UPDATE "CompositionAnnonce" c SET nombre = f.total FROM fusion_compo f WHERE c.id = f.garde;
DELETE FROM "CompositionAnnonce" c USING fusion_compo f
  WHERE c."annonceId" = f."annonceId" AND c.classe = f.classe
    AND c.role IN ('DPS_MELEE', 'DPS_DISTANCE') AND c.id <> f.garde;
DROP TABLE fusion_compo;

CREATE TEMP TABLE fusion_groupe AS
  SELECT "groupeId", classe, SUM(nombre) AS total, MIN(id) AS garde
  FROM "GroupeComposition"
  WHERE role IN ('DPS_MELEE', 'DPS_DISTANCE')
  GROUP BY "groupeId", classe;
UPDATE "GroupeComposition" g SET nombre = f.total FROM fusion_groupe f WHERE g.id = f.garde;
DELETE FROM "GroupeComposition" g USING fusion_groupe f
  WHERE g."groupeId" = f."groupeId" AND g.classe = f.classe
    AND g.role IN ('DPS_MELEE', 'DPS_DISTANCE') AND g.id <> f.garde;
DROP TABLE fusion_groupe;

-- 2. Colonnes simples : conversion directe.
ALTER TABLE "CompositionAnnonce" ALTER COLUMN "role" TYPE "Role_new"
  USING (CASE WHEN "role"::text IN ('DPS_MELEE', 'DPS_DISTANCE') THEN 'DPS' ELSE "role"::text END)::"Role_new";
ALTER TABLE "GroupeComposition" ALTER COLUMN "role" TYPE "Role_new"
  USING (CASE WHEN "role"::text IN ('DPS_MELEE', 'DPS_DISTANCE') THEN 'DPS' ELSE "role"::text END)::"Role_new";
ALTER TABLE "Place" ALTER COLUMN "role" TYPE "Role_new"
  USING (CASE WHEN "role"::text IN ('DPS_MELEE', 'DPS_DISTANCE') THEN 'DPS' ELSE "role"::text END)::"Role_new";
ALTER TABLE "Inscription" ALTER COLUMN "role" TYPE "Role_new"
  USING (CASE WHEN "role"::text IN ('DPS_MELEE', 'DPS_DISTANCE') THEN 'DPS' ELSE "role"::text END)::"Role_new";

-- 3. Listes de rôles : passage par du texte, remplacement sans doublon, retour à l'énumération.
ALTER TABLE "Personnage" ALTER COLUMN "rolesJouables" TYPE text[] USING "rolesJouables"::text[];
UPDATE "Personnage" SET "rolesJouables" = ARRAY(
  SELECT r FROM unnest(ARRAY['TANK', 'SOIGNEUR', 'DPS']) AS r
  WHERE r = ANY (array_replace(array_replace("rolesJouables", 'DPS_MELEE', 'DPS'), 'DPS_DISTANCE', 'DPS'))
);
ALTER TABLE "Personnage" ALTER COLUMN "rolesJouables" TYPE "Role_new"[] USING "rolesJouables"::"Role_new"[];

ALTER TABLE "Alerte" ALTER COLUMN "roles" TYPE text[] USING "roles"::text[];
UPDATE "Alerte" SET "roles" = ARRAY(
  SELECT r FROM unnest(ARRAY['TANK', 'SOIGNEUR', 'DPS']) AS r
  WHERE r = ANY (array_replace(array_replace("roles", 'DPS_MELEE', 'DPS'), 'DPS_DISTANCE', 'DPS'))
);
ALTER TABLE "Alerte" ALTER COLUMN "roles" TYPE "Role_new"[] USING "roles"::"Role_new"[];

-- 4. L'ancienne énumération disparaît.
DROP TYPE "Role";
ALTER TYPE "Role_new" RENAME TO "Role";
