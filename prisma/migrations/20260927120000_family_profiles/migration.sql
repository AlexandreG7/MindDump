-- DropIndex
-- Index seulement, aucune donnée : un parent saisit désormais le semainier de
-- plusieurs enfants le même jour, l'unicité passe à (profileId, date).
DROP INDEX "KidDayEntry_userId_date_key";

-- AlterTable
ALTER TABLE "KidDayEntry" ADD COLUMN     "profileId" TEXT;

-- CreateTable
CREATE TABLE "FamilyProfile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'adult',
    "color" TEXT NOT NULL DEFAULT '#3b82f6',
    "emoji" TEXT,
    "birthDate" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT,

    CONSTRAINT "FamilyProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FamilyProfile_groupId_idx" ON "FamilyProfile"("groupId");

-- CreateIndex
CREATE INDEX "FamilyProfile_userId_idx" ON "FamilyProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyProfile_groupId_userId_key" ON "FamilyProfile"("groupId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "KidDayEntry_profileId_date_key" ON "KidDayEntry"("profileId", "date");

-- AddForeignKey
ALTER TABLE "KidDayEntry" ADD CONSTRAINT "KidDayEntry_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "FamilyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyProfile" ADD CONSTRAINT "FamilyProfile_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyProfile" ADD CONSTRAINT "FamilyProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

