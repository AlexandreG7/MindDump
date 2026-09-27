import { NextResponse } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/session";
import { sendPushToUser } from "@/lib/push";

/** Notification d'essai sur les appareils abonnés de l'utilisateur. */
export async function POST() {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const result = await sendPushToUser(user.id, {
    title: "MindDump",
    body: "Les notifications fonctionnent sur cet appareil.",
    url: "/profile",
    tag: "test",
  });
  return NextResponse.json(result);
}
