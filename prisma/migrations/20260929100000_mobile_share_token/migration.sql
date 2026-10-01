-- AlterTable
ALTER TABLE "MobileDevice" ADD COLUMN     "shareTokenHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "MobileDevice_shareTokenHash_key" ON "MobileDevice"("shareTokenHash");

