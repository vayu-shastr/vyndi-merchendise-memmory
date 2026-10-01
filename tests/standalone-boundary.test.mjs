import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [pkgRaw, worker, index, terrain] = await Promise.all([
  readFile(new URL("../package.json", import.meta.url), "utf8"),
  readFile(new URL("../src/terrain-worker.mjs", import.meta.url), "utf8"),
  readFile(new URL("../dist/index.html", import.meta.url), "utf8"),
  readFile(new URL("../dist/terrain-medal.html", import.meta.url), "utf8")
]);
const pkg = JSON.parse(pkgRaw);

test("standalone extraction is named for terrain and merchandise", () => {
  assert.equal(pkg.name, "vyndi-terrain-merchandise");
});

test("standalone worker contains no local community backend dependency", () => {
  assert.doesNotMatch(worker, /community-worker|CommunityHub|handleCommunityRequest|\/api\/community\//);
});

test("merchandise and terrain entry points remain present", () => {
  assert.match(index, /shopGrid|Finish &amp; Order|terrain-medal/i);
  assert.match(terrain, /Terrain Medal|terrain-medal\.js/i);
});

test("community remains an external sibling rather than a copied local module", () => {
  assert.doesNotMatch(index, /href="\/community(?:["#])/);
  assert.doesNotMatch(terrain, /href="\/community(?:["#])/);
});
