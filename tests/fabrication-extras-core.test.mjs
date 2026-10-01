import test from "node:test";
import assert from "node:assert/strict";
import {
  FABRICATION_SHAPES,
  shapeBoundaryRadius,
  contourEmbossHeight,
  magnetPocketDepth,
  rasterSampler,
  parseArcAsciiGrid,
  sampleArcAsciiGrid,
  planTiledMap,
  dovetailKeyProfile,
  dovetailSlotDepth
} from "../dist/fabrication-extras-core.mjs";
import {
  buildRadialMedalMesh,
  buildRectangularHeightfieldMesh,
  buildDisplayStandMesh,
  buildAnnulusMesh,
  buildDovetailKeyMesh,
  encodeArtifactZip,
  mergeMeshes,
  meshEdgeUse
} from "../dist/print-model-core.mjs";

test("fabrication shape registry includes the requested TrailPrint-style shape set",()=>{
  assert.deepEqual(Object.keys(FABRICATION_SHAPES),["circle","square","ellipse","hexagon","octagon","heart"]);
});

test("shape boundary radii are finite and bounded for all supported shapes",()=>{
  for(const shape of Object.keys(FABRICATION_SHAPES)){
    const radii=Array.from({length:96},(_,i)=>shapeBoundaryRadius(shape,i/96*Math.PI*2,{aspect:1.35}));
    assert.ok(radii.every(value=>Number.isFinite(value)&&value>0.3&&value<1.6),shape);
  }
  assert.equal(Number(shapeBoundaryRadius("circle",0).toFixed(6)),1);
  assert.ok(shapeBoundaryRadius("square",Math.PI/4)>shapeBoundaryRadius("square",0));
  assert.ok(shapeBoundaryRadius("ellipse",Math.PI/2,{aspect:1.5})<shapeBoundaryRadius("ellipse",0,{aspect:1.5}));
});

test("contour emboss only rises near configured relief intervals",()=>{
  assert.ok(Math.abs(contourEmbossHeight(1.01,{enabled:true,intervalMm:1,widthMm:.08,riseMm:.22})-.1925)<1e-9);
  assert.equal(contourEmbossHeight(1.5,{enabled:true,intervalMm:1,widthMm:.08,riseMm:.22}),0);
  assert.equal(contourEmbossHeight(1,{enabled:false,intervalMm:1,widthMm:.08,riseMm:.22}),0);
});

test("magnet pockets apply only inside configured circular recesses",()=>{
  const pockets=[{xMm:-15,yMm:0,diameterMm:8,depthMm:2},{xMm:15,yMm:0,diameterMm:8,depthMm:2}];
  assert.equal(magnetPocketDepth(-15,0,pockets),2);
  assert.equal(magnetPocketDepth(15,0,pockets),2);
  assert.equal(magnetPocketDepth(0,0,pockets),0);
});

test("raster sampler converts alpha or luminance into normalized emboss/height values",()=>{
  const rgba=new Uint8ClampedArray([
    0,0,0,0, 255,255,255,255,
    128,128,128,255, 64,64,64,255
  ]);
  const alpha=rasterSampler({data:rgba,width:2,height:2},{channel:"alpha"});
  const lum=rasterSampler({data:rgba,width:2,height:2},{channel:"luminance"});
  assert.equal(alpha(-1,1),0);
  assert.equal(alpha(1,1),1);
  assert.ok(lum(-1,-1)>.49&&lum(-1,-1)<.51);
});

test("Arc ASCII Grid parser and sampler support high-resolution DEM fallback",()=>{
  const grid=parseArcAsciiGrid([
    "ncols 3","nrows 2","xllcorner 10","yllcorner 20","cellsize 0.5","NODATA_value -9999",
    "100 200 300","400 500 600"
  ].join("\n"));
  assert.equal(grid.ncols,3);assert.equal(grid.nrows,2);
  assert.equal(sampleArcAsciiGrid(grid,20.75,10.25),100);
  assert.equal(sampleArcAsciiGrid(grid,20.25,11.25),600);
  const mid=sampleArcAsciiGrid(grid,20.5,10.5);
  assert.ok(mid>100&&mid<600);
});

test("tiling planner creates bounded tiles and alternating dovetail connector assignments",()=>{
  const plan=planTiledMap({widthMm:500,heightMm:300,maxTileWidthMm:220,maxTileHeightMm:220,dovetail:true});
  assert.equal(plan.columns,3);
  assert.equal(plan.rows,2);
  assert.equal(plan.tiles.length,6);
  assert.ok(plan.tiles.every(tile=>tile.widthMm<=220&&tile.heightMm<=220));
  assert.ok(plan.connectors.length>0);
  assert.ok(plan.connectors.some(c=>c.kind==="male"));
  assert.ok(plan.connectors.some(c=>c.kind==="female"));
  const profile=dovetailKeyProfile({neckMm:5,headMm:8,depthMm:4});
  assert.equal(profile.length,4);
  assert.ok(profile[1].x<profile[2].x);
});

test("radial production mesh supports multiple outer shapes and bottom recess/engraving surface",()=>{
  const mesh=buildRadialMedalMesh({
    diameterMm:100,baseMm:3,rings:12,segments:64,shape:"hexagon",
    heightAt:()=>.6,
    bottomAt:(x,y)=>Math.hypot(x,y)<.25?.8:0
  });
  const edges=meshEdgeUse(mesh);
  assert.equal(edges.boundaryEdges,0);
  assert.equal(edges.nonManifoldEdges,0);
  assert.ok(mesh.vertices.some(v=>v.z===.8));
});

test("hanging loop annulus and display stand are independently watertight printable meshes",()=>{
  const loop=buildAnnulusMesh({outerRadiusMm:7,innerRadiusMm:3,heightMm:3,centerX:0,centerY:52,segments:64});
  const stand=buildDisplayStandMesh({medalDiameterMm:101.6,thicknessMm:4});
  for(const mesh of [loop,stand]){
    const edges=meshEdgeUse(mesh);
    assert.equal(edges.boundaryEdges,0);
    assert.equal(edges.nonManifoldEdges,0);
    assert.ok(mesh.triangles.length>20);
  }
  const merged=mergeMeshes([loop,stand]);
  assert.equal(merged.triangles.length,loop.triangles.length+stand.triangles.length);
});


test("rectangular terrain tile and dovetail key are watertight printable meshes",()=>{
  const tile=buildRectangularHeightfieldMesh({
    widthMm:80,heightMm:60,baseMm:3,columns:12,rows:10,
    heightAt:(x,y)=>.5+.003*x+.002*y,
    bottomAt:(x,y)=>Math.abs(x)<6&&y>20?.8:0
  });
  const key=buildDovetailKeyMesh({lengthMm:16,headWidthMm:8,neckWidthMm:5,heightMm:2.4});
  for(const mesh of [tile,key]){
    const edges=meshEdgeUse(mesh);
    assert.equal(edges.boundaryEdges,0);
    assert.equal(edges.nonManifoldEdges,0);
  }
});

test("tile artifact ZIP stores printable tile files plus manifest",()=>{
  const bytes=encodeArtifactZip([
    {name:"manifest.json",data:'{"tiles":2}'},
    {name:"tile-1.stl",data:new Uint8Array([1,2,3])},
    {name:"dovetail-key.stl",data:new Uint8Array([4,5])}
  ]);
  assert.deepEqual(Array.from(bytes.slice(0,4)),[0x50,0x4b,0x03,0x04]);
  const text=new TextDecoder().decode(bytes);
  assert.match(text,/manifest\.json/);
  assert.match(text,/tile-1\.stl/);
  assert.match(text,/dovetail-key\.stl/);
});


test("dovetail slot depth creates matching underside recesses at tile seams",()=>{
  const tile={widthMm:100,heightMm:80};
  const options={lengthMm:16,headWidthMm:8,neckWidthMm:5,depthMm:2};
  assert.equal(dovetailSlotDepth(50,0,tile,{side:"right"},options),2);
  assert.equal(dovetailSlotDepth(43,0,tile,{side:"right"},options),2);
  assert.equal(dovetailSlotDepth(30,0,tile,{side:"right"},options),0);
  assert.equal(dovetailSlotDepth(0,40,tile,{side:"top"},options),2);
});
