import { PrismaClient } from "@prisma/client";
import { scryptSync, randomBytes } from "crypto";

const prisma = new PrismaClient();

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

async function ensureDefaultGroup(userId: string, userName?: string | null) {
  const existing = await prisma.group.findFirst({
    where: { ownerId: userId, isDefault: true },
  });
  if (existing) return existing;

  return prisma.group.create({
    data: {
      name: userName ? `Famille de ${userName}` : "Mon groupe",
      isDefault: true,
      ownerId: userId,
      members: { create: { userId, role: "admin" } },
    },
  });
}

async function main() {
  // ── Compte admin ──────────────────────────────────────────────
  const admin = await prisma.user.upsert({
    where: { email: "admin@minddump.com" },
    update: {},
    create: {
      name: "Admin",
      email: "admin@minddump.com",
      password: hashPassword("Admin123!"),
      role: "admin",
      emailVerified: new Date(),
    },
  });
  await ensureDefaultGroup(admin.id, admin.name);

  // ── Compte utilisateur ────────────────────────────────────────
  const user = await prisma.user.upsert({
    where: { email: "user@minddump.com" },
    update: {},
    create: {
      name: "Utilisateur",
      email: "user@minddump.com",
      password: hashPassword("User123!"),
      role: "user",
      emailVerified: new Date(),
    },
  });
  await ensureDefaultGroup(user.id, user.name);

  console.log("✅ Comptes et groupes créés :");
  console.log(`   🔑 Admin  : admin@minddump.com  /  Admin123!  → groupe "Famille de Admin"`);
  console.log(`   👤 User   : user@minddump.com   /  User123!   → groupe "Famille de Utilisateur"`);
}

main()
  .catch((e) => {
    console.error("❌ Erreur seed :", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
