const { PrismaClient } = require("@prisma/client");

async function main() {
  const prisma = new PrismaClient();
  try {
    const result = await prisma.recipe.updateMany({
      where: { inCatalog: false },
      data: { inCatalog: true },
    });
    if (result.count > 0) {
      console.log(`Backfilled inCatalog=true for ${result.count} recipes`);
    }
  } catch (e) {
    console.log("backfill-in-catalog: skipped (column may not exist yet)");
  } finally {
    await prisma.$disconnect();
  }
}

main();
