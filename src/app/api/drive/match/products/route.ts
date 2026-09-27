import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";
import { assertGroupMember, resolveGroupId } from "@/lib/groupAuth";
import { itemKey, quantityInName } from "@/lib/drive/normalize";
import { loadList, MAX_ITEMS, rememberedView, sanitizeProduct, STORE } from "@/lib/drive/server";

export const dynamic = "force-dynamic";

/** Produits mémorisés d'un groupe (par défaut, le groupe par défaut de la personne). */
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const groupId = await resolveGroupId(user.id, new URL(req.url).searchParams.get("groupId"));
  const err = await assertGroupMember(groupId, user.id);
  if (err) return err;

  const products = await prisma.driveProduct.findMany({
    where: { groupId, store: STORE },
    orderBy: [{ lastUsedAt: { sort: "desc", nulls: "last" } }, { name: "asc" }],
  });
  return NextResponse.json(products.map(rememberedView));
}

/**
 * Mémorise les produits mis au panier pour une liste, après un ajout réussi
 * sur le site Match. Un même article (même clé) remplace le produit précédent.
 *
 * Corps : { listId, choices: [{ itemId, product: MatchProduct, quantity }] }
 */
export async function PUT(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const body = await req.json().catch(() => null);
  const listId = typeof body?.listId === "string" ? body.listId : null;
  if (!listId || !Array.isArray(body?.choices) || body.choices.length > MAX_ITEMS) {
    return NextResponse.json({ error: "listId et choices requis" }, { status: 400 });
  }

  const loaded = await loadList(listId, user.id);
  if (!loaded) return NextResponse.json({ error: "Liste introuvable" }, { status: 404 });
  const { list, groupId } = loaded;
  const itemsById = new Map(list.items.map((i) => [i.id, i]));

  const now = new Date();
  let saved = 0;
  for (const choice of body.choices as { itemId?: unknown; product?: unknown; quantity?: unknown }[]) {
    const item = typeof choice?.itemId === "string" ? itemsById.get(choice.itemId) : undefined;
    const product = sanitizeProduct(choice?.product);
    const key = item ? itemKey(item.name) : "";
    if (!item || !product || !key) continue;
    // La quantité par défaut n'a de sens que si l'article n'en précise pas
    // (ni dans son champ quantité, ni dans son libellé : « 2 citrons »).
    const hasQuantity = !!item.quantity || !!quantityInName(item.name);
    const quantity =
      !hasQuantity && typeof choice.quantity === "number" && choice.quantity >= 1 && choice.quantity <= 99
        ? Math.round(choice.quantity)
        : 1;

    const data = {
      name: item.name.slice(0, 200),
      sku: product.sku,
      ean: product.ean ?? null,
      label: product.nom,
      brand: product.marque ?? null,
      packaging: product.conditionnement ?? null,
      image: product.image ?? null,
      price: product.prix ?? null,
      unitPrice: product.prixUnite ?? null,
      unitLabel: product.mesureUnite ?? null,
      lastUsedAt: now,
    };
    await prisma.driveProduct.upsert({
      where: { groupId_store_key: { groupId, store: STORE, key } },
      create: { ...data, groupId, store: STORE, key, quantity, useCount: 1 },
      update: { ...data, ...(hasQuantity ? {} : { quantity }), useCount: { increment: 1 } },
    });
    saved++;
  }

  return NextResponse.json({ saved });
}

/** Oublie un produit mémorisé : ?id=… */
export async function DELETE(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });

  const product = await prisma.driveProduct.findUnique({ where: { id }, select: { groupId: true } });
  if (!product) return NextResponse.json({ success: true });
  const err = await assertGroupMember(product.groupId, user.id);
  if (err) return err;

  await prisma.driveProduct.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
