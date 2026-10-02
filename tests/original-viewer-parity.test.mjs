import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app=readFileSync(new URL("../dist/terrain-medal.js",import.meta.url),"utf8");
const html=readFileSync(new URL("../dist/terrain-medal.html",import.meta.url),"utf8");
const css=readFileSync(new URL("../dist/terrain-medal.css",import.meta.url),"utf8");

test("standalone Terrain Medal uses the original VYNDI Ride Stories single model-viewer architecture",()=>{
  assert.match(app,/MODEL_VIEWER_LOCAL="\/vendor\/model-viewer\.min\.js\?v=4\.3\.1"/);
  assert.match(app,/glbViewer\.src=glbViewerUrl/);
  assert.match(app,/GLB rendered · exact governed export is visible/);
  assert.doesNotMatch(app,/direct-mesh-preview/);
  assert.doesNotMatch(app,/renderProductionMeshPreviewDirect/);
  assert.doesNotMatch(app,/glbFallbackCanvas/);

  const viewers=(html.match(/<model-viewer\b/g)||[]).length;
  assert.equal(viewers,1);
  assert.match(html,/camera-orbit="0deg 65deg auto"/);
  assert.doesNotMatch(html,/glbFallbackCanvas/);
  assert.doesNotMatch(html,/glb-viewer-stage/);

  assert.match(css,/\.glb-viewer-panel model-viewer\{/);
  assert.doesNotMatch(css,/\.glb-fallback-canvas/);
  assert.doesNotMatch(css,/\.glb-native-viewer/);
});

test("standalone Terrain Medal uses the original working print model encoder revision",()=>{
  assert.match(app,/\.\/print-model-core\.mjs\?v=7/);
});
