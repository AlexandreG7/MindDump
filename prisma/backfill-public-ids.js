const { PrismaClient } = require("@prisma/client");

const CHARS = "abcdefghjkmnpqrstuvwxyz23456789";
function randomId(len = 6) {
  let r = "";
  for (let i = 0; i < len; i++) r += CHARS[Math.floor(Math.random() * CHARS.length)];
  return r;
}

async function main() {
  const prisma = new PrismaClient();
  try {
    // 1. anna.pelikan@gmail.com → #s28gc6
    const anna = await prisma.user.findUnique({ where: { email: "anna.pelikan@gmail.com" } });
    if (anna && anna.publicId !== "s28gc6") {
      await prisma.user.update({ where: { id: anna.id }, data: { publicId: "s28gc6" } });
      console.log("  ✓ anna.pelikan@gmail.com → #s28gc6");
    }

    // 2. Backfill users without publicId
    const missing = await prisma.user.findMany({ where: { publicId: null }, select: { id: true, email: true } });
    if (missing.length === 0) {
      console.log("  All users have a publicId.");
      return;
    }

    const taken = new Set(
      (await prisma.user.findMany({ where: { publicId: { not: null } }, select: { publicId: true } }))
        .map((u) => u.publicId)
    );

    for (const user of missing) {
      let newId;
      do { newId = randomId(); } while (taken.has(newId));
      await prisma.user.update({ where: { id: user.id }, data: { publicId: newId } });
      taken.add(newId);
      console.log(`  ✓ ${user.email ?? user.id} → #${newId}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error("  Backfill error:", e.message); process.exit(0); });
