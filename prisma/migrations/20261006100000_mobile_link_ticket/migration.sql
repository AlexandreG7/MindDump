-- Liaison d'un compte Google/Apple depuis l'app mobile : ticket à usage unique.
-- Table nouvelle, purement additive.
CREATE TABLE "MobileLinkTicket" (
    "id" TEXT NOT NULL,
    "ticketHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "challenge" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "result" TEXT,
    "codeHash" TEXT,
    "codeExpiresAt" TIMESTAMP(3),
    "exchangedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MobileLinkTicket_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MobileLinkTicket_ticketHash_key" ON "MobileLinkTicket"("ticketHash");
CREATE UNIQUE INDEX "MobileLinkTicket_codeHash_key" ON "MobileLinkTicket"("codeHash");
CREATE INDEX "MobileLinkTicket_userId_idx" ON "MobileLinkTicket"("userId");
CREATE INDEX "MobileLinkTicket_createdAt_idx" ON "MobileLinkTicket"("createdAt");
