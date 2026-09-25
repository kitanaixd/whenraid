-- Rôles jouables : on retire ceux que la classe ne peut pas jouer (ex. chasseur tank).
UPDATE "Personnage" SET "rolesJouables" = array_remove(array_remove("rolesJouables", 'TANK'), 'SOIGNEUR')
WHERE "classe" IN ('CHASSEUR', 'VOLEUR', 'MAGE', 'DEMONISTE');
UPDATE "Personnage" SET "rolesJouables" = array_remove("rolesJouables", 'TANK')
WHERE "classe" = 'PRETRE';
-- Personnage qui n'a plus aucun rôle : il garde le rôle principal de sa classe.
UPDATE "Personnage" SET "rolesJouables" = ARRAY['SOIGNEUR']::"Role"[]
WHERE cardinality("rolesJouables") = 0 AND "classe" = 'PRETRE';
UPDATE "Personnage" SET "rolesJouables" = ARRAY['DPS']::"Role"[]
WHERE cardinality("rolesJouables") = 0;
