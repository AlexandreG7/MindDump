// Promeut (ou rétrograde) un compte administrateur du dashboard /admin.
//
//   node prisma/promote-admin.js alice@exemple.fr           -> role "admin"
//   node prisma/promote-admin.js alice@exemple.fr --revoke  -> role "user"
//
// En production (Coolify) : terminal du conteneur de l'app, même commande.
// Voir docs/admin.md.
const { PrismaClient } = require("@prisma/client");

async function main() {
  const [email, flag] = process.argv.slice(2);
  if (!email || (flag && flag !== "--revoke")) {
    console.error("Usage : node prisma/promote-admin.js <email> [--revoke]");
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true } });
    if (!user) {
      console.error(`Aucun compte avec l'email ${email}.`);
      process.exit(1);
    }
    const role = flag === "--revoke" ? "user" : "admin";
    await prisma.user.update({ where: { id: user.id }, data: { role } });
    console.log(`${email} : ${user.role} -> ${role}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
