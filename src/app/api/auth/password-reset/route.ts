import { NextRequest, NextResponse } from "next/server";
import { requestPasswordReset, resetPassword, MIN_PASSWORD_LENGTH } from "@/lib/passwordReset";

/**
 * POST { email }           → envoie le lien s'il existe un compte (réponse identique sinon)
 * PUT  { token, password } → enregistre le nouveau mot de passe
 */
export async function POST(req: NextRequest) {
  const { email } = await req.json().catch(() => ({}));
  if (typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ error: "Indique une adresse e-mail valide." }, { status: 400 });
  }

  try {
    await requestPasswordReset(email);
  } catch (err) {
    // Ne pas révéler l'existence du compte, même quand l'envoi échoue.
    console.error("[password-reset] envoi impossible", err);
  }
  return NextResponse.json({ ok: true });
}

export async function PUT(req: NextRequest) {
  const { token, password } = await req.json().catch(() => ({}));
  const result = await resetPassword(
    typeof token === "string" ? token : "",
    typeof password === "string" ? password : ""
  );

  if (result === "too-short") {
    return NextResponse.json(
      { error: `Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères.` },
      { status: 400 }
    );
  }
  if (result === "invalid") {
    return NextResponse.json(
      { error: "Ce lien n'est plus valable. Demande un nouveau lien, il arrive en quelques secondes." },
      { status: 400 }
    );
  }
  return NextResponse.json({ ok: true });
}
