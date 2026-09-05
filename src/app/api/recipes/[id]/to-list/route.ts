import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";

function parseQuantity(q: string): { amount: number | null; unit: string } {
  const match = q.trim().match(/^([\d.,/½¼¾⅓⅔]+)\s*(.*)$/);
  if (!match) return { amount: null, unit: q.trim() };
  let num = match[1]
    .replace("½", "0.5").replace("¼", "0.25").replace("¾", "0.75")
    .replace("⅓", "0.33").replace("⅔", "0.67").replace(",", ".");
  if (num.includes("/")) {
    const [a, b] = num.split("/");
    num = String(parseFloat(a) / parseFloat(b));
  }
  return { amount: parseFloat(num) || null, unit: match[2].trim() };
}

function normalizeIngredientName(name: string): string {
  return name.toLowerCase().trim()
    .replace(/s$/, "")
    .replace(/^(de |d'|l'|le |la |les |du |des )/, "");
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const recipe = await prisma.recipe.findFirst({
    where: { id: params.id, userId: user.id },
    include: { ingredients: true },
  });

  if (!recipe) {
    return NextResponse.json({ error: "Recette non trouvee" }, { status: 404 });
  }

  const body = await req.json();
  let listId = body.listId;

  if (!listId) {
    const list = await prisma.shoppingList.create({
      data: {
        name: `Courses - ${recipe.title}`,
        type: "GROCERY",
        userId: user.id,
      },
    });
    listId = list.id;
  }

  const existing = await prisma.shoppingItem.findMany({
    where: { listId, checked: false },
  });

  const existingByName = new Map<string, typeof existing[0]>();
  for (const item of existing) {
    existingByName.set(normalizeIngredientName(item.name), item);
  }

  let added = 0;
  let merged = 0;

  for (const ing of recipe.ingredients) {
    const qtyStr = `${ing.quantity}${ing.unit ? ` ${ing.unit}` : ""}`;
    const normalized = normalizeIngredientName(ing.name);
    const match = existingByName.get(normalized);

    if (match) {
      const existingParsed = parseQuantity(match.quantity || "");
      const newParsed = parseQuantity(qtyStr);
      let mergedQty = match.quantity || "";

      if (existingParsed.amount && newParsed.amount && existingParsed.unit === newParsed.unit) {
        mergedQty = `${existingParsed.amount + newParsed.amount} ${existingParsed.unit}`.trim();
      } else if (match.quantity && qtyStr) {
        mergedQty = `${match.quantity} + ${qtyStr}`;
      }

      await prisma.shoppingItem.update({
        where: { id: match.id },
        data: { quantity: mergedQty },
      });
      merged++;
    } else {
      await prisma.shoppingItem.create({
        data: {
          name: ing.name,
          quantity: qtyStr,
          listId,
          recipeId: recipe.id,
        },
      });
      existingByName.set(normalized, { name: ing.name, quantity: qtyStr } as typeof existing[0]);
      added++;
    }
  }

  return NextResponse.json({ listId, added, merged, total: added + merged });
}
