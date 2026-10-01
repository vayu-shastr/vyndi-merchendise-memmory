import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app=readFileSync(new URL("../dist/terrain-medal.js",import.meta.url),"utf8");
const preview=readFileSync(new URL("../dist/direct-mesh-preview.mjs",import.meta.url),"utf8");

test("desktop preview renders the in-memory production mesh, not by reparsing the GLB",()=>{
  assert.match(app,/direct-mesh-preview\.mjs\?v=1/);
  assert.match(app,/renderProductionMeshPreviewDirect/);
  assert.match(app,/await renderProductionMeshPreview\(mesh,materials,diameterMm\)/);
  assert.doesNotMatch(app,/await renderGlbFallback\(glb,diameterMm\)/);
  assert.match(preview,/new THREE\.BufferGeometry\(\)/);
  assert.match(preview,/geometry\.setAttribute\("position"/);
  assert.match(preview,/geometry\.computeVertexNormals\(\)/);
  assert.match(preview,/geometry\.addGroup\(/);
});

test("preview exposes explicit runtime state and native AR events cannot mask fallback failure",()=>{
  assert.match(preview,/dataset\.renderState="loading"/);
  assert.match(preview,/dataset\.renderState="ready"/);
  assert.match(preview,/dataset\.renderState="error"/);
  assert.match(preview,/dataset\.renderError=/);
  assert.doesNotMatch(app,/glbViewerStatus\.textContent="GLB loaded · preparing local governed 3D preview/);
});
