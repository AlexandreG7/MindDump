-- Invitation de foyer qui ouvre aussi le droit de créer UN compte : horodatage de la réclamation.
-- Purement additif : une colonne nullable, aucune donnée existante touchée.
-- AlterTable
ALTER TABLE "GroupInvite" ADD COLUMN     "signupClaimedAt" TIMESTAMP(3);
