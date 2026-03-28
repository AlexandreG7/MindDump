import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { prisma } from "./prisma";

const DEV_USER = {
  id: "dev-user",
  name: "Dev User",
  email: "dev@minddump.local",
  image: null,
};

async function ensureDevUser() {
  const existing = await prisma.user.findUnique({
    where: { id: DEV_USER.id },
  });
  if (!existing) {
    await prisma.user.create({
      data: {
        id: DEV_USER.id,
        name: DEV_USER.name,
        email: DEV_USER.email,
      },
    });
  }
  return DEV_USER;
}

/**
 * Vérifie l'authentification par API Key (header Authorization: Bearer <key>)
 */
async function getApiKeyUser() {
  try {
    const headersList = headers();
    const authorization = headersList.get("authorization");
    if (!authorization?.startsWith("Bearer ")) return null;

    const key = authorization.slice(7);
    if (!key) return null;

    const apiKey = await prisma.apiKey.findUnique({
      where: { key },
      include: { user: { select: { id: true, name: true, email: true, image: true, role: true } } },
    });

    if (!apiKey) return null;

    return {
      id: apiKey.user.id,
      name: apiKey.user.name,
      email: apiKey.user.email,
      image: apiKey.user.image,
    };
  } catch {
    return null;
  }
}

export async function getSessionUser() {
  // Dev mode: skip auth, use a fixed dev user
  if (process.env.SKIP_AUTH === "true") {
    return ensureDevUser();
  }

  // 1. Essayer l'authentification par API Key (pour MCP et intégrations)
  const apiKeyUser = await getApiKeyUser();
  if (apiKeyUser) return apiKeyUser;

  // 2. Fallback sur la session NextAuth classique
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  return session.user;
}

export function unauthorized() {
  return NextResponse.json({ error: "Non autorise" }, { status: 401 });
}
