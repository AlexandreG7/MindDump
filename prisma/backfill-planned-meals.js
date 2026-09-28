const { PrismaClient } = require("@prisma/client");

/**
 * Une recette placée dans le planning de la semaine est « prévue » (onglet
 * Prévues). Rattrape les repas planifiés avant cette règle. N'enlève jamais
 * le statut « prévue » d'une recette.
 */
async function main() {
  const prisma = new PrismaClient();
  try {
    const { count } = await prisma.recipe.updateMany({
      where: { planned: false, mealPlanEntries: { some: {} } },
      data: { planned: true },
    });
    if (count > 0) console.log(`Marked ${count} scheduled recipes as planned`);
  } catch (e) {
    console.log("backfill-planned-meals: skipped (" + e.message + ")");
  } finally {
    await prisma.$disconnect();
  }
}

main();
