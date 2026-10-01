import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { isTerrainMedalRuntimeAsset, isRideStoriesRuntimeAsset, buildSecurityHeaders } from "../src/terrain-worker.mjs";

const worker = await readFile(new URL("../src/terrain-worker.mjs", import.meta.url), "utf8");
const wrangler = await readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8");

test("terrain medal runtime assets are served by the standalone worker", () => {
  assert.equal(isTerrainMedalRuntimeAsset("/terrain-medal.js"), true);
  assert.equal(isTerrainMedalRuntimeAsset("/terrain-medal-core.mjs"), true);
  assert.equal(isTerrainMedalRuntimeAsset("/vendor/model-viewer.min.js"), true);
});

test("merchandise shell is served without local community routes", () => {
  assert.equal(isRideStoriesRuntimeAsset("/"), true);
  assert.equal(isRideStoriesRuntimeAsset("/index.html"), true);
  assert.equal(isRideStoriesRuntimeAsset("/app.js"), true);
  assert.equal(isRideStoriesRuntimeAsset("/community"), false);
});

test("standalone worker retains terrain, map, geography, event and authenticity APIs", () => {
  for (const route of [
    "/api/terrain/health",
    "/api/map/health",
    "/api/geo/search",
    "/api/events/search",
    "/api/authenticity/status"
  ]) assert.match(worker, new RegExp(route.replaceAll("/", "\\/")));
});

test("community backend and durable-object configuration are absent", () => {
  assert.doesNotMatch(worker, /community-worker|CommunityHub|handleCommunityRequest|\/api\/community\//);
  assert.doesNotMatch(wrangler, /COMMUNITY_HUB|durable_objects|community-v1|COMMUNITY_WRITE_RATE_LIMITER/);
});

test("security headers remain enabled", () => {
  const headers = buildSecurityHeaders("text/html");
  assert.equal(headers.get("x-content-type-options"), "nosniff");
  assert.match(headers.get("content-security-policy") || "", /default-src 'self'/);
});
