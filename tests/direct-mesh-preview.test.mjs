import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const js=readFileSync(new URL("../dist/terrain-medal.js",import.meta.url),"utf8");

test("desktop preview renders the in-memory production mesh, not by reparsing the GLB",()=>{
  assert.match(js,/async function renderProductionMeshPreview\(/);
  assert.match(js,/new THREE\.BufferGeometry\(\)/);
  assert.match(js,/geometry\.setAttribute\("position"/);
  assert.match(js,/geometry\.computeVertexNormals\(\)/);
  assert.match(js,/geometry\.addGroup\(/);
  assert.match(js,/await renderProductionMeshPreview\(mesh,materials,diameterMm\)/);
  assert.doesNotMatch(js,/await renderGlbFallback\(glb,diameterMm\)/);
});

test("preview exposes explicit runtime state and native AR events cannot mask fallback failure",()=>{
  assert.match(js,/dataset\.renderState="loading"/);
  assert.match(js,/dataset\.renderState="ready"/);
  assert.match(js,/dataset\.renderState="error"/);
  assert.match(js,/dataset\.renderError=/);
  assert.doesNotMatch(js,/glbViewerStatus\.textContent="GLB loaded · preparing local governed 3D preview/);
});
