-- CreateTable
CREATE TABLE "WallDevice" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3),
    "groupId" TEXT NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "WallDevice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WallDevice_tokenHash_key" ON "WallDevice"("tokenHash");

-- CreateIndex
CREATE INDEX "WallDevice_groupId_idx" ON "WallDevice"("groupId");

-- AddForeignKey
ALTER TABLE "WallDevice" ADD CONSTRAINT "WallDevice_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WallDevice" ADD CONSTRAINT "WallDevice_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

