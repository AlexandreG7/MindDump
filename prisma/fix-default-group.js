/**
 * Correctif ponctuel et IDEMPOTENT : garantir un seul groupe par défaut par
 * propriétaire.
 *
 * Suite à la migration dev-user, l'utilisateur possédait deux groupes marqués
 * isDefault=true (son groupe auto-créé vide + le groupe "Famille" transféré).
 * On garde "Famille" (celui qui contient les données) comme unique défaut et on
 * retire le flag des autres groupes du même propriétaire.
 *
 * Rejouable sans effet une fois corrigé.
 */
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const KEEP_GROUP_ID = process.env.KEEP_DEFAULT_GROUP_ID || "cmniwr7g7000314ldmn9onpns"; // "Famille"

async function main() {
  console.log("[fix-default] === UN SEUL GROUPE PAR DEFAUT ===");

  const keep = await prisma.group.findUnique({
    where: { id: KEEP_GROUP_ID },
    select: { id: true, name: true, ownerId: true, isDefault: true },
  });
  if (!keep) {
    console.log(`[fix-default] Groupe à conserver introuvable (${KEEP_GROUP_ID}). Aucune modification.`);
    return;
  }

  const before = await prisma.group.findMany({
    where: { ownerId: keep.ownerId },
    select: { id: true, name: true, isDefault: true },
    orderBy: { createdAt: "asc" },
  });
  console.log(`[fix-default] Groupes de ${keep.ownerId} avant :`);
  before.forEach((g) => console.log(`  - ${g.name} (${g.id}) isDefault=${g.isDefault}`));

  // "Famille" reste (ou devient) le défaut ; tous les autres groupes de ce
  // propriétaire perdent le flag.
  await prisma.group.update({ where: { id: keep.id }, data: { isDefault: true } });
  const res = await prisma.group.updateMany({
    where: { ownerId: keep.ownerId, id: { not: keep.id }, isDefault: true },
    data: { isDefault: false },
  });
  console.log(`[fix-default] ${res.count} autre(s) groupe(s) rétrogradé(s).`);

  const after = await prisma.group.findMany({
    where: { ownerId: keep.ownerId },
    select: { id: true, name: true, isDefault: true },
    orderBy: { createdAt: "asc" },
  });
  console.log(`[fix-default] Groupes de ${keep.ownerId} après :`);
  after.forEach((g) => console.log(`  - ${g.name} (${g.id}) isDefault=${g.isDefault}`));
  console.log("[fix-default] === TERMINE ===");
}

main()
  .catch((e) => console.error("[fix-default] ERREUR :", e))
  .finally(async () => {
    await prisma.$disconnect();
  });
