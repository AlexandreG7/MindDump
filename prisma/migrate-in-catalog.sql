-- Migration: set inCatalog = true for all existing recipes
-- Run after adding the inCatalog column to the Recipe table
-- (via `npx prisma db push` or migration)

UPDATE "Recipe" SET "inCatalog" = true WHERE "inCatalog" = false;
