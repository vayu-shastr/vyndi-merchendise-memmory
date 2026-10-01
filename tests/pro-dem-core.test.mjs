import test from "node:test";
import assert from "node:assert/strict";
import {
  fillNoData,
  smoothRaster,
  resampleRasterBilinear,
  rasterStats,
  reconcileGpxElevations,
  adaptiveLargeFormatPlan,
  clipPolygonToRect,
  normalizeProjectionDefinition,
  classifyTerrainWorkload
} from "../dist/pro-dem-core.mjs";

test("NoData filling repairs isolated DEM holes without changing valid samples",()=>{
  const raster={width:3,height:3,data:new Float64Array([10,20,30,40,NaN,60,70,80,90])};
  const filled=fillNoData(raster,{passes:2});
  assert.equal(filled.data[0],10);
  assert.ok(Number.isFinite(filled.data[4]));
  assert.equal(filled.remainingNoData,0);
  assert.ok(filled.data[4]>=40&&filled.data[4]<=60);
});

test("DEM smoothing reduces spikes while preserving raster dimensions",()=>{
  const raster={width:3,height:3,data:new Float64Array([0,0,0,0,90,0,0,0,0])};
  const smoothed=smoothRaster(raster,{radius:1,passes:1});
  assert.equal(smoothed.width,3);assert.equal(smoothed.height,3);
  assert.ok(smoothed.data[4]<90);
  assert.ok(smoothed.data[4]>0);
});

test("bilinear DEM resampling preserves corners and interpolates center",()=>{
  const raster={width:2,height:2,data:new Float64Array([0,100,200,300])};
  const out=resampleRasterBilinear(raster,3,3);
  assert.equal(out.data[0],0);
  assert.equal(out.data[2],100);
  assert.equal(out.data[6],200);
  assert.equal(out.data[8],300);
  assert.ok(Math.abs(out.data[4]-150)<1e-9);
});

test("raster statistics ignore NaN and report robust elevation span",()=>{
  const stats=rasterStats({width:3,height:2,data:new Float64Array([100,110,NaN,130,140,150])});
  assert.deepEqual(stats,{count:5,noData:1,min:100,max:150,mean:126});
});

test("GPX elevation reconciliation supports DEM, GPX and bounded blend modes",()=>{
  const points=[
    {lat:10,lon:76,ele:120,segment:1},
    {lat:10.1,lon:76.1,ele:180,segment:1},
    {lat:10.2,lon:76.2,ele:null,segment:1}
  ];
  const dem=(lat)=>lat<10.05?100:lat<10.15?200:250;
  const demOnly=reconcileGpxElevations(points,dem,{mode:"dem"});
  const gpxOnly=reconcileGpxElevations(points,dem,{mode:"gpx"});
  const blend=reconcileGpxElevations(points,dem,{mode:"blend",blend:0.5,maxDeltaM:30});
  assert.deepEqual(demOnly.points.map(p=>p.reconciledEle),[100,200,250]);
  assert.deepEqual(gpxOnly.points.map(p=>p.reconciledEle),[120,180,250]);
  assert.deepEqual(blend.points.map(p=>p.reconciledEle),[110,190,250]);
  assert.equal(blend.diagnostics.withGpxElevation,2);
  assert.equal(blend.diagnostics.maxAbsDeltaM,20);
});

test("adaptive large-format plan respects target XY resolution and vertex budget by tiling",()=>{
  const plan=adaptiveLargeFormatPlan({widthMm:1000,heightMm:600,targetXyMm:.5,maxVerticesPerTile:120000,maxTileMm:300});
  assert.ok(plan.columns>=4);
  assert.ok(plan.rows>=2);
  assert.equal(plan.tiles.length,plan.columns*plan.rows);
  assert.ok(plan.tiles.every(tile=>tile.gridColumns*tile.gridRows<=120000));
  assert.ok(plan.tiles.every(tile=>tile.stepXmm<=.55&&tile.stepYmm<=.55));
  assert.ok(plan.totalEstimatedVertices>120000);
});


test("polygon clipping preserves the portion of a building footprint inside a terrain tile",()=>{
  const polygon=[{x:-10,y:-5},{x:10,y:-5},{x:10,y:5},{x:-10,y:5}];
  const clipped=clipPolygonToRect(polygon,{minX:0,maxX:8,minY:-3,maxY:3});
  assert.ok(clipped.length>=4);
  assert.ok(clipped.every(p=>p.x>=0&&p.x<=8&&p.y>=-3&&p.y<=3));
  const xs=clipped.map(p=>p.x),ys=clipped.map(p=>p.y);
  assert.equal(Math.min(...xs),0);assert.equal(Math.max(...xs),8);
  assert.equal(Math.min(...ys),-3);assert.equal(Math.max(...ys),3);
});


test("common WGS84 UTM EPSG codes resolve without external EPSG registry lookups",()=>{
  assert.equal(normalizeProjectionDefinition("EPSG:4326"),"EPSG:4326");
  assert.equal(normalizeProjectionDefinition("EPSG:3857"),"EPSG:3857");
  assert.match(normalizeProjectionDefinition("EPSG:32643"),/\+proj=utm \+zone=43 \+datum=WGS84/);
  assert.match(normalizeProjectionDefinition("EPSG:32756"),/\+proj=utm \+zone=56 \+south \+datum=WGS84/);
  assert.equal(normalizeProjectionDefinition("+proj=utm +zone=43 +datum=WGS84"),"+proj=utm +zone=43 +datum=WGS84");
});


test("terrain workload classifier establishes safe warning tiling and refusal envelopes",()=>{
  const safe=classifyTerrainWorkload({rasterWidth:1024,rasterHeight:1024,estimatedVertices:150000,deviceMemoryGb:8});
  const warn=classifyTerrainWorkload({rasterWidth:4096,rasterHeight:4096,estimatedVertices:1500000,deviceMemoryGb:8});
  const tile=classifyTerrainWorkload({rasterWidth:9000,rasterHeight:9000,estimatedVertices:6500000,deviceMemoryGb:8});
  const refuse=classifyTerrainWorkload({rasterWidth:18000,rasterHeight:18000,estimatedVertices:25000000,deviceMemoryGb:8});
  assert.equal(safe.action,"allow");
  assert.equal(warn.action,"warn");
  assert.equal(tile.action,"tile");
  assert.equal(refuse.action,"refuse");
  assert.ok(safe.estimatedPeakBytes < warn.estimatedPeakBytes);
  assert.ok(warn.estimatedPeakBytes < tile.estimatedPeakBytes);
  assert.ok(tile.estimatedPeakBytes < refuse.estimatedPeakBytes);
});

test("terrain workload classifier becomes more conservative on lower-memory devices",()=>{
  const input={rasterWidth:6000,rasterHeight:6000,estimatedVertices:3500000};
  const low=classifyTerrainWorkload({...input,deviceMemoryGb:4});
  const high=classifyTerrainWorkload({...input,deviceMemoryGb:16});
  const rank={allow:0,warn:1,tile:2,refuse:3};
  assert.ok(rank[low.action]>=rank[high.action]);
});
