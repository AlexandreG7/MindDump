import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { ensureDefaultGroup } from "@/lib/defaultGroup";

export async function POST(req: NextRequest) {
  const { name, email, password } = await req.json();

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email et mot de passe requis." },
      { status: 400 }
    );
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: "Le mot de passe doit contenir au moins 8 caractères." },
      { status: 400 }
    );
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "Un compte existe déjà avec cet email." },
      { status: 409 }
    );
  }

  const user = await prisma.user.create({
    data: {
      name: name || null,
      email,
      password: hashPassword(password),
      emailVerified: new Date(),
      role: "user",
    },
  });

  // Créer le groupe par défaut automatiquement
  await ensureDefaultGroup(user.id, user.name);

  return NextResponse.json({ ok: true }, { status: 201 });
}
