import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";
import { itemKey, searchQuery } from "@/lib/drive/normalize";
import { loadList, rememberedView, STORE } from "@/lib/drive/server";

export const dynamic = "force-dynamic";

/**
 * Plan de panier d'une liste : articles non cochés, avec pour chacun la
 * requête à lancer sur Match et le produit déjà retenu par le groupe.
 */
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const listId = new URL(req.url).searchParams.get("listId");
  if (!listId) return NextResponse.json({ error: "listId requis" }, { status: 400 });

  const loaded = await loadList(listId, user.id);
  if (!loaded) return NextResponse.json({ error: "Liste introuvable" }, { status: 404 });
  const { list, groupId } = loaded;

  const keys = list.items.map((i) => itemKey(i.name));
  const remembered = await prisma.driveProduct.findMany({
    where: { groupId, store: STORE, key: { in: keys.filter(Boolean) } },
  });
  const byKey = new Map(remembered.map((d) => [d.key, d]));

  return NextResponse.json({
    store: STORE,
    list: { id: list.id, name: list.name },
    items: list.items.map((item, i) => {
      const mapping = keys[i] ? byKey.get(keys[i]) : undefined;
      return {
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        key: keys[i],
        query: searchQuery(item.name),
        remembered: mapping ? rememberedView(mapping) : null,
      };
    }),
  });
}
