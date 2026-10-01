import test from "node:test";
import assert from "node:assert/strict";
import { buildRadialMedalMesh, encodeGlb } from "../dist/print-model-core.mjs";

function glbJson(bytes){
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  assert.equal(view.getUint32(0,true),0x46546c67);
  const jsonLength=view.getUint32(12,true);
  return JSON.parse(new TextDecoder().decode(bytes.slice(20,20+jsonLength)).trim());
}

test("GLB inspection export is viewer-safe with normals, double-sided materials and Y-up orientation",()=>{
  const mesh=buildRadialMedalMesh({
    diameterMm:100,
    baseMm:3,
    rings:8,
    segments:48,
    heightAt:(x,y)=>1+Math.sin(x/15)*.4+Math.cos(y/18)*.3,
    regionAt:x=>x>0?2:0
  });
  const json=glbJson(encodeGlb(mesh,{
    title:"VYNDI viewer visibility",
    materials:[
      {name:"Terrain",color:"#59666CFF"},
      {name:"Water",color:"#2F9BC1FF"},
      {name:"Route",color:"#FF6A00FF"}
    ]
  }));

  const primitive=json.meshes[0].primitives[0];
  assert.ok(Number.isInteger(primitive.attributes.NORMAL),"GLB primitive must expose a NORMAL accessor for stable PBR lighting");
  assert.equal(json.accessors[primitive.attributes.NORMAL].type,"VEC3");
  assert.ok(json.materials.every(m=>m.doubleSided===true),"viewer inspection materials must be double-sided");
  assert.deepEqual(json.nodes[0].rotation,[-0.70710678,0,0,0.70710678],"Z-up print geometry must be rotated into glTF Y-up space");
});
