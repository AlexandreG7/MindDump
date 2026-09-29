-- Disposition personnalisée de l'accueil (nullable : disposition par défaut tant que rien n'est enregistré)
ALTER TABLE "User" ADD COLUMN "dashboardLayout" JSONB;
