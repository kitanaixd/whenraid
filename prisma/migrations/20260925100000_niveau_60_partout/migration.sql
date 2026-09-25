-- WoW Forever : tous les personnages sont niveau 60, les raids n'ont plus de niveau minimum.
UPDATE "Personnage" SET "niveau" = 60 WHERE "niveau" <> 60;
UPDATE "Annonce" SET "niveauMin" = NULL WHERE "niveauMin" IS NOT NULL;
