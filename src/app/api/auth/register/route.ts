import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { ensureDefaultGroup } from "@/lib/defaultGroup";
import { generateUniquePublicId } from "@/lib/publicId";
import { CONSENT_VERSION } from "@/lib/consent";
import { SIGNUP_CLOSED_MESSAGE, isSignupAllowed } from "@/lib/signupAllowlist";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const { name, email, password, consent } = body ?? {};

  // Inscriptions fermées (liste blanche, src/lib/signupAllowlist.ts). Contrôle
  // AVANT toute lecture de la base : même réponse, même coût, que l'adresse
  // soit déjà inscrite ou non, donc pas d'énumération des comptes ni de la liste.
  if (!isSignupAllowed(email)) {
    return NextResponse.json({ error: SIGNUP_CLOSED_MESSAGE }, { status: 403 });
  }

  // RGPD : le consentement doit être explicite, y compris pour un POST direct.
  if (consent !== true) {
    return NextResponse.json(
      { error: "Tu dois accepter la politique de confidentialité pour créer un compte." },
      { status: 400 }
    );
  }

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

  // Un champ e-mail peut garder des espaces autour (collage) : on ne les stocke pas.
  const cleanEmail = String(email).trim();

  const existing = await prisma.user.findUnique({ where: { email: cleanEmail } });
  if (existing) {
    return NextResponse.json(
      { error: "Un compte existe déjà avec cet email." },
      { status: 409 }
    );
  }

  const publicId = await generateUniquePublicId();

  const user = await prisma.user.create({
    data: {
      name: name || null,
      email: cleanEmail,
      password: hashPassword(password),
      emailVerified: new Date(),
      role: "user",
      publicId,
      consentedAt: new Date(),
      consentVersion: CONSENT_VERSION,
    },
  });

  // Créer le groupe par défaut automatiquement
  await ensureDefaultGroup(user.id, user.name);

  return NextResponse.json({ ok: true }, { status: 201 });
}
