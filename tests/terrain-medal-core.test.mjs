import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { VIEWER_LIMITS, adaptiveWaterCells, adaptivePlaceLabelBudget, adaptiveRoadRenderBudget, balanceBoundsForMapContext, cellWaterState, clampPointToRadius, eventNameFromGpxFilename, expandBoundsByMargin, formatRouteDistance, inferEventPresetFromFilename, makeJob, mapContextBounds, mapContextLabel, mapFrameSize, medalCoverageBounds, medalDiameterMm, nextViewerZoom, normalizeElevationRange, parseGpxText, mergeGpxRoutes, sampleTerrariumBilinear, physicalReliefMm, placeLabelFontSize, projectGpxPoints, routePreviewLift, routeShadowWidthForExaggeration, routeWidthMultiplierForExaggeration, roadPrintPolicy, selectPrintPlaces, validateLocalFileMeta, validateDesign, viewerBoundsFromZoom } from "../dist/terrain-medal-core.mjs";

const base={event:"pbp2023",eventName:"Paris–Brest–Paris 2023",participant:"Shyam Sundhar",bib:"I277",distance:"1,219 km",map:"pbp",printer:"bambu-p1s-ams",diameter:4,exaggeration:5,reliefLimit:4,base:3.2,routeWidth:1.2,routeRise:1,totalHeight:8.2};
test("standard medal diameters are converted exactly",()=>{assert.equal(medalDiameterMm(3),76.2);assert.equal(medalDiameterMm(4),101.6)});
test("visual exaggeration never exceeds physical relief limit",()=>{assert.equal(physicalReliefMm({exaggeration:10,reliefLimit:4}),4);assert.ok(physicalReliefMm({exaggeration:2,reliefLimit:4})<4)});
test("P1S profile accepts a four-inch medal with printable route",()=>{assert.deepEqual(validateDesign(base),{status:"ready",warnings:[]})});
test("P1S profile rejects an effectively zero route rise instead of reporting READY",()=>{const result=validateDesign({...base,routeRise:.001,totalHeight:7.201});assert.equal(result.status,"review");assert.ok(result.warnings.some(w=>/route rise/i.test(w)&&/0\.3 mm/.test(w)))});
test("P1S profile flags sub-nozzle-derived detail",()=>{const result=validateDesign({...base,routeWidth:.5});assert.equal(result.status,"review");assert.match(result.warnings[0],/0.8 mm/)});
test("GPX parser extracts track points, elevation and bounds",()=>{const gpx=parseGpxText('<gpx><trk><trkseg><trkpt lat="48.1" lon="2.1"><ele>42</ele></trkpt><trkpt lat="48.2" lon="2.4"><ele>58</ele></trkpt></trkseg></trk></gpx>',"pbp.gpx");assert.equal(gpx.points.length,2);assert.deepEqual(gpx.bounds,{minLat:48.1,maxLat:48.2,minLon:2.1,maxLon:2.4,minEle:42,maxEle:58})});
test("GPX parser accepts longitude before latitude",()=>{const gpx=parseGpxText('<gpx><rte><rtept lon="76.2" lat="10.5"><ele>3</ele></rtept><rtept lon="76.3" lat="10.6" /></rte></gpx>');assert.equal(gpx.points.length,2);assert.equal(gpx.points[0].lon,76.2)});
test("GPX parser prefers track geometry when the file also contains a duplicate route copy",()=>{const gpx=parseGpxText('<gpx><trk><trkseg><trkpt lat="0" lon="0"/><trkpt lat="0" lon="1"/></trkseg></trk><rte><rtept lat="10" lon="10"/><rtept lat="10" lon="11"/></rte></gpx>');assert.equal(gpx.sourcePointCount,2);assert.equal(gpx.points.length,2);assert.deepEqual(gpx.bounds,{minLat:0,maxLat:0,minLon:0,maxLon:1,minEle:0,maxEle:0});assert.ok(gpx.distanceKm>111&&gpx.distanceKm<112)});
test("GPX parser preserves separate track segments",()=>{const gpx=parseGpxText('<gpx><trk><trkseg><trkpt lat="48" lon="2"/><trkpt lat="48.1" lon="2.1"/></trkseg><trkseg><trkpt lat="49" lon="3"/><trkpt lat="49.1" lon="3.1"/></trkseg></trk></gpx>');assert.equal(gpx.segmentCount,2);assert.deepEqual(gpx.points.map(p=>p.segment),[1,1,2,2])});
test("geographic projection preserves longitude scale at PBP latitude",()=>{const gpx={bounds:{minLat:48,maxLat:49,minLon:-4,maxLon:2},points:[{lat:48,lon:-4,segment:1},{lat:49,lon:2,segment:1}]};const points=projectGpxPoints(gpx);const width=Math.abs(points[1].x-points[0].x);const height=Math.abs(points[1].y-points[0].y);assert.ok(width>height);assert.ok(width/height>3.8&&width/height<4.2)});
test("uploaded GPX identity does not inherit the default PBP preset",()=>{assert.equal(inferEventPresetFromFilename("Paris_Brest_Paris_2023.gpx"),"pbp2023");assert.equal(inferEventPresetFromFilename("K2K_2025.gpx"),"k2k2025");assert.equal(inferEventPresetFromFilename("Parvatha_600_Super_Grande_Randonnee_8000_meters_elevation_R1000_Qualifier.gpx"),"custom");assert.equal(eventNameFromGpxFilename("Parvatha_600_Super_Grande_Randonnee_8000_meters_elevation_R1000_Qualifier.gpx"),"Parvatha 600 Super Grande Randonnee")});
test("GPX parser calculates segment-aware route distance for uploaded-event truth",()=>{const gpx=parseGpxText('<gpx><trk><trkseg><trkpt lat="0" lon="0"/><trkpt lat="0" lon="1"/></trkseg><trkseg><trkpt lat="10" lon="10"/><trkpt lat="10" lon="11"/></trkseg></trk></gpx>');assert.ok(gpx.distanceKm>219&&gpx.distanceKm<221);assert.equal(formatRouteDistance(599.6),"600 km");assert.equal(formatRouteDistance(42.18),"42.2 km")});
test("custom and marathon regional context are wider than event-focus route bounds",()=>{const route={minLat:12,maxLat:14,minLon:74,maxLon:76};const custom=mapContextBounds("custom",route);assert.ok(custom.minLat<route.minLat&&custom.maxLat>route.maxLat&&custom.minLon<route.minLon&&custom.maxLon>route.maxLon);assert.equal(mapContextLabel("custom"),"Regional context");assert.equal(mapContextLabel("pbp2023"),"France context")});
test("water classification is decided once per mesh cell and medal-edge points clamp smoothly",()=>{assert.equal(cellWaterState([true,true,true,false]),true);assert.equal(cellWaterState([true,true,false,false]),false);assert.deepEqual(clampPointToRadius({x:2,y:0},1),{x:1,y:0});const diagonal=clampPointToRadius({x:2,y:2},1);assert.ok(Math.abs(Math.hypot(diagonal.x,diagonal.y)-1)<1e-9)});
test("adaptive coastline refinement leaves uniform terrain coarse but recursively resolves mixed shoreline cells",()=>{const uniform=adaptiveWaterCells({x0:0,y0:0,x1:1,y1:1},()=>false,3);assert.equal(uniform.length,1);assert.equal(uniform[0].water,false);const coast=adaptiveWaterCells({x0:0,y0:0,x1:1,y1:1},(x)=>x<.47,3);assert.ok(coast.length>8);const boundaryLeaves=coast.filter(cell=>cell.boundary);assert.ok(boundaryLeaves.length>0);assert.ok(boundaryLeaves.every(cell=>cell.x1-cell.x0<=.1250001));assert.ok(coast.some(cell=>cell.water)&&coast.some(cell=>!cell.water))});
test("PBP uses a metropolitan-France context frame instead of stretching the route across the entire medal",()=>{const routeBounds={minLat:47.7,maxLat:49.2,minLon:-4.6,maxLon:2.3};const frame=mapContextBounds("pbp2023",routeBounds);assert.ok(frame.minLat<43);assert.ok(frame.maxLat>51);assert.ok(frame.minLon<-5);assert.ok(frame.maxLon>9);assert.equal(mapFrameSize("pbp2023"),1.85);const gpx={bounds:routeBounds,points:[{lat:48.4,lon:-4.5,segment:1},{lat:48.85,lon:2.2,segment:1}]};const projected=projectGpxPoints(gpx,1.45,frame);assert.ok(Math.abs(projected[1].x-projected[0].x)<1.0);assert.ok(Math.abs(projected[1].x-projected[0].x)>.45)});
test("non-PBP regional context remains centered on the route while expanding it",()=>{const routeBounds={minLat:10,maxLat:11,minLon:76,maxLon:77};const context=mapContextBounds("custom",routeBounds);assert.equal((context.minLat+context.maxLat)/2,10.5);assert.equal((context.minLon+context.maxLon)/2,76.5);assert.ok(context.minLat<10&&context.maxLat>11&&context.minLon<76&&context.maxLon>77)});
test("GPX projection is north-up inside a geographic context frame",()=>{const frame={minLat:41,maxLat:52,minLon:-6,maxLon:10};const gpx={bounds:frame,points:[{lat:43,lon:2,segment:1},{lat:51,lon:2,segment:1}]};const p=projectGpxPoints(gpx,1.85,frame);assert.ok(p[1].y>p[0].y)});
test("medal coverage bounds expand beyond GPX so the full circular footprint uses real geographic data",()=>{const b={minLat:47.7,maxLat:49.2,minLon:-4.6,maxLon:2.3};const expanded=medalCoverageBounds(b);assert.ok(expanded.minLon<b.minLon);assert.ok(expanded.maxLon>b.maxLon);assert.ok(expanded.minLat<b.minLat);assert.ok(expanded.maxLat>b.maxLat);assert.equal(Number(((expanded.minLon+expanded.maxLon)/2).toFixed(6)),Number(((b.minLon+b.maxLon)/2).toFixed(6)));assert.equal(Number(((expanded.minLat+expanded.maxLat)/2).toFixed(6)),Number(((b.minLat+b.maxLat)/2).toFixed(6)))});
test("event-focus map context expands the short projected dimension so GPX uploads do not collapse into a thin strip",()=>{const route={minLat:48,maxLat:49,minLon:-4,maxLon:2},margin=expandBoundsByMargin(route,18),balanced=balanceBoundsForMapContext(margin,1.8),midLat=(balanced.minLat+balanced.maxLat)/2,ratio=((balanced.maxLon-balanced.minLon)*Math.cos(midLat*Math.PI/180))/(balanced.maxLat-balanced.minLat);assert.ok(ratio<=1.80001);assert.equal(Number(((balanced.minLat+balanced.maxLat)/2).toFixed(6)),48.5);assert.equal(Number(((balanced.minLon+balanced.maxLon)/2).toFixed(6)),-1);assert.ok(balanced.minLat<47.2);assert.ok(balanced.maxLat>49.8)});
test("balanced event focus also expands longitude for a tall north-south route",()=>{const tall={minLat:8,maxLat:20,minLon:77,maxLon:78},balanced=balanceBoundsForMapContext(tall,1.8),midLat=(balanced.minLat+balanced.maxLat)/2,projectedWidth=(balanced.maxLon-balanced.minLon)*Math.cos(midLat*Math.PI/180),height=balanced.maxLat-balanced.minLat;assert.ok(height/projectedWidth<=1.80001);assert.ok(balanced.minLon<74.2);assert.ok(balanced.maxLon>80.8)});
test("event-focus printable bounds expand GPX geography by the selected per-side margin",()=>{const route={minLat:48,maxLat:49,minLon:-4,maxLon:2};assert.deepEqual(expandBoundsByMargin(route,18),{minLat:47.82,maxLat:49.18,minLon:-5.08,maxLon:3.08});assert.deepEqual(expandBoundsByMargin(route,0),route)});
test("current viewer zoom becomes a geographic crop only when explicitly committed",()=>{const bounds={minLat:42,maxLat:52,minLon:-6,maxLon:10};assert.deepEqual(viewerBoundsFromZoom(bounds,2),{minLat:44.5,maxLat:49.5,minLon:-2,maxLon:6});assert.deepEqual(viewerBoundsFromZoom(bounds,1),bounds);assert.deepEqual(viewerBoundsFromZoom(bounds,10),{minLat:45.75,maxLat:48.25,minLon:0,maxLon:4})});
test("place label sizing remains readable when zoomed out or highly tilted without becoming oversized",()=>{assert.equal(placeLabelFontSize('city',1,0),12);assert.ok(placeLabelFontSize('city',.65,1.3)>12);assert.ok(placeLabelFontSize('town',.65,1.3)>10);assert.ok(placeLabelFontSize('village',1,0)<placeLabelFontSize('town',1,0));assert.ok(placeLabelFontSize('city',.65,1.45)<=17)});
test("viewer zoom permits close inspection without runaway scaling",()=>{assert.equal(nextViewerZoom(1, -120),1.18);assert.equal(nextViewerZoom(2.75,-120),2.8);assert.equal(nextViewerZoom(.7,120),.65);assert.equal(VIEWER_LIMITS.baseScale,.41)});
test("route preview lift decreases as terrain exaggeration rises so the route stays visually bonded",()=>{assert.equal(routePreviewLift(.5,1),.006);assert.equal(routePreviewLift(.5,10),.004);assert.ok(routePreviewLift(1,10)<routePreviewLift(1,1));assert.equal(routeShadowWidthForExaggeration(1),6);assert.equal(routeShadowWidthForExaggeration(10),4.38);assert.equal(routeWidthMultiplierForExaggeration(1),3.2);assert.equal(routeWidthMultiplierForExaggeration(10),2.66)});
test("terrain elevation normalization uses the loaded local DEM range instead of a hard-coded altitude ceiling",()=>{assert.equal(normalizeElevationRange(100,100,500),0);assert.equal(normalizeElevationRange(300,100,500),0.5);assert.equal(normalizeElevationRange(500,100,500),1);assert.equal(normalizeElevationRange(250,250,250),0)});
test("large GPX files are bounded for preview without losing source count or bounds",()=>{const count=100000;let body="<gpx><trk><trkseg>";for(let i=0;i<count;i++)body+=`<trkpt lat="${48+i/100000}" lon="${-4+i/50000}"><ele>${i%600}</ele></trkpt>`;body+="</trkseg></trk></gpx>";const gpx=parseGpxText(body,"large-pbp.gpx");assert.equal(gpx.sourcePointCount,count);assert.ok(gpx.points.length<=20000);assert.equal(gpx.bounds.minLat,48);assert.equal(gpx.bounds.maxEle,599);assert.equal(gpx.points.at(-1).lon,-4+(count-1)/50000)});
test("exported job carries event, participant-result, geography, printer and validation contracts",()=>{const config={...base,eventDate:"2026-08-16",eventLocation:"Brest, France",startDetail:"05:18",finishDetail:"17:44",elapsedTime:"36:26:00",resultStatus:"Finished",placing:"214",terrainEnvironment:"coastal",geography:{continent:"Europe",country:"France",region:"Brittany",city:"Brest",source:"OpenStreetMap / Nominatim"},eventSource:{source:"Wikidata",sourceUrl:"https://www.wikidata.org/wiki/Q1"},participantSource:{sourceUrl:"https://example.org/results"},printArea:{mode:"event-focus",marginPercent:18,bounds:{minLat:47.82,maxLat:49.18,minLon:-5.08,maxLon:3.08},frameSize:1.45}};const job=makeJob(config,null);assert.equal(job.schema,"vyndi.terrain-medal-job/v1");assert.equal(job.medal.diameterMm,101.6);assert.equal(job.production.label,"Bambu Lab P1S Combo");assert.equal(job.validation.status,"ready");assert.deepEqual(job.map.printArea,config.printArea);assert.equal(job.event.editionDate,"2026-08-16");assert.equal(job.event.location,"Brest, France");assert.equal(job.result.elapsed,"36:26:00");assert.equal(job.result.status,"Finished");assert.equal(job.result.placing,"214");assert.equal(job.geography.terrainEnvironment,"coastal");assert.equal(job.provenance.participant.sourceUrl,"https://example.org/results")});
test("exported job records the vector cartography source and required attribution",()=>{const job=makeJob(base,null);assert.equal(job.map.cartography.provider,"OpenFreeMap");assert.equal(job.map.cartography.schema,"OpenMapTiles");assert.match(job.map.cartography.attribution,/OpenStreetMap/)});
test("exported job uses procedural sea without storing ocean elevation",()=>{const job=makeJob({...base,waterMode:"procedural-waves",waveHeight:.3,wavelength:2.6},null);assert.deepEqual(job.water,{mode:"procedural-waves",shoreline:"geographic-vector-mask",storesOceanElevation:false,waveHeightMm:.3,wavelengthMm:2.6,separatePaintRegion:true})});
test("browser preview uses adaptive vector-coastline refinement and a smooth projected medal clip",()=>{const js=readFileSync(new URL("../dist/terrain-medal.js",import.meta.url),"utf8");assert.match(js,/const n=81,\s*cells=\[\]/);assert.match(js,/adaptiveWaterCells\(\{x0,y0,x1,y1\}/);assert.match(js,/maxDepth=3/);assert.match(js,/surfaceHeight\(x,y,c,cell\.water\)/);assert.match(js,/function traceMedalBoundary/);assert.match(js,/ctx\.clip\(\)/);assert.match(js,/routePreviewLift\(c\.routeRise,c\.exaggeration\)/)});
test("browser GPX auto-fit uses balanced regional event context rather than a thin route ribbon",()=>{const js=readFileSync(new URL("../dist/terrain-medal.js",import.meta.url),"utf8");assert.match(js,/balanceBoundsForMapContext\(expanded,1\.8\)/);assert.match(js,/event focus .*balanced context/i)});
test("browser upload flow replaces stale PBP identity with GPX-derived event and distance",()=>{const js=readFileSync(new URL("../dist/terrain-medal.js",import.meta.url),"utf8");assert.match(js,/inferEventPresetFromFilename\(first\.name\)/);assert.match(js,/fields\.distance\.value=formatRouteDistance\(gpx\.distanceKm\)/);assert.match(js,/mapContextLabel\(fields\.event\.value\)/)});
test("event-focus cartography requests high detail and renders labels across almost the full medal",()=>{const js=readFileSync(new URL("../dist/terrain-medal.js",import.meta.url),"utf8");assert.match(js,/detailMode=selectedGeo\|\|printAreaMode!=="regional-context"\?"high":"preview"/);assert.match(js,/maxPlaces:240/);assert.match(js,/maxRoads:650/);assert.match(js,/mapInside\(place\.x,place\.y,c\)/)});
test("rich map mode keeps high-detail tiles while reusing tile and mesh work",()=>{const js=readFileSync(new URL("../dist/terrain-medal.js",import.meta.url),"utf8");assert.match(js,/const terrainTileCache=new Map\(\),vectorTileCache=new Map\(\)/);assert.match(js,/for\(let start=0;start<jobs\.length;start\+=16\)/);assert.match(js,/maxPlaces:240/);assert.match(js,/maxRoads:650/);assert.match(js,/roadGrid:\{columns:8,rows:5\}/);assert.match(js,/detailMode=selectedGeo\|\|printAreaMode!=="regional-context"\?"high":"preview"/);assert.match(js,/let terrainMeshCache=null/);assert.match(js,/function invalidateTerrainMesh/);assert.match(js,/function buildTerrainMesh/);assert.doesNotMatch(js,/drawFeatureLines\(ctx,cartography\.roads[^\n]+true\)/)});
test("renderer uses major roads only and reserves screen space for labels",()=>{const js=readFileSync(new URL("../dist/terrain-medal.js",import.meta.url),"utf8");assert.match(js,/drawRoadHierarchy/);assert.match(js,/widths=\{motorway:1\.28,trunk:1\.08,primary:\.84\}/);assert.doesNotMatch(js,/tertiary:\{stroke:/);assert.doesNotMatch(js,/for\(const roadClass of \["tertiary"/);assert.match(js,/placeLabelFontSize\(place\.class,zoom,pitch\)/);assert.match(js,/maxPlaces:240/);assert.match(js,/maxRoads:650/);assert.match(js,/maxVisiblePlaceLabels=adaptivePlaceLabelBudget\(c\.diameter,zoom,pitch\)/);assert.match(js,/columns:12,rows:9/)});
test("terrain studio exposes global geography, event web discovery and participant result controls",()=>{const html=readFileSync(new URL("../dist/terrain-medal.html",import.meta.url),"utf8");for(const id of ["geoContinent","geoCountry","geoRegion","geoCity","terrainEnvironment","geoSearchButton","geoResults","eventWebSearch","eventWebCategory","eventWebSearchButton","eventWebResults","publicResultUrl","importPublicResult","eventDate","eventLocation","startDetail","finishDetail","elapsedTime","resultStatus","placing"])assert.match(html,new RegExp(`id=["']${id}["']`),`missing #${id}`)});
test("terrain studio controller can search geography without GPX and prints imported event metadata",()=>{const js=readFileSync(new URL("../dist/terrain-medal.js",import.meta.url),"utf8");assert.match(js,/\/api\/geo\/search/);assert.match(js,/\/api\/events\/search/);assert.match(js,/\/api\/events\/import-result/);assert.match(js,/buildMedalMetaLines\(c\)/);assert.match(js,/if\(!gpx\)return \[\]/);assert.match(js,/coverage=medalCoverageBounds\(frameBounds,frameSize,shapeRadius\*1\.03\)/)});
test("public Terrain Medal starts neutral rather than exposing one rider or PBP as the mandatory default",()=>{const html=readFileSync(new URL("../dist/terrain-medal.html",import.meta.url),"utf8");const js=readFileSync(new URL("../dist/terrain-medal.js",import.meta.url),"utf8");assert.doesNotMatch(html,/value="Shyam Sundhar"/);assert.doesNotMatch(html,/value="I277"/);assert.match(js,/fields\.event\.value="custom"; fields\.map\.value="uploaded"/);assert.match(js,/geoContinent\.value==="Worldwide"/)});
test("existing Ride Stories Event Finder uses the same global Worker event API",()=>{const html=readFileSync(new URL("../dist/index.html",import.meta.url),"utf8");assert.match(html,/name="vyndi-event-api-url" content="\/api\/events\/search"/)});
test("Terrain Medal does not draw a synthetic route when no GPX has been loaded",()=>{const js=readFileSync(new URL("../dist/terrain-medal.js",import.meta.url),"utf8");assert.match(js,/function routePoints\(\)\{\s*if\(gpx\)/);assert.match(js,/if\(!gpx\)return \[\]/);assert.doesNotMatch(js,/Array\.from\(\{length:90\}/)});
test("PBP saved preset carries edition date, event location and official source into the form",()=>{const core=readFileSync(new URL("../dist/terrain-medal-core.mjs",import.meta.url),"utf8");const js=readFileSync(new URL("../dist/terrain-medal.js",import.meta.url),"utf8");assert.match(core,/pbp2023: \{[^}]*date: "2023-08-20"[^}]*location: "Rambouillet, Île-de-France, France"/);assert.match(js,/if\(item\.date\)fields\.eventDate\.value=item\.date/);assert.match(js,/if\(item\.location\)fields\.eventLocation\.value=item\.location/)});
test("event search UI caps rendered candidate cards to avoid multi-page irrelevant result dumps",()=>{const js=readFileSync(new URL("../dist/terrain-medal.js",import.meta.url),"utf8");assert.match(js,/\(events\|\|\[\]\)\.slice\(0,8\)/)});
test("participant fields remain editable until an explicit result match is selected",()=>{const html=readFileSync(new URL("../dist/terrain-medal.html",import.meta.url),"utf8");const js=readFileSync(new URL("../dist/terrain-medal.js",import.meta.url),"utf8");assert.match(html,/id="participantMatches"/);assert.match(html,/id="importPublicResult"[^>]*>Find participant/);assert.doesNotMatch(js,/scheduleParticipantLookup/);assert.match(js,/fields\.participant\.addEventListener\("input",markParticipantSearchDirty\)/);assert.match(js,/fields\.bib\.addEventListener\("input",markParticipantSearchDirty\)/);assert.match(js,/function renderParticipantMatches/);assert.match(js,/data-use-participant/);assert.match(js,/function applyParticipantFacts/);assert.match(js,/participantMatches\.addEventListener\("click"/)});
test("PBP preset binds its public result source and canonical web selection switches to that preset",()=>{const core=readFileSync(new URL("../dist/terrain-medal-core.mjs",import.meta.url),"utf8");const js=readFileSync(new URL("../dist/terrain-medal.js",import.meta.url),"utf8");assert.match(core,/pbp2023: \{[^}]*resultUrl: "https:\/\/www\.audax-club-parisien\.com\/palmares-du-paris-brest-paris\/palmares-paris-brest-paris-randonneur-2023\//);assert.match(js,/publicResultUrl\.value=item\.resultUrl\|\|""/);assert.match(js,/const canonicalPbp=\/paris.*brest.*paris\/i\.test\(event\.name\)/);assert.match(js,/fields\.event\.value=canonicalPbp\?"pbp2023":"custom"/)});
test("studio markup contains every element required by the browser controller",()=>{const html=readFileSync(new URL("../dist/terrain-medal.html",import.meta.url),"utf8");const js=readFileSync(new URL("../dist/terrain-medal.js",import.meta.url),"utf8");for(const id of [...js.matchAll(/\$\("([A-Za-z][A-Za-z0-9]+)"\)/g)].map((m)=>m[1]))assert.match(html,new RegExp(`id=["']${id}["']`),`missing #${id}`)});

test("place labels are allocated densely across screen cells after 3D projection instead of globally rank-sorted",()=>{const js=readFileSync(new URL("../dist/terrain-medal.js",import.meta.url),"utf8");assert.match(js,/selectScreenPlacesSpatially/);assert.match(js,/maxPlaces:240/);assert.match(js,/placeGrid:\{columns:14,rows:10\}/);assert.match(js,/maxVisiblePlaceLabels=adaptivePlaceLabelBudget\(c\.diameter,zoom,pitch\)/);assert.match(js,/columns:12,rows:9/);assert.doesNotMatch(js,/ordered=\[\.\.\.\(places\|\|\[\]\)\]\.sort/)});

test("adaptive label budget gives 4-inch medals more names and increases capacity when zooming in",()=>{
  assert.ok(adaptivePlaceLabelBudget(4,1,0.9)>adaptivePlaceLabelBudget(3,1,0.9));
  assert.ok(adaptivePlaceLabelBudget(4,1.8,0.9)>adaptivePlaceLabelBudget(4,1,0.9));
  assert.ok(adaptivePlaceLabelBudget(3,0.65,1.4)>=100);
  assert.ok(adaptivePlaceLabelBudget(4,2.8,0.2)<=240);
});
test("adaptive road budget keeps only a bounded number of already-major roads and gives 4-inch medals more detail",()=>{
  assert.equal(adaptiveRoadRenderBudget(3),220);
  assert.equal(adaptiveRoadRenderBudget(4),320);
  assert.equal(adaptiveRoadRenderBudget(10),320);
});
test("renderer uses adaptive size/zoom budgets without reintroducing auxiliary roads",()=>{
  const js=readFileSync(new URL("../dist/terrain-medal.js",import.meta.url),"utf8");
  assert.match(js,/adaptivePlaceLabelBudget\(c\.diameter,zoom,pitch\)/);
  assert.match(js,/adaptiveRoadRenderBudget\(c\.diameter\)/);
  assert.doesNotMatch(js,/tertiary:\{stroke:/);
});


test("Terrain Medal exposes real print-model generation and STL/3MF downloads",()=>{
  const html=readFileSync(new URL("../dist/terrain-medal.html",import.meta.url),"utf8");
  const js=readFileSync(new URL("../dist/terrain-medal.js",import.meta.url),"utf8");
  for(const id of ["generatePrintModel","download3mf","downloadStl","productionStatus"])assert.match(html,new RegExp(`id=["']${id}["']`));
  assert.match(js,/from ".\/print-model-core\.mjs/);
  assert.match(js,/async function generateProductionModel/);
  assert.match(js,/buildRadialMedalMesh/);
  assert.match(js,/encodeBinaryStl/);
  assert.match(js,/encode3mf/);
});

test("production mesh embosses route, major roads, place labels and event metadata from governed terrain data",()=>{
  const js=readFileSync(new URL("../dist/terrain-medal.js",import.meta.url),"utf8");
  assert.match(js,/function buildProductionMasks/);
  assert.match(js,/routeMask/);
  assert.match(js,/roadMask/);
  assert.match(js,/textMask/);
  assert.match(js,/buildMedalMetaLines\(c\)/);
  assert.match(js,/governedPlaces\(c\)/);
  assert.match(js,/cartography\.roads/);
  assert.match(js,/surfaceHeight\(x,y,c/);
  assert.doesNotMatch(js,/toDataURL\(.*medalCanvas/);
});


test("fabrication extras UI exposes shapes contours magnets hanger bottom mark logo heightmap stand tiling and DEM override",()=>{
  const html=readFileSync(new URL("../dist/terrain-medal.html",import.meta.url),"utf8");
  for(const id of [
    "shapeSelect","shapeAspect","contourEnabled","contourInterval","contourRise",
    "magnetEnabled","magnetDiameter","magnetDepth","magnetSpacing",
    "hangingLoopEnabled","loopInnerDiameter","loopWall",
    "bottomMark","bottomEngraveDepth","logoInput","logoRise",
    "heightmapInput","heightmapStrength","standEnabled","tileEnabled","tileMaxWidth","tileMaxHeight",
    "elevationSource","openTopoDataset","openTopoKey","loadHighResDem","fabricationStatus"
  ]) assert.match(html,new RegExp(`id=["']${id}["']`),id);
});

test("production generator applies fabrication modifiers to real mesh generation",()=>{
  const js=readFileSync(new URL("../dist/terrain-medal.js",import.meta.url),"utf8");
  assert.match(js,/from ".\/fabrication-extras-core\.mjs/);
  assert.match(js,/contourEmbossHeight/);
  assert.match(js,/magnetPocketDepth/);
  assert.match(js,/bottomAt=/);
  assert.match(js,/shape:c\.shape/);
  assert.match(js,/buildAnnulusMesh/);
  assert.match(js,/buildDisplayStandMesh/);
  assert.match(js,/mergeMeshes/);
  assert.match(js,/fabricationState\.logoMask/);
  assert.match(js,/fabricationState\.heightmapMask/);
  assert.match(js,/planTiledMap/);
});

test("high-resolution DEM override uses parsed Arc ASCII data before Terrarium fallback",()=>{
  const js=readFileSync(new URL("../dist/terrain-medal.js",import.meta.url),"utf8");
  assert.match(js,/fabricationState\.highResGrid/);
  assert.match(js,/sampleArcAsciiGrid/);
  assert.match(js,/\/api\/terrain\/opentopography/);
});


test("Terrarium elevation sampling is bilinear rather than nearest-pixel",()=>{
  const encode=e=>{const v=e+32768,r=Math.floor(v/256),g=Math.floor(v-r*256),b=Math.round((v-r*256-g)*256);return [r,g,b,255]};
  const data=new Uint8ClampedArray([...encode(0),...encode(100),...encode(200),...encode(300)]);
  assert.equal(sampleTerrariumBilinear(data,2,2,0,0),0);
  assert.equal(sampleTerrariumBilinear(data,2,2,1,1),300);
  assert.ok(Math.abs(sampleTerrariumBilinear(data,2,2,.5,.5)-150)<.01);
});

test("multiple GPX routes merge without drawing false connector segments",()=>{
  const a=parseGpxText('<gpx><trk><trkseg><trkpt lat="10" lon="76"><ele>100</ele></trkpt><trkpt lat="10.1" lon="76.1"><ele>120</ele></trkpt></trkseg></trk></gpx>',"a.gpx");
  const b=parseGpxText('<gpx><trk><trkseg><trkpt lat="11" lon="77"><ele>200</ele></trkpt><trkpt lat="11.1" lon="77.1"><ele>230</ele></trkpt></trkseg></trk></gpx>',"b.gpx");
  const merged=mergeGpxRoutes([a,b]);
  assert.equal(merged.routeCount,2);
  assert.equal(merged.sourcePointCount,4);
  assert.equal(merged.points.length,4);
  assert.notEqual(merged.points[1].segment,merged.points[2].segment);
  assert.equal(merged.distanceKm,Number((a.distanceKm+b.distanceKm).toFixed(2)));
  assert.deepEqual(merged.bounds,{minLat:10,maxLat:11.1,minLon:76,maxLon:77.1,minEle:100,maxEle:230});
});


test("benchmark upgrades expose multi-GPX local DEM and rich printable map-layer controls",()=>{
  const html=readFileSync(new URL("../dist/terrain-medal.html",import.meta.url),"utf8");
  const js=readFileSync(new URL("../dist/terrain-medal.js",import.meta.url),"utf8");
  assert.match(html,/id="gpxInput"[^>]*multiple/);
  for(const id of ["localDemInput","trailsEnabled","railwaysEnabled","buildingsEnabled","terrainColor","waterColor","routeColor","roadsColor","labelsColor","trailsColor","railwaysColor","buildingsColor"])assert.match(html,new RegExp(`id=["']${id}["']`),id);
  assert.match(js,/mergeGpxRoutes/);
  assert.match(js,/sampleTerrariumBilinear/);
  assert.match(js,/OpenTopography E2E PASS/);
  assert.match(js,/Local Arc-ASCII/);
  for(const material of ["Roads","Labels","Trails","Railways","Buildings"])assert.match(js,new RegExp(`name:"${material}"`));
  assert.match(js,/terrain-medal-core\.mjs\?v=17/);
  assert.match(js,/vector-map-core\.mjs\?v=8/);
});


test("professional DEM and export controls are exposed in Terrain Medal Studio",()=>{
  const html=readFileSync(new URL("../dist/terrain-medal.html",import.meta.url),"utf8");
  const js=readFileSync(new URL("../dist/terrain-medal.js",import.meta.url),"utf8");
  for(const id of [
    "geoTiffInput","geoTiffCrs","demFillNoData","demSmoothRadius","meshTargetXy",
    "routeElevationMode","routeElevationBlend",
    "downloadObj","downloadGlb","downloadValidationBundle"
  ]) assert.match(html,new RegExp(`id=["']${id}["']`),id);
  assert.match(js,/from ".\/pro-dem-core\.mjs/);
  assert.match(js,/loadGeoTiffArrayBuffer/);
  assert.match(js,/reconcileGpxElevations/);
  assert.match(js,/adaptiveLargeFormatPlan/);
  assert.match(js,/encodeObj/);
  assert.match(js,/encodeGlb/);
  assert.match(js,/buildPrintValidationCoupon/);
});

test("production generation uses true volumetric building meshes when buildings are enabled",()=>{
  const js=readFileSync(new URL("../dist/terrain-medal.js",import.meta.url),"utf8");
  assert.match(js,/buildExtrudedPolygonMesh/);
  assert.match(js,/cartography\.buildings/);
  assert.match(js,/renderHeight/);
  assert.match(js,/mergeMeshes\(\[mesh,\.\.\.buildingMeshes/);
});

test("large-format tiled export uses target physical XY resolution rather than fixed 180-cell limits",()=>{
  const js=readFileSync(new URL("../dist/terrain-medal.js",import.meta.url),"utf8");
  assert.match(js,/adaptiveLargeFormatPlan/);
  assert.match(js,/targetXyMm:c\.meshTargetXy/);
  assert.doesNotMatch(js,/Math\.min\(180,Math\.ceil\(tile\.widthMm\/step\)\)/);
});

test("production job records professional DEM and GPX elevation reconciliation settings",()=>{
  const js=readFileSync(new URL("../dist/terrain-medal.js",import.meta.url),"utf8");
  assert.match(js,/routeElevationMode/);
  assert.match(js,/routeElevationBlend/);
  assert.match(js,/geoTiffCrs/);
  assert.match(js,/meshTargetXy/);
  assert.match(js,/elevationDiagnostics/);
});


test("PQ1 runtime dependencies are local and no GeoTIFF CDN import remains",()=>{
  const pro=readFileSync(new URL("../dist/pro-dem-core.mjs",import.meta.url),"utf8");
  const pkg=JSON.parse(readFileSync(new URL("../package.json",import.meta.url),"utf8"));
  assert.doesNotMatch(pro,/cdn\.jsdelivr\.net|unpkg\.com|ajax\.googleapis\.com/);
  assert.match(pro,/\.\/vendor\/geotiff-proj4\.mjs/);
  assert.equal(pkg.dependencies.geotiff,"3.0.5");
  assert.equal(pkg.dependencies.proj4,"2.22.0");
});

test("PQ1 GLB viewer is integrated locally with camera controls and AR capability",()=>{
  const html=readFileSync(new URL("../dist/terrain-medal.html",import.meta.url),"utf8");
  const js=readFileSync(new URL("../dist/terrain-medal.js",import.meta.url),"utf8");
  assert.match(html,/id=["']glbViewer["']/);
  assert.match(html,/camera-controls/);
  assert.match(html,/\bar\b/);
  assert.match(js,/MODEL_VIEWER_LOCAL="\/vendor\/model-viewer\.min\.js\?v=4\.3\.1"/);
  assert.match(js,/ensureGlbViewerComponent/);
  assert.match(js,/glbViewer/);
  assert.match(js,/URL\.createObjectURL/);
});

test("PQ1 performance envelope is enforced before large production generation",()=>{
  const js=readFileSync(new URL("../dist/terrain-medal.js",import.meta.url),"utf8");
  assert.match(js,/classifyTerrainWorkload/);
  assert.match(js,/action===["']refuse["']/);
  assert.match(js,/action===["']tile["']/);
});


test("GLB viewer runtime is local-only and never falls back to a third-party CDN",()=>{
  const html=readFileSync(new URL("../dist/terrain-medal.html",import.meta.url),"utf8");
  const js=readFileSync(new URL("../dist/terrain-medal.js",import.meta.url),"utf8");
  assert.doesNotMatch(html,/src=["']vendor\/model-viewer\.min\.js["']/);
  assert.match(js,/ensureGlbViewerComponent/);
  assert.match(js,/\/vendor\/model-viewer\.min\.js/);
  assert.doesNotMatch(js,/cdn\.jsdelivr\.net|unpkg\.com|ajax\.googleapis\.com/);
});

test("GLB viewer reports actual render load or error instead of optimistic loaded state",()=>{
  const js=readFileSync(new URL("../dist/terrain-medal.js",import.meta.url),"utf8");
  assert.match(js,/addEventListener\(["']load["']/);
  assert.match(js,/addEventListener\(["']error["']/);
  assert.match(js,/Rendering governed GLB/);
  assert.match(js,/GLB rendered/);
  assert.match(js,/GLB viewer failed/);
});


test("print place labels default to a small major-place set",()=>{
  const places=[
    {name:"Paris",class:"city",rank:1},{name:"Brest",class:"city",rank:4},{name:"Rennes",class:"city",rank:5},
    {name:"Le Mans",class:"city",rank:6},{name:"Caen",class:"city",rank:7},{name:"Rouen",class:"city",rank:8},
    {name:"Chartres",class:"town",rank:7},{name:"Minor Town",class:"town",rank:15},{name:"Village",class:"village",rank:2}
  ];
  const selected=selectPrintPlaces(places,{mode:"major",maxCount:6});
  assert.deepEqual(selected.map(p=>p.name),["Paris","Brest","Rennes","Le Mans","Caen","Rouen"]);
  assert.ok(selected.every(p=>p.class==="city"||(p.class==="town"&&p.rank<=8)));
});

test("print place label modes support none selected-only and all",()=>{
  const places=[{name:"Paris",class:"city",rank:1},{name:"Brest",class:"city",rank:4},{name:"Rennes",class:"city",rank:5}];
  assert.deepEqual(selectPrintPlaces(places,{mode:"none",maxCount:8}),[]);
  assert.deepEqual(selectPrintPlaces(places,{mode:"selected",selectedNames:["Brest"],maxCount:8}).map(p=>p.name),["Brest"]);
  assert.equal(selectPrintPlaces(places,{mode:"all",maxCount:2}).length,2);
});

test("Terrain Medal exposes governed place-label controls and permanent Vayu underside watermark",()=>{
  const html=readFileSync(new URL("../dist/terrain-medal.html",import.meta.url),"utf8");
  const js=readFileSync(new URL("../dist/terrain-medal.js",import.meta.url),"utf8");
  for(const id of ["placeLabelMode","placeSelectionList"])assert.match(html,new RegExp(`id=["']${id}["']`));
  assert.match(html,/value="major" selected/);
  assert.match(js,/assets\/vayu-official\.png/);
  assert.match(js,/© 2026 VYNDI RIDE STORIES/);
  assert.match(js,/permanentWatermarkMask/);
  assert.doesNotMatch(html,/disable.*watermark|watermark.*off/i);
});


test("major print places are biased toward the actual GPX route",()=>{
  const routePoints=[{x:-1,y:0},{x:0,y:0},{x:1,y:0}];
  const places=[
    {name:"On Route Town",class:"town",rank:6,x:.05,y:.02},
    {name:"Far Capital",class:"city",rank:1,x:0,y:1.2},
    {name:"Route City",class:"city",rank:5,x:.8,y:.03}
  ];
  const selected=selectPrintPlaces(places,{mode:"major",routePoints,maxCount:2});
  assert.deepEqual(selected.map(p=>p.name),["On Route Town","Route City"]);
});


test("print road policy keeps only true major roads and protects the medal edge",()=>{
  assert.equal(roadPrintPolicy("secondary",0.2),false);
  assert.equal(roadPrintPolicy("primary",0.5),true);
  assert.equal(roadPrintPolicy("primary",0.95),false);
  assert.equal(roadPrintPolicy("trunk",0.96),true);
  assert.equal(roadPrintPolicy("trunk",0.995),false);
  assert.equal(roadPrintPolicy("motorway",0.97),true);
  assert.equal(roadPrintPolicy("motorway",1.01),false);
});

test("road rendering budget is intentionally print-scale rather than map-scale",()=>{
  assert.equal(adaptiveRoadRenderBudget(4),320);
  assert.equal(adaptiveRoadRenderBudget(3),220);
});


test("browser and production road layers both enforce major-only edge-safe policy",()=>{
  const js=readFileSync(new URL("../dist/terrain-medal.js",import.meta.url),"utf8");
  assert.match(js,/roadPrintPolicy\(feature\.class,shapeEdgeRatio\(x,y,c\)\)/);
  assert.match(js,/roadPrintPolicy\(road\.class,shapeEdgeRatio\(point\.x,point\.y,c\)\)/);
  assert.doesNotMatch(js,/\["secondary","primary","trunk","motorway"\]/);
  assert.match(js,/const roadWidths=\{motorway:1\.15,trunk:1\.0,primary:\.82\}/);
  assert.match(js,/maxRoads:650/);
});


test("Ride Stories and Terrain Medal use My Road My Glory as the visible identity",()=>{
  const index=readFileSync(new URL("../dist/index.html",import.meta.url),"utf8");
  const medal=readFileSync(new URL("../dist/terrain-medal.html",import.meta.url),"utf8");
  const medalJs=readFileSync(new URL("../dist/terrain-medal.js",import.meta.url),"utf8");
  const appJs=readFileSync(new URL("../dist/app.js",import.meta.url),"utf8");
  const theme=readFileSync(new URL("../dist/my-road-my-glory-theme.css",import.meta.url),"utf8");
  for(const html of [index,medal]){
    assert.match(html,/MY ROAD\s*[—-]\s*MY GLORY/i);
    assert.match(html,/Powered by VYNDI Ride Stories/i);
    assert.match(html,/assets\/vayu-official\.png/);
    assert.doesNotMatch(html,/assets\/mrmg-mark\.svg/);
    assert.match(html,/my-road-my-glory-theme\.css/);
  }
  assert.match(medalJs,/assets\/vayu-official\.png/);
  assert.doesNotMatch(medalJs,/Vāyú watermark|Permanent Vāyú/i);
  assert.match(appJs,/VYNDI Ride Memory Frame/);
  assert.match(appJs,/My Road — My Glory/);
  assert.match(theme,/--vyndi-orange:#FF6A00/i);
  assert.match(theme,/--vyndi-lime:#B9FF2C/i);
  assert.match(theme,/--vyndi-cyan:#69E7FF/i);
  assert.match(theme,/Space Grotesk/);
  assert.match(theme,/terrain-medal-app/);
  assert.match(theme,/ride-stories-app/);
});


test("Terrain Medal exposes signed authenticity receipt controls and canonical verification flow",()=>{
  const html=readFileSync(new URL("../dist/terrain-medal.html",import.meta.url),"utf8");
  const js=readFileSync(new URL("../dist/terrain-medal.js",import.meta.url),"utf8");
  for(const id of ["issueAuthenticity","downloadAuthenticity","authenticityStatus","verifyAuthenticityLink"])assert.match(html,new RegExp(`id=["']${id}["']`));
  assert.match(js,/buildAuthenticityManifest/);
  assert.match(js,/crypto\.subtle\.digest\("SHA-256"/);
  assert.match(js,/fetch\("\/api\/authenticity\/issue"/);
  assert.match(js,/\.vyndi-auth\.json/);
  assert.match(js,/verificationUrl/);
});

test("authenticity invalidates whenever the production model changes",()=>{
  const js=readFileSync(new URL("../dist/terrain-medal.js",import.meta.url),"utf8");
  const start=js.indexOf("function invalidateProductionModel");
  const end=js.indexOf("function readConfig",start);
  const body=js.slice(start,end);
  assert.match(body,/authenticityReceipt=null/);
  assert.match(body,/issueAuthenticity\.disabled=true/);
  assert.match(body,/downloadAuthenticity\.disabled=true/);
  assert.match(body,/verifyAuthenticityLink\.hidden=true/);
});


test("local file validation accepts production-scale GPX and rejects abusive or mismatched files",()=>{
  assert.equal(validateLocalFileMeta({name:"pbp.gpx",size:55*1024*1024},{maxBytes:96*1024*1024,extensions:[".gpx"]}),true);
  assert.throws(()=>validateLocalFileMeta({name:"huge.gpx",size:120*1024*1024},{maxBytes:96*1024*1024,extensions:[".gpx"]}),/too large/i);
  assert.throws(()=>validateLocalFileMeta({name:"payload.exe",size:1024},{maxBytes:96*1024*1024,extensions:[".gpx"]}),/file type/i);
});

test("local file validation supports large professional GeoTIFF while enforcing a bounded ceiling",()=>{
  assert.equal(validateLocalFileMeta({name:"utm43n.tiff",size:600*1024*1024},{maxBytes:768*1024*1024,extensions:[".tif",".tiff"]}),true);
  assert.throws(()=>validateLocalFileMeta({name:"utm43n.tiff",size:900*1024*1024},{maxBytes:768*1024*1024,extensions:[".tif",".tiff"]}),/too large/i);
});


test("Terrain Medal checks authenticity signing readiness from the canonical Worker",()=>{
  const js=readFileSync(new URL("../dist/terrain-medal.js",import.meta.url),"utf8");
  assert.match(js,/refreshAuthenticityServiceStatus/);
  assert.match(js,/fetch\("\/api\/authenticity\/status"/);
  assert.match(js,/Signing service ready/);
  assert.match(js,/one-time activation required/);
});
