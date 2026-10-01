import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ensureDeviceWithShareToken } from "@/lib/mobileAuth";
import { NATIVE_APP_COOKIE, isNativeRequest } from "@/lib/native";

/**
 * Appelé par l'app une fois connectée (src/lib/nativeDevice.ts) : rattache la
 * session à un appareil (créé si besoin) et renvoie le jeton de l'extension de
 * partage iOS, que l'app range dans le trousseau partagé. Réservé à l'app.
 */
export async function POST(req: NextRequest) {
  if (!isNativeRequest(req.headers.get("user-agent"), cookies().get(NATIVE_APP_COOKIE)?.value)) {
    return NextResponse.json({ error: "Réservé à l'app" }, { status: 403 });
  }
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const token = await getToken({ req });
  const deviceId = typeof token?.deviceId === "string" ? token.deviceId : null;
  const body = await req.json().catch(() => null);

  const result = await ensureDeviceWithShareToken(userId, deviceId, body?.device);
  if (!result) return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });

  const res = NextResponse.json({ shareToken: result.shareToken });
  if (result.cookie) res.cookies.set(result.cookie.name, result.cookie.value, result.cookie.options);
  return res;
}
