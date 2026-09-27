import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";
import { itemKey } from "@/lib/drive/normalize";
import { rankCandidates } from "@/lib/drive/rank";
import { loadList, MAX_CANDIDATES, MAX_ITEMS, sanitizeProduct, STORE } from "@/lib/drive/server";
import { REVIEW_THRESHOLD, type MatchProduct } from "@/lib/drive/types";

export const dynamic = "force-dynamic";

const SUGGESTIONS_PER_ITEM = 5;

/**
 * Classe les résultats de recherche Match que le script côté site a récupérés
 * pour chaque article. Le libellé et la quantité de l'article sont relus en
 * base : seul le catalogue vient du client.
 *
 * Corps : { listId, items: [{ itemId, candidates: MatchProduct[] }] }
 */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const body = await req.json().catch(() => null);
  const listId = typeof body?.listId === "string" ? body.listId : null;
  if (!listId || !Array.isArray(body?.items)) {
    return NextResponse.json({ error: "listId et items requis" }, { status: 400 });
  }
  if (body.items.length > MAX_ITEMS) {
    return NextResponse.json({ error: `${MAX_ITEMS} articles au maximum` }, { status: 400 });
  }

  const loaded = await loadList(listId, user.id);
  if (!loaded) return NextResponse.json({ error: "Liste introuvable" }, { status: 404 });
  const { list, groupId } = loaded;
  const itemsById = new Map(list.items.map((i) => [i.id, i]));

  const keys = list.items.map((i) => itemKey(i.name)).filter(Boolean);
  const remembered = await prisma.driveProduct.findMany({
    where: { groupId, store: STORE, key: { in: keys } },
    select: { key: true, sku: true, quantity: true },
  });
  const rememberedByKey = new Map(remembered.map((r) => [r.key, r]));

  const results = [];
  for (const entry of body.items as { itemId?: unknown; candidates?: unknown }[]) {
    const item = typeof entry?.itemId === "string" ? itemsById.get(entry.itemId) : undefined;
    if (!item || !Array.isArray(entry.candidates)) continue;
    const candidates = entry.candidates
      .slice(0, MAX_CANDIDATES)
      .map(sanitizeProduct)
      .filter((c): c is MatchProduct => !!c);
    const suggestions = rankCandidates(
      { name: item.name, quantity: item.quantity },
      candidates,
      rememberedByKey.get(itemKey(item.name))
    ).slice(0, SUGGESTIONS_PER_ITEM);
    results.push({
      itemId: item.id,
      needsReview: !suggestions[0] || suggestions[0].confidence < REVIEW_THRESHOLD || suggestions[0].quantityUncertain,
      suggestions: suggestions.map((s) => ({
        ...s,
        // Infinity (produit mémorisé) ne passe pas en JSON.
        score: Number.isFinite(s.score) ? Math.round(s.score * 1000) / 1000 : null,
      })),
    });
  }

  return NextResponse.json({ items: results });
}
