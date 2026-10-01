import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const builder=readFileSync(new URL("../scripts/build-vendor.mjs",import.meta.url),"utf8");
const html=readFileSync(new URL("../dist/terrain-medal.html",import.meta.url),"utf8");
const app=readFileSync(new URL("../dist/terrain-medal.js",import.meta.url),"utf8");
const preview=readFileSync(new URL("../dist/direct-mesh-preview.mjs",import.meta.url),"utf8");

test("Terrain Medal ships a local Three.js production-mesh preview renderer",()=>{
  assert.match(builder,/three-glb-viewer\.mjs/);
  assert.match(builder,/OrbitControls/);
  assert.match(html,/id="glbFallbackCanvas"/);
  assert.match(app,/direct-mesh-preview\.mjs/);
  assert.match(preview,/OrbitControls/);
  assert.match(preview,/renderProductionMeshPreview/);
  assert.match(app,/glbFallbackCanvas/);
});
