-- CreateTable
CREATE TABLE "MobileAuthCode" (
    "id" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "challenge" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MobileAuthCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MobileAuthCode_codeHash_key" ON "MobileAuthCode"("codeHash");

-- CreateIndex
CREATE INDEX "MobileAuthCode_expiresAt_idx" ON "MobileAuthCode"("expiresAt");

