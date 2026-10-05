import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isBlockedAddress,
  assertPublicUrl,
  isAllowedUrl,
  fetchAllowedUrl,
  UnsafeUrlError,
  __setLookupForTests,
} from "./safeFetch";
import { isHelloFreshHost, isHelloFreshRecipeUrl } from "./hellofresh";
import { isJowHost, isJowUrl, fetchJowPage } from "./jow";
import { isQuitoqueHost, isQuitoqueRecipeUrl } from "./quitoque";

// Même utilitaire que celui utilisé par l'import de calendrier (ICS, hôte
// arbitraire) et par les trois imports de recettes (hôte ancré par liste
// blanche). Pas d'appel réseau réel : `__setLookupForTests` remplace la
// résolution DNS par une valeur fixe pour simuler un DNS rebinding vers une
// IP privée, sans dépendre du réseau ni d'une mock ESM de "dns/promises".

const HF_ID = "6192a1f3a6b8c9001234abcd"; // 24 caractères hexadécimaux
const JOW_ID = "83jq25q5innb780q0wzk";
const JOW_HOST_PATTERN = /^(?:www\.)?jow\.fr$/i;

function stubLookup(address: string) {
  __setLookupForTests(async () => [{ address, family: 4 }]);
}

// ─── IP interdites, en hôte direct ──────────────────────────────────────────

test("isBlockedAddress : adresses privées, loopback, lien-local, CGNAT, ULA", () => {
  assert.equal(isBlockedAddress("169.254.169.254"), true); // métadonnées cloud
  assert.equal(isBlockedAddress("127.0.0.1"), true);
  assert.equal(isBlockedAddress("0.0.0.0"), true);
  assert.equal(isBlockedAddress("10.1.2.3"), true);
  assert.equal(isBlockedAddress("192.168.1.1"), true);
  assert.equal(isBlockedAddress("100.64.0.1"), true); // CGNAT
  assert.equal(isBlockedAddress("::1"), true);
  assert.equal(isBlockedAddress("fd00::1"), true); // ULA IPv6
  assert.equal(isBlockedAddress("::ffff:10.0.0.1"), true); // IPv4 mappée
  assert.equal(isBlockedAddress("8.8.8.8"), false);
  assert.equal(isBlockedAddress("93.184.216.34"), false);
});

test("assertPublicUrl : rejette les IP littérales internes, sans DNS", async () => {
  for (const host of ["127.0.0.1", "0.0.0.0", "10.0.0.5", "192.168.0.5", "100.64.0.5", "[::1]"]) {
    await assert.rejects(() => assertPublicUrl(`http://${host}/x`), UnsafeUrlError, host);
  }
});

test("assertPublicUrl : 169.254.169.254 en hôte direct et dans le chemin", async () => {
  await assert.rejects(() => assertPublicUrl("http://169.254.169.254/latest/meta-data/"));
  // Dans le chemin seulement (pas l'hôte) : cette fonction ne juge que l'hôte.
  stubLookup("93.184.216.34");
  try {
    const url = await assertPublicUrl("https://example.com/169.254.169.254");
    assert.equal(url.hostname, "example.com");
  } finally {
    __setLookupForTests(null);
  }
});

test("assertPublicUrl : hôte autorisé dont le DNS résout vers une IP privée", async () => {
  stubLookup("127.0.0.1");
  try {
    await assert.rejects(() => assertPublicUrl("http://localhost/x"), UnsafeUrlError);
  } finally {
    __setLookupForTests(null);
  }
});

// ─── Liste blanche ancrée par source ────────────────────────────────────────

test("isAllowedUrl : hôte usurpé, userinfo, port non standard, protocole exotique", () => {
  const HF = /^(?:www\.)?hellofresh\.(?:[a-z]{2,3}|co\.uk|com\.au)$/i;
  assert.equal(isAllowedUrl(`https://hellofresh.fr.evil.com/recipes/x-${HF_ID}`, HF), false);
  assert.equal(isAllowedUrl(`https://evil.com/?hellofresh`, HF), false);
  assert.equal(isAllowedUrl(`https://www.hellofresh.fr:8080/recipes/x-${HF_ID}`, HF), false);
  assert.equal(isAllowedUrl(`http://www.hellofresh.fr/recipes/x-${HF_ID}`, HF), false); // http refusé
  assert.equal(isAllowedUrl(`file:///etc/passwd`, HF), false);
  assert.equal(isAllowedUrl(`gopher://hellofresh.fr/recipes`, HF), false);
  assert.equal(isAllowedUrl(`https://www.hellofresh.fr/recipes/x-${HF_ID}`, HF), true);
});

test("HelloFresh : hôte usurpé ou invalide → refusé avant tout fetch", () => {
  assert.equal(isHelloFreshHost(`http://169.254.169.254/latest/meta-data/?x=hellofresh`), false);
  assert.equal(isHelloFreshHost(`https://hellofresh.fr.evil.com/recipes/x-${HF_ID}`), false);
  assert.equal(isHelloFreshHost(`https://evil.com/?hellofresh`), false);
  assert.equal(isHelloFreshHost(`http://www.hellofresh.fr:8080/recipes/x-${HF_ID}`), false);
  assert.equal(isHelloFreshHost(`file:///etc/passwd`), false);
  assert.equal(isHelloFreshHost(`gopher://www.hellofresh.fr/recipes/x-${HF_ID}`), false);
  // Vrai hôte, vraie recette (y compris un TLD étranger).
  assert.equal(isHelloFreshHost(`https://www.hellofresh.fr/recipes/poulet-roti-${HF_ID}`), true);
  assert.equal(isHelloFreshRecipeUrl(`https://www.hellofresh.fr/recipes/poulet-roti-${HF_ID}`), true);
  assert.equal(isHelloFreshRecipeUrl(`https://www.hellofresh.co.uk/recipes/chicken-pie-${HF_ID}`), true);
});

test("Jow : hôte usurpé, userinfo, IP dans le chemin → refusé", () => {
  assert.equal(isJowHost(`http://169.254.169.254/x/jow.fr/recipes/x-aaaaaaaaaaaaaaaa`), false);
  assert.equal(isJowUrl(`http://169.254.169.254/x/jow.fr/recipes/x-aaaaaaaaaaaaaaaa`), false);
  assert.equal(isJowHost(`https://jow.fr.evil.com/recipes/x-${JOW_ID}`), false);
  assert.equal(isJowHost(`https://evil.com/jow.fr/recipes/x-${JOW_ID}`), false);
  // "jow.fr@evil.com" : userinfo "jow.fr", hôte réel "evil.com".
  assert.equal(isJowHost(`https://jow.fr@evil.com/recipes/x-${JOW_ID}`), false);
  assert.equal(isJowUrl(`https://jow.fr@evil.com/recipes/x-${JOW_ID}`), false);
  // Vrai hôte, vraie recette.
  assert.equal(isJowHost(`https://jow.fr/recipes/crepes-maison-${JOW_ID}`), true);
  assert.equal(isJowUrl(`https://jow.fr/recipes/crepes-maison-${JOW_ID}`), true);
});

test("Quitoque : hôte usurpé, userinfo, port non standard → refusé", () => {
  assert.equal(isQuitoqueHost(`https://quitoque.fr.evil.com/recettes/poulet`), false);
  assert.equal(isQuitoqueHost(`https://evil.com/recettes/poulet?quitoque`), false);
  assert.equal(isQuitoqueHost(`https://quitoque.fr@evil.com/recettes/poulet`), false);
  assert.equal(isQuitoqueHost(`https://www.quitoque.fr:8080/recettes/poulet`), false);
  // Vrai hôte, vraie recette.
  assert.equal(isQuitoqueHost(`https://www.quitoque.fr/recettes/poulet-tikka-masala`), true);
  assert.equal(isQuitoqueRecipeUrl(`https://www.quitoque.fr/recettes/poulet-tikka-masala`), true);
});

// ─── fetchAllowedUrl / fetchJowPage : redirection interne, DNS rebinding ───

test("fetchAllowedUrl : hôte hors liste refusé avant tout fetch", async () => {
  const realFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = (async () => {
    called = true;
    return new Response("", { status: 200 });
  }) as typeof fetch;
  try {
    await assert.rejects(
      () => fetchAllowedUrl("https://evil.com/recipes/x", JOW_HOST_PATTERN),
      UnsafeUrlError
    );
    assert.equal(called, false);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("fetchAllowedUrl : redirection vers un hôte interne refusée", async () => {
  stubLookup("93.184.216.34");
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(null, {
      status: 302,
      headers: { location: "http://169.254.169.254/latest/meta-data/" },
    })) as typeof fetch;
  try {
    await assert.rejects(
      () => fetchAllowedUrl("https://jow.fr/recipes/x", JOW_HOST_PATTERN),
      UnsafeUrlError
    );
  } finally {
    globalThis.fetch = realFetch;
    __setLookupForTests(null);
  }
});

test("fetchAllowedUrl : hôte autorisé dont le DNS résout vers une IP privée", async () => {
  stubLookup("192.168.1.50");
  const realFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = (async () => {
    called = true;
    return new Response("ne devrait jamais être atteint", { status: 200 });
  }) as typeof fetch;
  try {
    await assert.rejects(
      () => fetchAllowedUrl("https://jow.fr/recipes/x", JOW_HOST_PATTERN),
      UnsafeUrlError
    );
    assert.equal(called, false, "le fetch ne doit pas avoir lieu après un DNS interne");
  } finally {
    globalThis.fetch = realFetch;
    __setLookupForTests(null);
  }
});

test("fetchJowPage : hôte autorisé mais DNS vers une IP privée → rejeté", async () => {
  stubLookup("169.254.169.254");
  const realFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = (async () => {
    called = true;
    return new Response("<html></html>", { status: 200 });
  }) as typeof fetch;
  try {
    await assert.rejects(() => fetchJowPage("https://jow.fr/recipes/x-aaaaaaaaaaaaaaaa"));
    assert.equal(called, false);
  } finally {
    globalThis.fetch = realFetch;
    __setLookupForTests(null);
  }
});
