import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const theme=readFileSync(new URL("../dist/my-road-my-glory-theme.css",import.meta.url),"utf8");
const terrain=readFileSync(new URL("../dist/terrain-medal.css",import.meta.url),"utf8");
const html=readFileSync(new URL("../dist/terrain-medal.html",import.meta.url),"utf8");

test("late corporate theme preserves the three-zone Terrain Medal workbench",()=>{
  assert.match(theme,/Terrain Medal three-zone compatibility lock/);
  assert.match(theme,/body\.terrain-medal-app \.workspace\{[\s\S]*grid-template-columns:minmax\(260px,330px\) minmax\(520px,1fr\) minmax\(280px,360px\)/);
  assert.match(theme,/body\\.terrain-medal-app \\.controls\\{[\\s\\S]*?display:contents/);
  assert.match(theme,/body\.terrain-medal-app \.workbench-center-top\{grid-column:2;grid-row:1/);
  assert.match(theme,/body\.terrain-medal-app \.preview-panel\{grid-column:2;grid-row:2/);
  assert.match(theme,/body\.terrain-medal-app \.workbench-left-rail\{grid-column:1;grid-row:1 \/ span 2/);
  assert.match(theme,/body\.terrain-medal-app \.workbench-right-rail\{grid-column:3;grid-row:1 \/ span 2/);
});

test("center stack exposes discovery, live concept view and GLB AR inspection in order",()=>{
  const discover=html.indexOf('class="workbench-center-top"');
  const preview=html.indexOf('class="preview-panel"');
  const canvas=html.indexOf('id="medalCanvas"',preview);
  const glb=html.indexOf('id="generatedModelPreview"',preview);
  assert.ok(discover>=0&&preview>discover&&canvas>preview&&glb>canvas);
  assert.match(terrain,/\.workbench-center-top\{grid-column:2/);
  assert.match(terrain,/\.preview-panel\{grid-column:2;grid-row:2/);
});
