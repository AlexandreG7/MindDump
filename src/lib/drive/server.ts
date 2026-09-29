import { prisma } from "@/lib/prisma";
import { buildItemAccessWhere } from "@/lib/groupAuth";
import { ensureDefaultGroup } from "@/lib/defaultGroup";
import type { MatchProduct } from "./types";

export const STORE = "match";

/** Limites des requêtes venant du script côté site. */
export const MAX_ITEMS = 100;
export const MAX_CANDIDATES = 30;

/**
 * Liste accessible à l'utilisateur, avec le groupe qui porte les produits
 * mémorisés : celui de la liste si la personne en est membre, sinon son groupe
 * par défaut (liste sans groupe, ou dont l'auteur a quitté le groupe : il la
 * voit toujours, voir docs/adr/0001, mais n'a plus accès aux choix du groupe).
 */
export async function loadList(listId: string, userId: string) {
  const list = await prisma.shoppingList.findFirst({
    where: { id: listId, ...(await buildItemAccessWhere(userId)) },
    include: { items: { where: { checked: false }, orderBy: { id: "asc" } } },
  });
  if (!list) return null;
  const member = list.groupId
    ? await prisma.groupMember.findFirst({ where: { groupId: list.groupId, userId }, select: { id: true } })
    : null;
  const groupId = member ? list.groupId! : (await ensureDefaultGroup(userId)).id;
  return { list, groupId };
}

function str(value: unknown, max = 200): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value < 1e6 ? value : null;
}

/**
 * Produit envoyé par le script côté site : on ne garde que les champs connus,
 * bornés. Un SKU Match est une suite de chiffres ; tout le reste est écarté.
 */
export function sanitizeProduct(raw: unknown): MatchProduct | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const sku = str(r.sku, 20);
  const nom = str(r.nom);
  if (!sku || !/^\d{1,12}$/.test(sku) || !nom) return null;
  const categories = Array.isArray(r.categories)
    ? r.categories.map((c) => str(c, 100)).filter((c): c is string => !!c).slice(0, 8)
    : null;
  const image = str(r.image, 100);
  return {
    sku,
    nom,
    ean: str(r.ean, 20),
    marque: str(r.marque),
    legalName: str(r.legalName),
    prix: num(r.prix),
    prixUnite: num(r.prixUnite),
    mesure: num(r.mesure),
    mesureUnite: str(r.mesureUnite, 20),
    poidsNet: num(r.poidsNet),
    poidsNetUnite: str(r.poidsNetUnite, 20),
    conditionnement: str(r.conditionnement, 100),
    disponible: typeof r.disponible === "boolean" ? r.disponible : null,
    bio: typeof r.bio === "boolean" ? r.bio : null,
    image: image && /^[\w.-]+$/.test(image) ? image : null,
    rubrique: str(r.rubrique, 100),
    categories,
    modeAchatVente: str(r.modeAchatVente, 20),
    quantiteMin: num(r.quantiteMin),
    quantiteMax: num(r.quantiteMax),
    sponso: typeof r.sponso === "boolean" ? r.sponso : null,
  };
}

/** Forme renvoyée au client pour un produit mémorisé. */
export function rememberedView(d: {
  id: string; sku: string; ean: string | null; label: string; brand: string | null;
  packaging: string | null; image: string | null; price: number | null; unitPrice: number | null;
  unitLabel: string | null; quantity: number; useCount: number; lastUsedAt: Date | null; name: string;
}) {
  return {
    id: d.id,
    name: d.name,
    sku: d.sku,
    ean: d.ean,
    label: d.label,
    brand: d.brand,
    packaging: d.packaging,
    image: d.image,
    price: d.price,
    unitPrice: d.unitPrice,
    unitLabel: d.unitLabel,
    quantity: d.quantity,
    useCount: d.useCount,
    lastUsedAt: d.lastUsedAt,
  };
}
