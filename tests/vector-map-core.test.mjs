import test from 'node:test';
import assert from 'node:assert/strict';
import { clipLineToBounds, decodeCartographyTile, compileCartography, isPointInWater, projectLonLat, selectPlacesSpatially, selectRoadsSpatially, selectScreenPlacesSpatially, simplifyLine, transportationKind, buildingPrintHeight } from '../dist/vector-map-core.mjs';

function varint(value){ const out=[]; let n=value; while(n>=128){out.push((n%128)|128); n=Math.floor(n/128);} out.push(n); return out; }
function fieldVarint(field,value){return [...varint(field*8),...varint(value)];}
function fieldBytes(field,bytes){return [...varint(field*8+2),...varint(bytes.length),...bytes];}
function str(value){return [...new TextEncoder().encode(value)];}
function valueString(value){return fieldBytes(1,str(value));}
function packed(values){return values.flatMap(varint);}
function zz(n){return n<0 ? -n*2-1 : n*2;}
function pointGeom(x,y){return [9,zz(x),zz(y)];}
function lineGeom(points){let x=0,y=0; const out=[9,zz(points[0][0]-x),zz(points[0][1]-y)]; x=points[0][0]; y=points[0][1]; if(points.length>1){out.push(((points.length-1)<<3)|2); for(let i=1;i<points.length;i++){out.push(zz(points[i][0]-x),zz(points[i][1]-y)); x=points[i][0]; y=points[i][1];}} return out;}
function polygonGeom(points){const ring=points.at(-1)[0]===points[0][0]&&points.at(-1)[1]===points[0][1]?points.slice(0,-1):points; let x=0,y=0; const out=[9,zz(ring[0][0]-x),zz(ring[0][1]-y)]; x=ring[0][0]; y=ring[0][1]; out.push(((ring.length-1)<<3)|2); for(let i=1;i<ring.length;i++){out.push(zz(ring[i][0]-x),zz(ring[i][1]-y)); x=ring[i][0]; y=ring[i][1];} out.push(15); return out;}
function feature({tags,type,geometry}){return [fieldBytes(2,packed(tags)),fieldVarint(3,type),fieldBytes(4,packed(geometry))].flat();}
function layer(name, keys, values, features, extent=4096){return [fieldBytes(1,str(name)),...features.map(f=>fieldBytes(2,f)),...keys.map(k=>fieldBytes(3,str(k))),...values.map(v=>fieldBytes(4,valueString(v))),fieldVarint(5,extent),fieldVarint(15,2)].flat();}
function tile(layers){return Uint8Array.from(layers.map(l=>fieldBytes(3,l)).flat()).buffer;}

const fixture = tile([
  layer('transportation',['class'],['primary','ferry','secondary','tertiary'],[
    feature({tags:[0,0],type:2,geometry:lineGeom([[500,2000],[1800,1800],[3500,1700]])}),
    feature({tags:[0,1],type:2,geometry:lineGeom([[0,500],[4096,3500]])}),
    feature({tags:[0,2],type:2,geometry:lineGeom([[300,1400],[2200,1300],[3900,1200]])}),
    feature({tags:[0,3],type:2,geometry:lineGeom([[400,2500],[2100,2400],[3800,2300]])})
  ]),
  layer('waterway',['class','name'],['river','Vilaine'],[feature({tags:[0,0,1,1],type:2,geometry:lineGeom([[300,3000],[2200,2600],[3900,2500]])})]),
  layer('place',['class','name','rank'],['city','Brest','5'],[feature({tags:[0,0,1,1,2,2],type:1,geometry:pointGeom(1000,1000)})]),
  layer('water',['class'],['ocean'],[feature({tags:[0,0],type:3,geometry:polygonGeom([[0,0],[1800,0],[1800,4096],[0,4096],[0,0]])})]),
  layer('boundary',['admin_level','adm0_l','adm0_r','maritime'],['2','France','Belgium','0'],[
    feature({tags:[0,0,1,1,2,2,3,3],type:2,geometry:lineGeom([[2500,500],[2600,2200],[2900,3900]])})
  ])
]);

test('decodes selected OpenMapTiles cartography layers from MVT',()=>{
  const decoded=decodeCartographyTile(fixture,{z:8,x:124,y:88});
  assert.equal(decoded.roads.length,2);
  assert.deepEqual(decoded.roads.map(road=>road.class).sort(),['primary','secondary']);
  assert.equal(decoded.countryBoundaries.length,1);
  assert.equal(decoded.countryBoundaries[0].adm0Left,'France');
  assert.equal(decoded.countryBoundaries[0].maritime,false);
  assert.equal(decoded.waterways[0].name,'Vilaine');
  assert.equal(decoded.places[0].name,'Brest');
  assert.equal(decoded.waterPolygons.length,1);
  assert.ok(Number.isFinite(decoded.places[0].lon));
});

test('compileCartography deduplicates place labels and simplifies geometry',()=>{
  const decoded=decodeCartographyTile(fixture,{z:8,x:124,y:88});
  const duplicate={...decoded,places:[...decoded.places,{...decoded.places[0],rank:8}]};
  const bounds={minLat:47,maxLat:50,minLon:-6,maxLon:3};
  const compiled=compileCartography([decoded,duplicate],bounds,{tolerance:0.001,maxPlaces:10});
  assert.equal(compiled.places.filter(p=>p.name==='Brest').length,1);
  assert.ok(compiled.roads[0].points.length<=decoded.roads[0].points.length);
  assert.ok(compiled.stats.waterPolygons>=2);
});

test('compileCartography isolates the real France national border and caps road clutter',()=>{const decoded=decodeCartographyTile(fixture,{z:8,x:124,y:88});const many={...decoded,roads:Array.from({length:50},(_,i)=>({...decoded.roads[0],points:decoded.roads[0].points.map(p=>({lon:p.lon+i*.0001,lat:p.lat}))}))};const bounds={minLat:41,maxLat:52,minLon:-6,maxLon:10};const compiled=compileCartography([many],bounds,{country:"France",maxRoads:12});assert.equal(compiled.countryBoundaries.length,1);assert.ok(compiled.roads.length<=12);assert.equal(compiled.countryBoundaries[0].adminLevel,2)});

test('vector water polygons can authoritatively classify sea versus land',()=>{
  const polygon={bounds:{minLon:-5,maxLon:-4,minLat:48,maxLat:49},rings:[[
    {lon:-5,lat:48},{lon:-4,lat:48},{lon:-4,lat:49},{lon:-5,lat:49},{lon:-5,lat:48}
  ]]};
  assert.equal(isPointInWater(-4.5,48.5,[polygon]),true);
  assert.equal(isPointInWater(-3.5,48.5,[polygon]),false);
});

test('longitude projection keeps PBP proportions latitude-aware',()=>{
  const bounds={minLat:47.7,maxLat:49.2,minLon:-4.6,maxLon:2.3};
  const west=projectLonLat({lon:-4.6,lat:48.45},bounds);
  const east=projectLonLat({lon:2.3,lat:48.45},bounds);
  assert.ok(Math.abs(east.x-west.x)>1.3);
});

test('map projection is north-up and west-left before 3D camera rotation',()=>{const bounds={minLat:41,maxLat:52,minLon:-6,maxLon:10};const north=projectLonLat({lon:2,lat:51},bounds);const south=projectLonLat({lon:2,lat:43},bounds);const west=projectLonLat({lon:-4,lat:47},bounds);const east=projectLonLat({lon:8,lat:47},bounds);assert.ok(north.y>south.y);assert.ok(west.x<east.x)});

test('cartography is clipped to the committed printable bounds before projection',()=>{const bounds={minLat:48,maxLat:49,minLon:-5,maxLon:3};const clipped=clipLineToBounds([{lon:-10,lat:48.5},{lon:10,lat:48.5}],bounds);assert.equal(clipped.length,1);assert.deepEqual(clipped[0],[{lon:-5,lat:48.5},{lon:3,lat:48.5}]);const tile={roads:[{class:"primary",points:[{lon:-10,lat:48.5},{lon:10,lat:48.5}]}],waterways:[],boundaries:[],countryBoundaries:[],places:[{class:"city",name:"Paris",rank:1,lon:2.35,lat:48.85},{class:"city",name:"London",rank:1,lon:-0.13,lat:51.51}],waterPolygons:[]};const compiled=compileCartography([tile],bounds,{maxPlaces:10,maxRoads:10});assert.deepEqual(compiled.places.map(p=>p.name),["Paris"]);assert.equal(compiled.roads.length,1);assert.ok(compiled.roads[0].points.every(p=>Math.abs(p.x)<=1.45&&Math.abs(p.y)<=1.45))});

test('place selection distributes labels across the full printable area instead of clustering by rank',()=>{const bounds={minLat:0,maxLat:10,minLon:0,maxLon:10};const places=[];for(let i=0;i<12;i++)places.push({name:`WestTop${i}`,class:'city',rank:i+1,lon:1+(i%3)*.2,lat:8+(i%2)*.2});places.push({name:'EastTop',class:'town',rank:50,lon:9,lat:9},{name:'WestBottom',class:'town',rank:50,lon:1,lat:1},{name:'EastBottom',class:'town',rank:50,lon:9,lat:1},{name:'Center',class:'town',rank:50,lon:5,lat:5});const picked=selectPlacesSpatially(places,bounds,8,{columns:4,rows:4});const names=new Set(picked.map(p=>p.name));assert.ok(names.has('EastTop'));assert.ok(names.has('WestBottom'));assert.ok(names.has('EastBottom'));assert.ok(names.has('Center'));assert.ok(picked.length<=8)});

test('road selection distributes hierarchy across the printable area instead of consuming the budget in one urban cluster',()=>{const roads=[];for(let i=0;i<30;i++)roads.push({class:'primary',points:[{x:-1.2+i*.002,y:.9},{x:-1.1+i*.002,y:.85}]});roads.push({class:'secondary',points:[{x:1.1,y:.9},{x:1.2,y:.8}]},{class:'secondary',points:[{x:-1.1,y:-.9},{x:-1.2,y:-.8}]},{class:'tertiary',points:[{x:1.1,y:-.9},{x:1.2,y:-.8}]},{class:'motorway',points:[{x:0,y:0},{x:.3,y:.1}]});const picked=selectRoadsSpatially(roads,8,{columns:4,rows:4,extent:1.45});assert.ok(picked.some(r=>r.class==='motorway'));const quadrants=new Set(picked.map(r=>{const p=r.points[Math.floor(r.points.length/2)];return `${p.x>=0?'E':'W'}${p.y>=0?'N':'S'}`}));assert.ok(quadrants.has('EN'));assert.ok(quadrants.has('WN'));assert.ok(quadrants.has('WS'));assert.ok(quadrants.has('ES'));assert.ok(picked.length<=8)});

test('line simplification preserves endpoints',()=>{
  const points=[{x:0,y:0},{x:.1,y:.001},{x:.2,y:0},{x:.3,y:0}];
  const simplified=simplifyLine(points,.01);
  assert.deepEqual(simplified,[points[0],points.at(-1)]);
});


test('screen-space place allocation preserves coverage after camera projection and before collision culling',()=>{
  const places=[];
  for(let i=0;i<20;i++)places.push({name:`ParisCluster${i}`,class:'city',rank:i+1,screenX:520+i%4,screenY:280+i%5});
  places.push(
    {name:'NW',class:'town',rank:50,screenX:120,screenY:120},
    {name:'NE',class:'town',rank:50,screenX:880,screenY:120},
    {name:'SW',class:'town',rank:50,screenX:120,screenY:680},
    {name:'SE',class:'town',rank:50,screenX:880,screenY:680},
    {name:'CENTER-W',class:'village',rank:70,screenX:300,screenY:400},
    {name:'CENTER-E',class:'village',rank:70,screenX:700,screenY:400}
  );
  const picked=selectScreenPlacesSpatially(places,12,{columns:5,rows:4,width:1000,height:800});
  const names=new Set(picked.map(p=>p.name));
  for(const name of ['NW','NE','SW','SE','CENTER-W','CENTER-E'])assert.ok(names.has(name),`missing ${name}`);
  assert.ok(picked.length<=12);
});


test('print cartography keeps only major road classes and rejects tertiary auxiliaries',()=>{
  const bounds={minLat:0,maxLat:10,minLon:0,maxLon:10};
  const tile={roads:[
    {class:'motorway',points:[{lon:1,lat:1},{lon:9,lat:1}]},
    {class:'trunk',points:[{lon:1,lat:2},{lon:9,lat:2}]},
    {class:'primary',points:[{lon:1,lat:3},{lon:9,lat:3}]},
    {class:'secondary',points:[{lon:1,lat:4},{lon:9,lat:4}]},
    {class:'tertiary',points:[{lon:1,lat:5},{lon:9,lat:5}]}
  ],waterways:[],boundaries:[],countryBoundaries:[],places:[],waterPolygons:[]};
  const compiled=compileCartography([tile],bounds,{maxRoads:50});
  assert.deepEqual([...new Set(compiled.roads.map(road=>road.class))].sort(),['motorway','primary','secondary','trunk']);
  assert.ok(compiled.roads.every(road=>road.class!=='tertiary'));
});


test("transportation classification separates major roads, printable trails and railways while retaining bridge/tunnel semantics",()=>{
  assert.equal(transportationKind({class:"primary"}),"road");
  assert.equal(transportationKind({class:"path",subclass:"cycleway"}),"trail");
  assert.equal(transportationKind({class:"track"}),"trail");
  assert.equal(transportationKind({class:"rail",subclass:"rail"}),"railway");
  assert.equal(transportationKind({class:"transit",subclass:"tram"}),"railway");
  assert.equal(transportationKind({class:"ferry"}),null);
});

test("building height normalization gives printable but bounded physical prominence",()=>{
  assert.equal(buildingPrintHeight({render_height:0}),3);
  assert.equal(buildingPrintHeight({render_height:12}),12);
  assert.equal(buildingPrintHeight({render_height:500}),80);
});

test("MVT decoder exposes trails railways and printable building footprints",()=>{
  const rich=tile([
    layer('transportation',['class','subclass','brunnel'],['path','cycleway','bridge','rail','tram','tunnel'],[
      feature({tags:[0,0,1,1,2,2],type:2,geometry:lineGeom([[200,300],[2000,1600],[3900,2000]])}),
      feature({tags:[0,3,1,4],type:2,geometry:lineGeom([[200,2200],[2000,2300],[3900,2400]])}),
      feature({tags:[0,3,1,4,2,5],type:2,geometry:lineGeom([[200,2500],[2000,2600],[3900,2700]])})
    ]),
    layer('building',['render_height','hide_3d'],['18','0'],[
      feature({tags:[0,0,1,1],type:3,geometry:polygonGeom([[1000,1000],[1500,1000],[1500,1500],[1000,1500],[1000,1000]])})
    ])
  ]);
  const decoded=decodeCartographyTile(rich,{z:14,x:8190,y:8190});
  assert.equal(decoded.trails.length,1);
  assert.equal(decoded.trails[0].brunnel,"bridge");
  assert.equal(decoded.railways.length,2);
  assert.equal(decoded.railways.filter(x=>x.brunnel==="tunnel").length,1);
  assert.equal(decoded.buildings.length,1);
  assert.equal(decoded.buildings[0].renderHeight,18);
});


test("compiled cartography preserves printable trails railways and buildings while dropping tunnels",()=>{
  const rich=tile([
    layer('transportation',['class','subclass','brunnel'],['path','cycleway','bridge','rail','tram','tunnel'],[
      feature({tags:[0,0,1,1,2,2],type:2,geometry:lineGeom([[1000,1000],[1800,1700],[2600,2000]])}),
      feature({tags:[0,3,1,4],type:2,geometry:lineGeom([[1200,2200],[2200,2300],[3000,2400]])}),
      feature({tags:[0,3,1,4,2,5],type:2,geometry:lineGeom([[1200,2500],[2200,2600],[3000,2700]])})
    ]),
    layer('building',['render_height'],['18'],[
      feature({tags:[0,0],type:3,geometry:polygonGeom([[1600,1600],[1900,1600],[1900,1900],[1600,1900],[1600,1600]])})
    ])
  ]);
  const decoded=decodeCartographyTile(rich,{z:8,x:124,y:88});
  const allPoints=[...decoded.trails.flatMap(x=>x.points),...decoded.railways.flatMap(x=>x.points),...decoded.buildings.flatMap(x=>x.rings.flat())];
  const bounds={minLat:Math.min(...allPoints.map(p=>p.lat))-.1,maxLat:Math.max(...allPoints.map(p=>p.lat))+.1,minLon:Math.min(...allPoints.map(p=>p.lon))-.1,maxLon:Math.max(...allPoints.map(p=>p.lon))+.1};
  const compiled=compileCartography([decoded],bounds,{maxTrails:20,maxRailways:20,maxBuildings:20});
  assert.equal(compiled.trails.length,1);
  assert.equal(compiled.railways.length,1);
  assert.equal(compiled.buildings.length,1);
  assert.ok(compiled.buildings[0].rings[0].length>=3);
  assert.equal(compiled.stats.buildings,1);
});
