import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app=readFileSync(new URL("../dist/terrain-medal.js",import.meta.url),"utf8");
const html=readFileSync(new URL("../dist/terrain-medal.html",import.meta.url),"utf8");

test("desktop preview uses the original VYNDI Ride Stories model-viewer path",()=>{
  assert.doesNotMatch(app,/direct-mesh-preview\.mjs|renderProductionMeshPreviewDirect|glbFallbackCanvas/);
  assert.doesNotMatch(html,/glbFallbackCanvas|glb-viewer-stage/);
  assert.match(html,/<model-viewer id="glbViewer" camera-controls/);
  assert.match(app,/glbViewer\.src=glbViewerUrl/);
  assert.match(app,/GLB rendered · exact governed export is visible/);
});
