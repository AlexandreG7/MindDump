-- Adresses autorisées à créer un compte sans lien (gérées dans /admin), en remplacement de la
-- variable d'environnement ALLOWED_SIGNUP_EMAILS. Une table nouvelle, purement additive : aucune
-- donnée existante touchée, aucune adresse insérée (la table démarre vide).
-- CreateTable
CREATE TABLE "AllowedSignupEmail" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "AllowedSignupEmail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AllowedSignupEmail_email_key" ON "AllowedSignupEmail"("email");

-- CreateIndex
CREATE INDEX "AllowedSignupEmail_createdById_idx" ON "AllowedSignupEmail"("createdById");

-- AddForeignKey
ALTER TABLE "AllowedSignupEmail" ADD CONSTRAINT "AllowedSignupEmail_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

