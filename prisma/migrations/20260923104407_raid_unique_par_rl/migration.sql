-- Un RL ne peut pas avoir deux raids actifs identiques (même raid, même heure).
-- Protège contre le double envoi du formulaire de création.
CREATE UNIQUE INDEX "Annonce_un_raid_actif_identique_par_rl"
  ON "Annonce" ("createurId", "contenu", "debutUtc")
  WHERE "statut" IN ('BROUILLON', 'PUBLIEE', 'COMPLETE');
