import { test } from "node:test";
import assert from "node:assert/strict";
import { isBlockedAddress, assertPublicUrl, UnsafeUrlError, __setLookupForTests } from "./safeFetch.js";

// Pas d'appel réseau réel : `__setLookupForTests` remplace la résolution DNS
// par une valeur fixe pour simuler un DNS rebinding vers une IP privée.

function stubLookup(address: string) {
  __setLookupForTests(async () => [{ address, family: 4 }]);
}

test("isBlockedAddress : adresses privées, loopback, lien-local, CGNAT, ULA, mappée", () => {
  assert.equal(isBlockedAddress("169.254.169.254"), true); // métadonnées cloud
  assert.equal(isBlockedAddress("127.0.0.1"), true);
  assert.equal(isBlockedAddress("0.0.0.0"), true);
  assert.equal(isBlockedAddress("10.1.2.3"), true);
  assert.equal(isBlockedAddress("192.168.1.1"), true);
  assert.equal(isBlockedAddress("100.64.0.1"), true); // CGNAT
  assert.equal(isBlockedAddress("::1"), true);
  assert.equal(isBlockedAddress("fd00::1"), true); // ULA IPv6
  assert.equal(isBlockedAddress("::ffff:10.0.0.1"), true); // IPv4 mappée
  assert.equal(isBlockedAddress("8.8.8.8"), false); // publique
});

test("assertPublicUrl : refuse les schémas non http(s)", async () => {
  await assert.rejects(() => assertPublicUrl("file:///etc/passwd"), UnsafeUrlError);
  await assert.rejects(() => assertPublicUrl("ftp://example.com/x"), UnsafeUrlError);
});

test("assertPublicUrl : refuse les identifiants dans l'URL", async () => {
  await assert.rejects(() => assertPublicUrl("https://user:pass@example.com/x"), UnsafeUrlError);
});

test("assertPublicUrl : refuse une IP interne donnée directement", async () => {
  await assert.rejects(() => assertPublicUrl("http://169.254.169.254/latest/meta-data"), UnsafeUrlError);
  await assert.rejects(() => assertPublicUrl("http://127.0.0.1:8080/x"), UnsafeUrlError);
});

test("assertPublicUrl : refuse un hôte qui résout vers une IP interne (DNS rebinding)", async () => {
  stubLookup("169.254.169.254");
  await assert.rejects(() => assertPublicUrl("https://img.exemple.test/photo.jpg"), UnsafeUrlError);
  __setLookupForTests(null);
});

test("assertPublicUrl : accepte un hôte public", async () => {
  stubLookup("93.184.216.34");
  const url = await assertPublicUrl("https://img.exemple.test/photo.jpg");
  assert.equal(url.hostname, "img.exemple.test");
  __setLookupForTests(null);
});
