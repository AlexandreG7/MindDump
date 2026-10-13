-- AlterTable
ALTER TABLE "KidDayEntry" ADD COLUMN     "values" JSONB;

-- CreateTable
CREATE TABLE "KidTracker" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "needsRename" BOOLEAN NOT NULL DEFAULT false,
    "legacyKey" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KidTracker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KidTrackerOption" (
    "id" TEXT NOT NULL,
    "trackerId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "legacyValue" TEXT,

    CONSTRAINT "KidTrackerOption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KidTracker_profileId_position_idx" ON "KidTracker"("profileId", "position");

-- CreateIndex
CREATE INDEX "KidTracker_createdById_idx" ON "KidTracker"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "KidTracker_profileId_legacyKey_key" ON "KidTracker"("profileId", "legacyKey");

-- CreateIndex
CREATE INDEX "KidTrackerOption_trackerId_position_idx" ON "KidTrackerOption"("trackerId", "position");

-- AddForeignKey
ALTER TABLE "KidTracker" ADD CONSTRAINT "KidTracker_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "FamilyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KidTracker" ADD CONSTRAINT "KidTracker_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KidTrackerOption" ADD CONSTRAINT "KidTrackerOption_trackerId_fkey" FOREIGN KEY ("trackerId") REFERENCES "KidTracker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

