import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";
import { pushEnabled } from "@/lib/push";
import { isAllowedPushEndpoint } from "@/lib/pushEndpoint";

// Clés du navigateur (base64url) : p256dh est une clé publique P-256 non
// compressée (65 octets), auth un secret de 16 octets. Une clé mal formée
// ferait échouer chaque envoi : on la refuse dès l'abonnement.
const isKey = (value: unknown, bytes: number): value is string =>
  typeof value === "string" &&
  /^[A-Za-z0-9_-]+={0,2}$/.test(value) &&
  Buffer.from(value, "base64url").length === bytes;

/** Abonne l'appareil courant aux notifications (PushSubscription.toJSON()). */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (!pushEnabled) {
    return NextResponse.json({ error: "Notifications non configurées" }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const endpoint = body?.endpoint;
  const p256dh = body?.keys?.p256dh;
  const auth = body?.keys?.auth;
  if (!isAllowedPushEndpoint(endpoint) || !isKey(p256dh, 65) || !isKey(auth, 16)) {
    return NextResponse.json({ error: "Abonnement invalide" }, { status: 400 });
  }
  const userAgent = req.headers.get("user-agent")?.slice(0, 256) ?? null;

  // Même appareil, autre compte : l'abonnement passe au dernier abonné.
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { userId: user.id, endpoint, p256dh, auth, userAgent },
    update: { userId: user.id, p256dh, auth, userAgent },
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}

/** Désabonne l'appareil courant (désactivation, déconnexion). */
export async function DELETE(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const body = await req.json().catch(() => null);
  if (typeof body?.endpoint !== "string") {
    return NextResponse.json({ error: "endpoint requis" }, { status: 400 });
  }

  await prisma.pushSubscription.deleteMany({
    where: { endpoint: body.endpoint, userId: user.id },
  });
  return NextResponse.json({ ok: true });
}
