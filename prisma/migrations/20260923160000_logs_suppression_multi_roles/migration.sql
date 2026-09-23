-- AlterTable
ALTER TABLE "Inscription" ADD COLUMN     "rolesProposes" "Role"[] DEFAULT ARRAY[]::"Role"[];

-- AlterTable
ALTER TABLE "Personnage" ADD COLUMN     "lienLogs" TEXT,
ADD COLUMN     "supprimeLe" TIMESTAMPTZ(3);


-- Les candidatures existantes proposaient un seul rôle.
UPDATE "Inscription" SET "rolesProposes" = ARRAY["role"] WHERE "role" IS NOT NULL;
