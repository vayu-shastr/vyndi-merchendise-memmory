import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadGeoTiffArrayBuffer } from "../dist/pro-dem-core.mjs";

const root=resolve(fileURLToPath(new URL("..",import.meta.url)));
const dir=resolve(root,"qualification/geotiff-corpus/generated");
const manifest=JSON.parse(await readFile(resolve(dir,"manifest.json"),"utf8"));
const evidence={schema:"vyndi.pq1.geotiff-evidence/v1",source:manifest.source,cases:[],result:"PASS"};
for(const c of manifest.cases){
  const bytes=await readFile(resolve(dir,c.filename));
  const buffer=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
  const dem=await loadGeoTiffArrayBuffer(buffer,{fillNoData:true,fillPasses:12});
  const sample=dem.sampleLatLon(c.controlPoint.lat,c.controlPoint.lon);
  const checks={
    crs:dem.sourceCrs.toUpperCase()===c.crs.toUpperCase(),
    width:dem.width===c.width,
    height:dem.height===c.height,
    noDataRepaired:dem.stats.noData===0,
    controlPointFinite:Number.isFinite(sample),
    bounds:Array.isArray(dem.bbox)&&dem.bbox.length===4&&dem.bbox.every(Number.isFinite),
  };
  const verdict=Object.values(checks).every(Boolean)?"PASS":"FAIL";
  if(verdict!=="PASS")evidence.result="FAIL";
  evidence.cases.push({...c,observed:{sourceCrs:dem.sourceCrs,width:dem.width,height:dem.height,stats:dem.stats,controlPointValue:sample,bbox:dem.bbox},checks,verdict});
}
const out=resolve(dir,"evidence.json");
await writeFile(out,JSON.stringify(evidence,null,2)+"\n");
console.log(JSON.stringify(evidence,null,2));
if(evidence.result!=="PASS")process.exitCode=1;
