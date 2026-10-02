import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html=readFileSync(new URL("../dist/terrain-medal.html",import.meta.url),"utf8");
const css=readFileSync(new URL("../dist/terrain-medal.css",import.meta.url),"utf8");

test("Terrain Medal workbench uses center-top discovery with left adjustments and right production rail",()=>{
  assert.match(html,/class="workbench-center-top"/);
  assert.match(html,/class="workbench-left-rail"/);
  assert.match(html,/class="workbench-right-rail"/);

  const center=html.indexOf('class="workbench-center-top"');
  const left=html.indexOf('class="workbench-left-rail"');
  const right=html.indexOf('class="workbench-right-rail"');
  assert.ok(center>=0&&left>=0&&right>=0);

  const discovery=html.indexOf('class="global-discovery"',center);
  const rider=html.indexOf("<legend>01 · Event and rider</legend>",center);
  const map=html.indexOf("<legend>02 · Map and terrain</legend>",left);
  const production=html.indexOf("<legend>03 · Medal and production</legend>",right);
  assert.ok(discovery>center&&discovery<left);
  assert.ok(rider>center&&rider<left);
  assert.ok(map>left&&map<right);
  assert.ok(production>right);
});

test("desktop workbench CSS defines a three-zone engineering layout and mobile collapse",()=>{
  assert.match(css,/grid-template-columns:minmax\(260px,330px\) minmax\(520px,1fr\) minmax\(280px,360px\)/);
  assert.match(css,/\.workbench-center-top\{grid-column:2/);
  assert.match(css,/\.workbench-left-rail\{grid-column:1/);
  assert.match(css,/\.workbench-right-rail\{grid-column:3/);
  assert.match(css,/@media\(max-width:1180px\)/);
  assert.match(css,/@media\(max-width:760px\)/);
});
