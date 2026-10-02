import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html=readFileSync(new URL("../dist/terrain-medal.html",import.meta.url),"utf8");
const css=readFileSync(new URL("../dist/terrain-medal.css",import.meta.url),"utf8");

test("Terrain Medal workbench keeps discovery in the center with left adjustments and right production rail",()=>{
  assert.match(html,/class="workbench-center-top"/);
  assert.match(html,/class="workbench-left-rail"/);
  assert.match(html,/class="workbench-right-rail"/);

  const center=html.indexOf('class="workbench-center-top"');
  const left=html.indexOf('class="workbench-left-rail"');
  const right=html.indexOf('class="workbench-right-rail"');
  assert.ok(center>=0&&left>center&&right>left);

  const primary=html.indexOf('class="center-command-row center-command-row-primary"',center);
  const secondary=html.indexOf('class="center-command-row center-command-row-secondary"',center);
  const map=html.indexOf("<legend>02 · Map and terrain</legend>",left);
  const production=html.indexOf("<legend>03 · Medal and production</legend>",right);
  assert.ok(primary>center&&primary<left);
  assert.ok(secondary>primary&&secondary<left);
  assert.ok(map>left&&map<right);
  assert.ok(production>right);
});

test("desktop workbench CSS gives the center dominant width and preserves responsive collapse",()=>{
  assert.match(css,/grid-template-columns:minmax\(210px,250px\) minmax\(0,1fr\) minmax\(230px,280px\)/);
  assert.match(css,/\.workbench-center-top\{grid-column:2/);
  assert.match(css,/\.workbench-left-rail\{grid-column:1/);
  assert.match(css,/\.workbench-right-rail\{grid-column:3/);
  assert.match(css,/\.center-command-row-primary\{grid-template-columns:72px repeat\(3,minmax\(0,1fr\)\)\}/);
  assert.match(css,/\.center-command-row-secondary\{grid-template-columns:72px repeat\(2,minmax\(0,1fr\)\)\}/);
  assert.match(css,/@media\(max-width:1180px\)/);
  assert.match(css,/@media\(max-width:760px\)/);
});
