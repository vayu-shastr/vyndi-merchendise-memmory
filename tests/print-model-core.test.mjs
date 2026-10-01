import { PRINTERS } from "../dist/terrain-medal-core.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import {
  buildRadialMedalMesh,
  mergeMeshes,
  buildExtrudedPolygonMesh,
  buildDisplayStandMesh,
  buildPrintValidationCoupon,
  encodeBinaryStl,
  encodeObj,
  encodeMtl,
  encodeGlb,
  encode3mf,
  meshEdgeUse,
  productionResolution,
  validateProductionProfile
} from "../dist/print-model-core.mjs";

test("radial medal mesh is watertight with a flat underside and circular wall",()=>{
  const mesh=buildRadialMedalMesh({
    diameterMm:100,
    baseMm:3,
    rings:8,
    segments:32,
    heightAt:(x,y)=>1+0.2*x+0.1*y,
    regionAt:(x,y)=>x<0?1:0
  });
  assert.ok(mesh.vertices.length>250);
  assert.ok(mesh.triangles.length>500);
  const edges=meshEdgeUse(mesh);
  assert.equal(edges.boundaryEdges,0);
  assert.equal(edges.nonManifoldEdges,0);
  assert.ok(mesh.vertices.every(v=>Number.isFinite(v.x)&&Number.isFinite(v.y)&&Number.isFinite(v.z)));
  const minZ=Math.min(...mesh.vertices.map(v=>v.z));
  assert.equal(minZ,0);
});

test("binary STL contains exactly one record per triangle",()=>{
  const mesh=buildRadialMedalMesh({diameterMm:76.2,baseMm:2.4,rings:4,segments:24,heightAt:()=>0.6});
  const bytes=encodeBinaryStl(mesh,{name:"VYNDI test"});
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  assert.equal(view.getUint32(80,true),mesh.triangles.length);
  assert.equal(bytes.byteLength,84+mesh.triangles.length*50);
});

test("3MF writer emits a valid stored ZIP package with millimetre mesh and material regions",()=>{
  const mesh=buildRadialMedalMesh({
    diameterMm:101.6,baseMm:3.2,rings:4,segments:24,
    heightAt:()=>0.8,
    regionAt:(x,y)=>x<-.25?1:x>.25?2:3
  });
  const bytes=encode3mf(mesh,{
    title:"VYNDI Terrain Medal",
    materials:[
      {name:"Terrain",color:"#30363AFF"},
      {name:"Water",color:"#2F9BC1FF"},
      {name:"Route",color:"#FF5C35FF"},
      {name:"Annotations",color:"#B8F229FF"}
    ]
  });
  assert.equal(bytes[0],0x50);
  assert.equal(bytes[1],0x4b);
  const text=new TextDecoder().decode(bytes);
  assert.match(text,/\[Content_Types\]\.xml/);
  assert.match(text,/3D\/3dmodel\.model/);
  assert.match(text,/unit="millimeter"/);
  assert.match(text,/displaycolor="#FF5C35FF"/);
  assert.match(text,/pid="1" p1="2"/);
});

test("production resolution scales with physical detail but remains browser-safe",()=>{
  const budget=productionResolution({diameterMm:101.6,minFeatureMm:.8,technology:"FDM"});
  assert.ok(budget.rings>=100);
  assert.ok(budget.rings<=180);
  assert.equal(budget.segments%8,0);
  assert.ok(budget.segments>=budget.rings*3);
  const resin=productionResolution({diameterMm:101.6,minFeatureMm:.25,technology:"MSLA"});
  assert.ok(resin.rings>=budget.rings);
  assert.ok(resin.rings<=180);
  assert.ok(resin.segments<=720);
});

test("production profile validation distinguishes bed fit, feature width and relief requirements",()=>{
  const profile={label:"Budget FDM",technology:"FDM",bed:[180,180,180],minFeature:.8,minEmboss:.3,formats:["STL","3MF"]};
  assert.deepEqual(validateProductionProfile(profile,{diameterMm:101.6,routeWidthMm:1.2,routeRiseMm:.6,totalHeightMm:8}),[]);
  assert.ok(validateProductionProfile(profile,{diameterMm:190,routeWidthMm:.5,routeRiseMm:.1,totalHeightMm:8}).length>=3);
});


test("printer registry spans budget FDM, multicolour prosumer, professional FDM and high-resolution resin",()=>{
  for(const id of [
    "generic-fdm",
    "creality-ender3-v3",
    "bambu-a1-mini",
    "bambu-p1s-ams",
    "prusa-mk4s-mmu3",
    "prusa-core-one",
    "prusa-xl-5t",
    "ultimaker-s7",
    "raise3d-pro3-plus",
    "generic-resin",
    "elegoo-saturn4-ultra16k",
    "anycubic-m7-pro",
    "formlabs-form4",
    "formlabs-form4l",
    "formlabs-fuse1-plus"
  ]) assert.ok(PRINTERS[id],`missing printer profile ${id}`);
  assert.equal(PRINTERS["bambu-p1s-ams"].bed[0],256);
  assert.equal(PRINTERS["bambu-a1-mini"].bed[0],180);
  assert.equal(PRINTERS["prusa-core-one"].bed[0],250);
  assert.equal(PRINTERS["formlabs-form4"].technology,"MSLA");
  assert.ok(PRINTERS["anycubic-m7-pro"].layerRange[0]<=.01);
  assert.ok(PRINTERS["raise3d-pro3-plus"].bed[2]>=600);
  assert.equal(PRINTERS["creality-ender3-v3"].bed[0],220);
  assert.equal(PRINTERS["prusa-xl-5t"].colours,5);
});

test("every 3D printer profile declares feature limits, emboss limits, preferred format and provenance",()=>{
  for(const profile of Object.values(PRINTERS).filter(item=>item.productionKind!=="2d")){
    assert.ok(profile.minFeature>0,`${profile.label} minFeature`);
    assert.ok(profile.minEmboss>0,`${profile.label} minEmboss`);
    assert.ok(["STL","3MF"].includes(profile.preferredFormat),`${profile.label} preferred format`);
    assert.match(profile.sourceUrl,/^https:\/\//,`${profile.label} source URL`);
  }
});


test("extruded building polygon creates a watertight volumetric solid above terrain",()=>{
  const footprint=[{x:0,y:0},{x:12,y:0},{x:12,y:8},{x:7,y:8},{x:7,y:4},{x:0,y:4}];
  const mesh=buildExtrudedPolygonMesh({points:footprint,baseZAt:(x,y)=>3+.01*x+.02*y,heightMm:6,region:7});
  const edges=meshEdgeUse(mesh);
  assert.equal(edges.boundaryEdges,0);
  assert.equal(edges.nonManifoldEdges,0);
  assert.ok(Math.max(...mesh.vertices.map(v=>v.z))>9);
  assert.ok(mesh.triangles.every(t=>Number.isInteger(t.a)&&Number.isInteger(t.b)&&Number.isInteger(t.c)));
});

test("OBJ and MTL exporters preserve geometry and material region names",()=>{
  const mesh=buildRadialMedalMesh({diameterMm:60,baseMm:2,rings:3,segments:16,heightAt:()=>.4,regionAt:(x)=>x>0?2:0});
  const materials=[{name:"Terrain",color:"#343A3E"},{name:"Route",color:"#FF5C35"},{name:"Labels",color:"#B8F229"}];
  const obj=encodeObj(mesh,{name:"VYNDI test",materials,mtlFile:"vyndi.mtl"});
  const mtl=encodeMtl(materials);
  assert.match(obj,/^mtllib vyndi\.mtl/m);
  assert.match(obj,/^v /m);
  assert.match(obj,/^f /m);
  assert.match(obj,/usemtl Terrain/);
  assert.match(obj,/usemtl Labels|usemtl Route/);
  assert.match(mtl,/newmtl Terrain/);
  assert.match(mtl,/Kd /);
});

test("GLB exporter follows glTF 2.0 binary header and embeds material regions",()=>{
  const mesh=buildRadialMedalMesh({diameterMm:60,baseMm:2,rings:3,segments:16,heightAt:()=>.4,regionAt:(x)=>x>0?2:0});
  const bytes=encodeGlb(mesh,{title:"VYNDI test",materials:[
    {name:"Terrain",color:"#343A3EFF"},{name:"Water",color:"#2F9BC1FF"},{name:"Route",color:"#FF5C35FF"}
  ]});
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  assert.equal(view.getUint32(0,true),0x46546c67);
  assert.equal(view.getUint32(4,true),2);
  assert.equal(view.getUint32(8,true),bytes.byteLength);
  const jsonLength=view.getUint32(12,true);
  assert.equal(view.getUint32(16,true),0x4e4f534a);
  const json=JSON.parse(new TextDecoder().decode(bytes.slice(20,20+jsonLength)).trim());
  assert.equal(json.asset.version,"2.0");
  assert.ok(json.meshes[0].primitives.length>=2);
  assert.equal(json.materials[2].name,"Route");
});

test("physical slicer validation coupon is watertight and includes graded features",()=>{
  const coupon=buildPrintValidationCoupon({technology:"FDM",nozzleMm:.4,minFeatureMm:.8,minEmbossMm:.3});
  const edges=meshEdgeUse(coupon.mesh);
  assert.equal(edges.boundaryEdges,0);
  assert.equal(edges.nonManifoldEdges,0);
  assert.ok(coupon.features.some(f=>f.kind==="raised-line"&&f.widthMm<.8));
  assert.ok(coupon.features.some(f=>f.kind==="raised-line"&&f.widthMm>=.8));
  assert.ok(coupon.features.some(f=>f.kind==="emboss"&&f.heightMm>=.3));
  assert.ok(coupon.manifest.requiredChecks.includes("thin-feature"));
  assert.ok(coupon.manifest.requiredChecks.includes("material-region"));
});


test("large mesh merging does not overflow the JavaScript argument stack",()=>{
  const count=180000;
  const vertices=Array.from({length:count},(_,i)=>({x:i%600,y:Math.floor(i/600),z:(i%17)*0.01}));
  const triangles=[];
  for(let i=0;i+2<count;i+=3)triangles.push({a:i,b:i+1,c:i+2,region:0});
  const merged=mergeMeshes([{vertices,triangles}]);
  assert.equal(merged.vertices.length,vertices.length);
  assert.equal(merged.triangles.length,triangles.length);
  assert.equal(merged.triangles.at(-1).c,triangles.at(-1).c);
});

test("GLB export computes bounds for production-sized meshes without argument-stack overflow",()=>{
  const count=180000;
  const vertices=Array.from({length:count},(_,i)=>({x:(i%1200)-600,y:Math.floor(i/1200),z:(i%23)*0.02}));
  const triangles=[];
  for(let i=0;i+2<count;i+=3)triangles.push({a:i,b:i+1,c:i+2,region:0});
  const bytes=encodeGlb({vertices,triangles},{title:"PQ1 large mesh",materials:[{name:"Terrain",color:"#343A3EFF"}]});
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  assert.equal(view.getUint32(0,true),0x46546c67);
  assert.equal(view.getUint32(8,true),bytes.byteLength);
});


test("display stand supports a permanent underside watermark depth field and remains watertight",()=>{
  const stand=buildDisplayStandMesh({
    medalDiameterMm:100,
    thicknessMm:4,
    bottomAt:(x,y)=>(Math.abs(x)<12&&Math.abs(y)<5)?.35:0
  });
  const edges=meshEdgeUse(stand);
  assert.equal(edges.boundaryEdges,0);
  assert.equal(edges.nonManifoldEdges,0);
  assert.ok(stand.vertices.some(v=>v.z>0&&v.z<.5));
});
