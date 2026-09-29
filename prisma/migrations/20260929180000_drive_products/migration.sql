-- CreateTable
CREATE TABLE "DriveProduct" (
    "id" TEXT NOT NULL,
    "store" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "ean" TEXT,
    "label" TEXT NOT NULL,
    "brand" TEXT,
    "packaging" TEXT,
    "image" TEXT,
    "price" DOUBLE PRECISION,
    "unitPrice" DOUBLE PRECISION,
    "unitLabel" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "useCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "groupId" TEXT NOT NULL,

    CONSTRAINT "DriveProduct_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DriveProduct_groupId_idx" ON "DriveProduct"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "DriveProduct_groupId_store_key_key" ON "DriveProduct"("groupId", "store", "key");

-- AddForeignKey
ALTER TABLE "DriveProduct" ADD CONSTRAINT "DriveProduct_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

