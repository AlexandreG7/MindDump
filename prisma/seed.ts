import { PrismaClient } from "@prisma/client";
import { scryptSync, randomBytes } from "crypto";

const prisma = new PrismaClient();

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function generatePublicId(): string {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let result = "";
  for (let i = 0; i < 6; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
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
  const admin = await prisma.user.upsert({
    where: { email: "admin@minddump.com" },
    update: {},
    create: {
      name: "Admin",
      email: "admin@minddump.com",
      password: hashPassword("Admin123!"),
      role: "admin",
      emailVerified: new Date(),
      publicId: generatePublicId(),
    },
  });
  await ensureDefaultGroup(admin.id, admin.name);

  const user = await prisma.user.upsert({
    where: { email: "user@minddump.com" },
    update: {},
    create: {
      name: "Utilisateur",
      email: "user@minddump.com",
      password: hashPassword("User123!"),
      role: "user",
      emailVerified: new Date(),
      publicId: generatePublicId(),
    },
  });
  await ensureDefaultGroup(user.id, user.name);

  console.log("Comptes et groupes crees :");
  console.log(`   Admin  : admin@minddump.com  /  Admin123!`);
  console.log(`   User   : user@minddump.com   /  User123!`);
}

main()
  .catch((e) => {
    console.error("Erreur seed :", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
