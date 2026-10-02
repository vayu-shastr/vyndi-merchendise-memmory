import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html=readFileSync(new URL("../dist/terrain-medal.html",import.meta.url),"utf8");
const css=readFileSync(new URL("../dist/terrain-medal.css",import.meta.url),"utf8");
const theme=readFileSync(new URL("../dist/my-road-my-glory-theme.css",import.meta.url),"utf8");

test("center command area is exactly two rows of compact dropdown groups",()=>{
  assert.match(html,/class="center-command-row center-command-row-primary"/);
  assert.match(html,/class="center-command-row center-command-row-secondary"/);
  assert.equal((html.match(/class="center-command-row /g)||[]).length,2);
  for(const key of ["Location & terrain","Event finder","Event details","Rider lookup","Ride result"]){
    assert.ok(html.includes("<summary>"+key+"</summary>"),"missing dropdown "+key);
  }
});

test("center preview gets the dominant desktop width",()=>{
  assert.match(css,/grid-template-columns:minmax\(210px,250px\) minmax\(0,1fr\) minmax\(230px,280px\)/);
  assert.match(css,/\.workbench-center-top\{grid-column:2/);
  assert.match(css,/\.preview-panel\{grid-column:2;grid-row:2/);
  assert.match(theme,/grid-template-columns:minmax\(210px,250px\) minmax\(0,1fr\) minmax\(230px,280px\)/);
});

test("existing Terrain Medal control IDs remain unique after dropdown regrouping",()=>{
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
  const duplicates=ids.filter((id,index)=>ids.indexOf(id)!==index);
  assert.deepEqual(duplicates,[]);
  for(const id of ["geoContinent","geoSearchButton","eventWebSearch","eventSelect","eventName","participant","publicResultUrl","distance","medalCanvas","glbViewer"]){
    assert.ok(ids.includes(id),"missing #"+id);
  }
});
