import { prisma } from "./prisma";

const CHARS = "abcdefghjkmnpqrstuvwxyz23456789";

function randomId(length = 6): string {
  let result = "";
  for (let i = 0; i < length; i++) {
    result += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return result;
}

export async function generateUniquePublicId(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const id = randomId();
    const existing = await prisma.user.findUnique({ where: { publicId: id } });
    if (!existing) return id;
  }
  return randomId(8);
}
