// Tests : npm run test:drive
// Produits repris de vraies recherches sur supermarchesmatch.fr (septembre 2026).
import { test } from "node:test";
import assert from "node:assert/strict";
import { itemKey, quantityInName, searchQuery, tokens } from "./normalize";
import { parseAmount, quantityToOrder } from "./quantity";
import { rankCandidates } from "./rank";
import type { MatchProduct } from "./types";

const p = (sku: string, fields: Partial<MatchProduct>): MatchProduct => ({
  sku,
  nom: "",
  disponible: true,
  modeAchatVente: "unité",
  quantiteMin: 1,
  quantiteMax: 0,
  ...fields,
});

test("normalisation : accents, pluriels, quantités", () => {
  assert.equal(itemKey("Tomates cerises"), itemKey("tomate cerise"));
  assert.equal(itemKey("Œufs"), "oeuf");
  assert.equal(itemKey("500 g de farine"), "farine");
  assert.equal(itemKey("Crème fraîche (épaisse)"), "creme fraiche");
  assert.equal(searchQuery("2 citrons"), "citrons");
  assert.equal(searchQuery("farine 1kg"), "farine");
  assert.equal(quantityInName("2 citrons"), "2");
  assert.equal(quantityInName("500 g de farine"), "500 g");
  assert.equal(quantityInName("beurre"), null);
  assert.deepEqual(tokens("Huile d'olive"), ["huile", "olive"]);
});

test("quantités : lecture", () => {
  assert.deepEqual(parseAmount("500 g"), { value: 500, unit: "g" });
  assert.deepEqual(parseAmount("1,5 kg"), { value: 1500, unit: "g" });
  assert.deepEqual(parseAmount("20 cl"), { value: 200, unit: "ml" });
  assert.deepEqual(parseAmount("1/2 l"), { value: 500, unit: "ml" });
  assert.deepEqual(parseAmount("3"), { value: 3, unit: "unit" });
  assert.deepEqual(parseAmount("x6"), { value: 6, unit: "unit" });
  assert.deepEqual(parseAmount("2 pièces"), { value: 2, unit: "unit" });
  assert.equal(parseAmount("1 botte"), null);
  assert.equal(parseAmount(""), null);
});

const tomateCerise250 = p("1", { nom: "Tomate cerise allongée", mesure: 0.25, mesureUnite: "/kg" });
const tomatePalier = p("2", {
  nom: "Tomate allongée", modeAchatVente: "poids", mesure: 1, mesureUnite: "/kg",
  poidsNet: 0.5, poidsNetUnite: "/kg", quantiteMax: 5,
});
const oeufs6 = p("3", { nom: "Oeufs de Plein Air Calibre Gros", mesure: 6, mesureUnite: "/unité" });
const citronPiece = p("4", { nom: "Citron non traité après récolte", mesure: 1, mesureUnite: "/unité" });
const citronFilet = p("5", { nom: "Citron 500g", mesure: 0.5, mesureUnite: "/kg" });
const creme50 = p("6", { nom: "Crème fraîche fluide", mesure: 0.5, mesureUnite: "/l" });

test("quantités : nombre d'exemplaires à commander", () => {
  assert.equal(quantityToOrder({ value: 400, unit: "g" }, tomateCerise250).quantity, 2);
  assert.equal(quantityToOrder({ value: 500, unit: "g" }, tomateCerise250).quantity, 2);
  assert.equal(quantityToOrder({ value: 1200, unit: "g" }, tomatePalier).quantity, 3);
  assert.equal(quantityToOrder({ value: 5000, unit: "g" }, tomatePalier).quantity, 5, "borné par quantiteMax");
  assert.equal(quantityToOrder({ value: 6, unit: "unit" }, oeufs6).quantity, 1);
  assert.equal(quantityToOrder({ value: 12, unit: "unit" }, oeufs6).quantity, 2);
  assert.equal(quantityToOrder({ value: 3, unit: "unit" }, citronPiece).quantity, 3);
  assert.equal(quantityToOrder({ value: 200, unit: "ml" }, creme50).quantity, 1);
  assert.equal(quantityToOrder(null, creme50, 2).quantity, 2, "quantité mémorisée par défaut");

  const filet = quantityToOrder({ value: 3, unit: "unit" }, citronFilet);
  assert.deepEqual(filet, { quantity: 1, exact: false }, "pièces contre poids : 1, à vérifier");
});

test("classement : un sandwich ne remplace pas le jambon", () => {
  const results = rankCandidates({ name: "jambon" }, [
    p("s1", { nom: "Sandwich jambon comté 100% francais", rubrique: "Sandwichs et wraps", categories: ["BOULANGERIE PATISSERIE", "SANDWICHS"] }),
    p("s2", { nom: "Sandwich jambon beurre", rubrique: "Sandwichs et wraps", categories: ["BOULANGERIE PATISSERIE", "SANDWICHS"] }),
    p("j1", { nom: "Jambon à l'étouffée sans couenne 4 tranches", rubrique: "Jambons blancs et rôtis de porc", categories: ["CHARCUTERIE", "JAMBONS CUITS"] }),
  ]);
  assert.equal(results[0].product.sku, "j1");
});

test("classement : le sel de cuisine avant le sel pour lave-vaisselle", () => {
  const results = rankCandidates({ name: "sel" }, [
    p("l1", { nom: "Sel régénérant lave vaisselle", marque: "Sun", categories: ["D.P.H.", "PRODUITS VAISSELLE"] }),
    p("l2", { nom: "Sel régénérant pour lave vaisselle", marque: "Carrefour", categories: ["D.P.H.", "PRODUITS VAISSELLE"] }),
    p("c1", { nom: "Sel fin de mer iodé & fluoré", marque: "La baleine", categories: ["EPICERIE", "SELS FIN"] }),
  ]);
  assert.equal(results[0].product.sku, "c1");
});

test("classement : un article ménager reste dans son rayon", () => {
  const results = rankCandidates({ name: "lessive" }, [
    p("x1", { nom: "Lessive liquide savon végétal écolabel", categories: ["D.P.H.", "LESSIVES"] }),
  ]);
  assert.ok(results[0].confidence >= 0.7);
});

test("classement : tomates cerises, quantité et confiance", () => {
  const results = rankCandidates({ name: "Tomates cerises", quantity: "400 g" }, [
    tomatePalier,
    p("sc", { nom: "Sauce tomate cerise", categories: ["EPICERIE", "SAUCES"] }),
    tomateCerise250,
  ]);
  assert.equal(results[0].product.sku, "1");
  assert.equal(results[0].quantity, 2);
  assert.ok(results[0].confidence >= 0.7, `confiance ${results[0].confidence}`);
  assert.ok(results.find((r) => r.product.sku === "sc")!.confidence < 0.7);
});

test("classement : le produit mémorisé passe en tête, indisponibles écartés", () => {
  const results = rankCandidates(
    { name: "beurre doux" },
    [
      p("b1", { nom: "Beurre moulé doux", marque: "Paysan breton", mesure: 0.125, mesureUnite: "/kg" }),
      p("b2", { nom: "Beurre gastronomique doux 82% MG plaquette", marque: "Président", mesure: 0.25, mesureUnite: "/kg" }),
      p("b3", { nom: "Beurre doux", marque: "Lebeau", disponible: false }),
    ],
    { sku: "b2", quantity: 2 }
  );
  assert.equal(results[0].product.sku, "b2");
  assert.equal(results[0].remembered, true);
  assert.equal(results[0].confidence, 1);
  assert.equal(results[0].quantity, 2);
  assert.ok(!results.some((r) => r.product.sku === "b3"));
});

test("classement : sans correspondance, confiance basse", () => {
  const results = rankCandidates({ name: "piment d'espelette" }, [
    p("z1", { nom: "Paprika doux", categories: ["EPICERIE", "EPICES"] }),
  ]);
  assert.ok(results[0].confidence < 0.7);
});

test("normalisation : singulier prudent", () => {
  assert.equal(itemKey("beurre doux"), "beurre doux");
  assert.equal(itemKey("Poireaux"), "poireau");
  assert.equal(itemKey("noix"), "noix");
  assert.equal(searchQuery("Œufs"), "Oeufs");
});

test("classement : la crème n'est pas un produit dérivé", () => {
  const results = rankCandidates({ name: "crème fraîche" }, [
    p("c1", { nom: "Crème fraîche fluide", categories: ["CREMERIE", "CREMES"] }),
  ]);
  assert.ok(results[0].confidence >= 0.9, `confiance ${results[0].confidence}`);
});

test("classement : le format qui colle au besoin", () => {
  const results = rankCandidates({ name: "pommes de terre", quantity: "2 kg" }, [
    // Ordre renvoyé par Match pour « pommes de terre ».
    p("k15", { nom: "Pomme de terre de consommation Princesse Amandine", mesure: 1.5, mesureUnite: "/kg" }),
    p("k2", { nom: "Pomme de terre de consommation à chair ferme", mesure: 2, mesureUnite: "/kg" }),
    p("k1", { nom: "Pommes de terre de consommation 1 kg", mesure: 1, mesureUnite: "/kg" }),
    p("k5", { nom: "Pommes de terre 5 Kg", mesure: 5, mesureUnite: "/kg" }),
  ]);
  assert.equal(results[0].product.sku, "k2");
  assert.equal(results[0].quantity, 1);
});
