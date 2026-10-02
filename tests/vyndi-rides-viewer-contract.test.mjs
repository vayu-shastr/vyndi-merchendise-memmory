import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildRadialMedalMesh, encodeGlb } from "../dist/print-model-core.mjs";

function glbJson(bytes){
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const jsonLength=view.getUint32(12,true);
  return JSON.parse(new TextDecoder().decode(bytes.slice(20,20+jsonLength)).trim());
}

test("standalone Terrain Medal uses the proven VYNDI Ride Stories single model-viewer path",()=>{
  const html=readFileSync(new URL("../dist/terrain-medal.html",import.meta.url),"utf8");
  const app=readFileSync(new URL("../dist/terrain-medal.js",import.meta.url),"utf8");
  assert.match(html,/<model-viewer id="glbViewer" camera-controls/);
  assert.doesNotMatch(html,/glbFallbackCanvas|glb-viewer-stage/);
  assert.doesNotMatch(app,/direct-mesh-preview\.mjs|renderProductionMeshPreviewDirect|glbFallbackCanvas/);
  assert.match(app,/glbViewer\.src=glbViewerUrl/);
  assert.match(app,/GLB rendered · exact governed export is visible/);
});

test("GLB encoding matches the VYNDI Ride Stories viewer contract",()=>{
  const mesh=buildRadialMedalMesh({
    diameterMm:60,baseMm:2,rings:3,segments:16,heightAt:()=>.4,regionAt:x=>x>0?2:0
  });
  const json=glbJson(encodeGlb(mesh,{title:"VYNDI source-compatible",materials:[
    {name:"Terrain",color:"#343A3EFF"},{name:"Water",color:"#2F9BC1FF"},{name:"Route",color:"#FF5C35FF"}
  ]}));
  assert.equal(json.nodes[0].rotation,undefined);
  assert.equal(json.meshes[0].primitives[0].attributes.NORMAL,undefined);
  assert.equal(json.materials.some(m=>m.doubleSided===true),false);
});
