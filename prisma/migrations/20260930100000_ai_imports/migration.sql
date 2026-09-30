-- CreateTable
CREATE TABLE "AiImport" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "AiImport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiImport_userId_createdAt_idx" ON "AiImport"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "AiImport" ADD CONSTRAINT "AiImport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
