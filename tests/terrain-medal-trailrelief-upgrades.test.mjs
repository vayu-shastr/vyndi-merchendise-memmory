import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ROUTE_STYLES,
  expandBoundsByDistanceKm,
  formatDuration,
  formatElevationGain,
  gpxStatsLine,
  parseGpxText,
  productionDiameterMm,
  routeStyleGeometry
} from "../dist/terrain-medal-core.mjs";
import {
  alignmentSocketDepth,
  planTiledMap
} from "../dist/fabrication-extras-core.mjs";
import {
  buildCylinderMesh,
  meshEdgeUse
} from "../dist/print-model-core.mjs";

test("TrailRelief-derived route styles have explicit printable geometry contracts",()=>{
  assert.deepEqual(Object.keys(ROUTE_STYLES),["raised","engraved","inlay","color","none"]);
  assert.deepEqual(routeStyleGeometry("raised",1,.3),{style:"raised",visible:true,channelDepthMm:0,overlayRiseMm:1,colorRegion:false});
  assert.deepEqual(routeStyleGeometry("engraved",.4,.3),{style:"engraved",visible:true,channelDepthMm:.4,overlayRiseMm:0,colorRegion:false});
  assert.deepEqual(routeStyleGeometry("inlay",.5,.3),{style:"inlay",visible:true,channelDepthMm:.5,overlayRiseMm:.5,colorRegion:false});
  assert.deepEqual(routeStyleGeometry("color",1,.3),{style:"color",visible:true,channelDepthMm:0,overlayRiseMm:0,colorRegion:true});
  assert.deepEqual(routeStyleGeometry("none",1,.3),{style:"none",visible:false,channelDepthMm:0,overlayRiseMm:0,colorRegion:false});
});

test("route buffer can be specified in real kilometres instead of only percentage framing",()=>{
  const expanded=expandBoundsByDistanceKm({minLat:0,maxLat:1,minLon:10,maxLon:11},5);
  assert.ok(expanded.minLat<-.044&&expanded.minLat>-.046);
  assert.ok(expanded.maxLat>1.044&&expanded.maxLat<1.046);
  assert.ok(expanded.minLon<9.956&&expanded.minLon>9.954);
  assert.ok(expanded.maxLon>11.044&&expanded.maxLon<11.046);
});

test("GPX parser derives climb and timed ride statistics for automatic inscription",()=>{
  const gpx=parseGpxText('<gpx><trk><trkseg>'+
    '<trkpt lat="0" lon="0"><ele>100</ele><time>2026-01-01T00:00:00Z</time></trkpt>'+
    '<trkpt lat="0" lon="0.01"><ele>120</ele><time>2026-01-01T00:10:00Z</time></trkpt>'+
    '<trkpt lat="0" lon="0.02"><ele>115</ele><time>2026-01-01T00:20:00Z</time></trkpt>'+
    '</trkseg></trk></gpx>',"timed.gpx");
  assert.equal(gpx.elevationGainM,20);
  assert.equal(gpx.elapsedTimeSeconds,1200);
  assert.equal(gpx.movingTimeSeconds,1200);
  assert.equal(formatDuration(1200),"00:20:00");
  assert.equal(formatElevationGain(11400),"11,400 m");
  assert.equal(gpxStatsLine({distanceKm:1219,elevationGainM:11400,movingTimeSeconds:131160}),"1,219 KM · 11,400 M · 36:26:00");
});

test("production width override supports plaques and large-format terrain while preserving medal default",()=>{
  assert.equal(productionDiameterMm({diameter:4,modelWidthMm:0}),101.6);
  assert.equal(productionDiameterMm({diameter:4,modelWidthMm:300}),300);
  assert.equal(productionDiameterMm({diameter:4,modelWidthMm:900}),600);
});

test("alignment-puck tile joints provide matching half sockets and a watertight printable puck",()=>{
  const plan=planTiledMap({widthMm:400,heightMm:200,maxTileWidthMm:210,maxTileHeightMm:210,jointType:"pin"});
  assert.equal(plan.columns,2);
  assert.equal(plan.connectors.length,2);
  assert.ok(plan.connectors.every(connector=>connector.kind==="socket"));
  const tile=plan.tiles[0],connector=plan.connectors.find(item=>item.tile===tile.id);
  assert.ok(connector);
  assert.equal(alignmentSocketDepth(tile.widthMm/2,0,tile,connector,{diameterMm:8,depthMm:2}),2);
  assert.equal(alignmentSocketDepth(tile.widthMm/2-10,0,tile,connector,{diameterMm:8,depthMm:2}),0);
  const puck=buildCylinderMesh({diameterMm:7.7,heightMm:2,segments:48});
  const edges=meshEdgeUse(puck);
  assert.equal(edges.boundaryEdges,0);
  assert.equal(edges.nonManifoldEdges,0);
});

test("Terrain Medal exposes the six TrailRelief-derived production upgrades in the studio",()=>{
  const html=readFileSync(new URL("../dist/terrain-medal.html",import.meta.url),"utf8");
  const js=readFileSync(new URL("../dist/terrain-medal.js",import.meta.url),"utf8");
  for(const id of [
    "routeStyle","terrainExtentMode","routeBufferKm","modelWidthMm",
    "tileJointType","tileJointDiameter","tileJointDepth","tileJointClearance",
    "downloadPrintPackage"
  ]) assert.match(html,new RegExp(`id=["']${id}["']`),id);
  assert.match(js,/routeStyleGeometry/);
  assert.match(js,/expandBoundsByDistanceKm/);
  assert.match(js,/gpxStatsLine/);
  assert.match(js,/productionDiameterMm/);
  assert.match(js,/alignmentSocketDepth/);
  assert.match(js,/buildCylinderMesh/);
  assert.match(js,/PRINT_PACKAGE/);
  assert.match(js,/3MF\//);
  assert.match(js,/STL\//);
  assert.match(js,/DATA\/production-job\.json/);
  assert.match(js,/README_PRINT\.txt/);
});
