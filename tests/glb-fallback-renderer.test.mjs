import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const builder=readFileSync(new URL("../scripts/build-vendor.mjs",import.meta.url),"utf8");
const html=readFileSync(new URL("../dist/terrain-medal.html",import.meta.url),"utf8");
const app=readFileSync(new URL("../dist/terrain-medal.js",import.meta.url),"utf8");

test("Terrain Medal ships the original self-hosted model-viewer runtime",()=>{
  assert.match(builder,/model-viewer\.min\.js/);
  assert.doesNotMatch(builder,/three-glb-viewer\.mjs/);
  assert.match(html,/<model-viewer id="glbViewer"/);
  assert.doesNotMatch(html,/glbFallbackCanvas/);
  assert.match(app,/const MODEL_VIEWER_LOCAL="\/vendor\/model-viewer\.min\.js\?v=4\.3\.1"/);
  assert.doesNotMatch(app,/direct-mesh-preview\.mjs/);
});
