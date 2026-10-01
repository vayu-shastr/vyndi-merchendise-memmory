import test from "node:test";
import assert from "node:assert/strict";
import { projectGeographicOutline, insidePolygons, maskPolygons, buildOutlineHeightfieldMesh, logoFootprint, footprintFits, findEmptyLogoPlacement } from "../dist/map-outline-core.mjs";
import { meshEdgeUse, encodeGlb, buildRadialMedalMesh } from "../dist/print-model-core.mjs";

const square=(x,y,size)=>[{x,y},{x:x+size,y},{x:x+size,y:y+size},{x,y:y+size}];
const image=(width,height,fill)=>{
  const data=new Uint8ClampedArray(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)data[(y*width+x)*4+3]=fill(x,y)?255:0;
  return {width,height,data};
};
const faceArea=(mesh,t)=>{const [a,b,c]=[t.a,t.b,t.c].map(i=>mesh.vertices[i]);return ((b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x))/2;};

test("polygon masks preserve a letter counter rather than filling or swelling it",()=>{
  const polygons=maskPolygons(image(20,20,(x,y)=>x>=3&&x<17&&y>=3&&y<17&&!(x>=7&&x<13&&y>=7&&y<13)));
  assert.equal(polygons.length,1);assert.equal(polygons[0].length,2);
  assert.equal(insidePolygons(0,0,polygons),false);
  assert.equal(insidePolygons(.6,0,polygons),true);
  assert.equal(insidePolygons(.8,0,polygons),false);
  const mesh=buildOutlineHeightfieldMesh({polygons,radiusMm:10,baseMm:3,heightAt:()=>.5,bottomAt:()=>2.9,stepMm:1});
  assert.equal(meshEdgeUse(mesh).boundaryEdges,0);assert.equal(meshEdgeUse(mesh).nonManifoldEdges,0);
  const top=mesh.triangles.filter(t=>faceArea(mesh,t)>0);
  assert.ok(Math.abs(top.reduce((sum,t)=>sum+faceArea(mesh,t),0)-(14*14-6*6))<1e-6);
});
test("diagonal raster contacts stay independent closed solids",()=>{
  const polygons=maskPolygons(image(4,4,(x,y)=>(x===1&&y===1)||(x===2&&y===2)));
  assert.equal(polygons.length,2);
  const mesh=buildOutlineHeightfieldMesh({polygons,radiusMm:2,heightAt:()=>1,stepMm:.3});
  assert.equal(meshEdgeUse(mesh).boundaryEdges,0);assert.equal(meshEdgeUse(mesh).nonManifoldEdges,0);
});
test("concave geographic outlines, holes and islands retain their shape and remain watertight",()=>{
  const concave=[{x:0,y:0},{x:1,y:0},{x:1,y:.4},{x:.4,y:.4},{x:.4,y:1},{x:0,y:1}];
  const polygons=[[concave,square(.1,.1,.1)],[square(-.8,-.8,.2)]];
  const mesh=buildOutlineHeightfieldMesh({polygons,radiusMm:10,heightAt:(x,y)=>.5+x*.1+y*.1,stepMm:.7});
  const edges=meshEdgeUse(mesh);assert.equal(edges.boundaryEdges,0);assert.equal(edges.nonManifoldEdges,0);
  assert.equal(insidePolygons(.8,.8,polygons),false);assert.equal(insidePolygons(.15,.15,polygons),false);assert.equal(insidePolygons(-.7,-.7,polygons),true);
  const top=mesh.triangles.filter(t=>faceArea(mesh,t)>0);
  assert.ok(Math.abs(top.reduce((sum,t)=>sum+faceArea(mesh,t),0)-67)<1e-6);
  assert.ok(top.every(t=>{const p=[t.a,t.b,t.c].map(i=>mesh.vertices[i]);return insidePolygons(p.reduce((s,v)=>s+v.x,0)/30,p.reduce((s,v)=>s+v.y,0)/30,polygons)}));
});
test("geographic projection accepts multipolygons and rejects missing, malformed or cropped boundaries",()=>{
  const geometry={type:"MultiPolygon",coordinates:[[[[0,0],[2,0],[2,2],[0,2],[0,0]]],[[[3,0],[4,0],[4,1],[3,1],[3,0]]]]},bounds={minLon:0,maxLon:4,minLat:0,maxLat:2};
  assert.equal(projectGeographicOutline(geometry,bounds).length,2);
  assert.throws(()=>projectGeographicOutline({type:"Point",coordinates:[0,0]},bounds),/no polygon/);
  assert.throws(()=>projectGeographicOutline({type:"Polygon",coordinates:[[[0,NaN],[1,0],[0,1]]]},bounds),/Invalid/);
  assert.throws(()=>projectGeographicOutline(geometry,{...bounds,maxLon:.1}),/cuts/);
});
test("a fine overlay touching one mesh vertex no longer colours the surrounding terrain triangle",()=>{
  const mesh=buildRadialMedalMesh({diameterMm:20,rings:2,segments:16,regionAt:(x,y)=>Math.hypot(x,y)<.001?2:0});
  assert.ok(mesh.triangles.every(t=>t.region===0));
});
test("automatic logo placement avoids occupied space and respects notches and holes",()=>{
  const polygons=[[square(-.9,-.9,1.8),square(-.15,-.15,.3)]],inside=(x,y)=>insidePolygons(x,y,polygons);
  const choice=findEmptyLogoPlacement({widthMm:15,diameterMm:100,rotation:30},inside,(x)=>x<0?10:0);
  assert.ok(choice.x>0);assert.ok(footprintFits(logoFootprint({...choice,widthMm:15,diameterMm:100,rotation:30}),inside));
  assert.equal(footprintFits(logoFootprint({widthMm:50,diameterMm:100}),inside),false);
  assert.equal(findEmptyLogoPlacement({widthMm:300,diameterMm:100},inside,()=>0),null);
});
test("GLB embeds the exact official PNG and texture coordinates without requiring external URLs",()=>{
  const mesh=buildOutlineHeightfieldMesh({polygons:[[square(-.2,-.2,.4)]],radiusMm:10,heightAt:()=>1,regionAt:()=>1,stepMm:1});
  const png=new Uint8Array([137,80,78,71,13,10,26,10]);
  const bytes=encodeGlb(mesh,{materials:[{name:"Terrain",color:"#333333FF"},{name:"Official logo",color:"#FFFFFFFF"}],texture:{region:1,png,uv:p=>({u:p.x/4+.5,v:.5-p.y/4})}}),view=new DataView(bytes.buffer),length=view.getUint32(12,true);
  const json=JSON.parse(new TextDecoder().decode(bytes.subarray(20,20+length)).trim());
  assert.equal(json.images[0].mimeType,"image/png");assert.equal(json.materials[1].pbrMetallicRoughness.baseColorTexture.index,0);
  assert.ok(json.meshes[0].primitives.filter(p=>p.material===1).every(p=>p.attributes.TEXCOORD_0!==undefined));
  const imageView=json.bufferViews[json.images[0].bufferView],binaryStart=20+length+8;
  assert.deepEqual(bytes.slice(binaryStart+imageView.byteOffset,binaryStart+imageView.byteOffset+imageView.byteLength),png);
});
