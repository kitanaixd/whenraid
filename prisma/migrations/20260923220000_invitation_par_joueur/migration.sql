-- AlterTable
ALTER TABLE "Inscription" ADD COLUMN     "invitationEnvoyeeLe" TIMESTAMPTZ(3);


-- Raids dont les invitations sont déjà parties : les joueurs confirmés les ont reçues.
UPDATE "Inscription" i
SET "invitationEnvoyeeLe" = a."invitationsEnvoyeesLe"
FROM "Place" p
JOIN "Annonce" a ON a.id = p."annonceId"
WHERE i."placeId" = p.id
  AND i.statut = 'CONFIRME'
  AND a."invitationsEnvoyeesLe" IS NOT NULL;
