import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { unauthorized } from "@/lib/session";
import { verifyPassword } from "@/lib/password";
import { deleteUserAccount, DELETE_CONFIRMATION } from "@/lib/account";

export const dynamic = "force-dynamic";

// DELETE — suppression définitive du compte (droit à l'effacement).
// Session uniquement, confirmation tapée, et mot de passe si le compte en a un.
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return unauthorized();

  const body = await req.json().catch(() => ({}));
  if (body.confirm !== DELETE_CONFIRMATION) {
    return NextResponse.json(
      { error: `Tape ${DELETE_CONFIRMATION} pour confirmer.` },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { password: true },
  });
  if (!user) return unauthorized();

  if (user.password) {
    if (typeof body.password !== "string" || !verifyPassword(body.password, user.password)) {
      return NextResponse.json({ error: "Mot de passe incorrect." }, { status: 403 });
    }
  }

  await deleteUserAccount(session.user.id);
  return NextResponse.json({ ok: true });
}
