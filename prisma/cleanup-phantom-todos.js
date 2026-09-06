const { PrismaClient } = require("@prisma/client");

const PHANTOM_IDS = [
  "cmnkc8afb000f14ld7j4i863i", // "faire des course" — phantom todo
];

async function main() {
  const prisma = new PrismaClient();
  try {
    for (const id of PHANTOM_IDS) {
      const result = await prisma.todo.deleteMany({ where: { id } });
      if (result.count > 0) {
        console.log(`  ✓ Deleted phantom todo ${id}`);
      } else {
        console.log(`  · Todo ${id} already gone`);
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error("  Cleanup error:", e.message); process.exit(0); });
