-- Bêta privée : demandes d'accès et liens d'inscription à usage unique.
-- Deux tables nouvelles, purement additives (aucune colonne existante touchée).
-- CreateTable
CREATE TABLE "BetaAccessRequest" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "consentVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "BetaAccessRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignupInvite" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "requestId" TEXT,

    CONSTRAINT "SignupInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BetaAccessRequest_email_key" ON "BetaAccessRequest"("email");

-- CreateIndex
CREATE INDEX "BetaAccessRequest_status_createdAt_idx" ON "BetaAccessRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "BetaAccessRequest_updatedAt_idx" ON "BetaAccessRequest"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SignupInvite_tokenHash_key" ON "SignupInvite"("tokenHash");

-- CreateIndex
CREATE INDEX "SignupInvite_email_idx" ON "SignupInvite"("email");

-- CreateIndex
CREATE INDEX "SignupInvite_requestId_idx" ON "SignupInvite"("requestId");

-- CreateIndex
CREATE INDEX "SignupInvite_createdById_idx" ON "SignupInvite"("createdById");

-- CreateIndex
CREATE INDEX "SignupInvite_createdAt_idx" ON "SignupInvite"("createdAt");

-- AddForeignKey
ALTER TABLE "SignupInvite" ADD CONSTRAINT "SignupInvite_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignupInvite" ADD CONSTRAINT "SignupInvite_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "BetaAccessRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

