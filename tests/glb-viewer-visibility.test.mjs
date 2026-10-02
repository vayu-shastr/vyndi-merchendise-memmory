import test from "node:test";
import assert from "node:assert/strict";
import { buildRadialMedalMesh, encodeGlb } from "../dist/print-model-core.mjs";

function glbJson(bytes){
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  assert.equal(view.getUint32(0,true),0x46546c67);
  const jsonLength=view.getUint32(12,true);
  return JSON.parse(new TextDecoder().decode(bytes.slice(20,20+jsonLength)).trim());
}

test("GLB inspection export preserves the original VYNDI Ride Stories viewer contract",()=>{
  const mesh=buildRadialMedalMesh({
    diameterMm:100,baseMm:3,rings:8,segments:48,
    heightAt:(x,y)=>1+Math.sin(x/15)*.4+Math.cos(y/18)*.3,
    regionAt:x=>x>0?2:0
  });
  const json=glbJson(encodeGlb(mesh,{
    title:"VYNDI source-compatible viewer",
    materials:[
      {name:"Terrain",color:"#59666CFF"},
      {name:"Water",color:"#2F9BC1FF"},
      {name:"Route",color:"#FF6A00FF"}
    ]
  }));
  assert.equal(json.nodes[0].rotation,undefined);
  assert.equal(json.meshes[0].primitives[0].attributes.NORMAL,undefined);
  assert.equal(json.materials.some(m=>m.doubleSided===true),false);
});
