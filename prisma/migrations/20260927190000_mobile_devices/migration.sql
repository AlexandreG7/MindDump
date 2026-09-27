-- CreateTable
CREATE TABLE "MobileDevice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MobileDevice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MobileDevice_userId_idx" ON "MobileDevice"("userId");

