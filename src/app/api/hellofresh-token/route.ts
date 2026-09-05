import { NextResponse } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const token = process.env.HELLOFRESH_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "No token configured" }, { status: 404 });
  }

  return NextResponse.json({ token });
}
