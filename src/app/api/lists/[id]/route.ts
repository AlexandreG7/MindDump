import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";
import { buildItemAccessWhere } from "@/lib/groupAuth";

export async function DELETE(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const user = await getSessionUser();
  if (!user) return unauthorized();

  await prisma.shoppingList.deleteMany({
    where: { id: params.id, ...(await buildItemAccessWhere(user.id)) },
  });

  return NextResponse.json({ success: true });
}
