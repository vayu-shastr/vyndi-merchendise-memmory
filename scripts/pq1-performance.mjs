import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import { classifyTerrainWorkload, rasterStats } from "../dist/pro-dem-core.mjs";

const root=resolve(fileURLToPath(new URL("..",import.meta.url)));
const outdir=resolve(root,"qualification/performance/generated");
await mkdir(outdir,{recursive:true});

const cases=[
  {id:"small",w:512,h:512,vertices:150000,allocate:true},
  {id:"normal",w:2048,h:2048,vertices:650000,allocate:true},
  {id:"large",w:4096,h:4096,vertices:1500000,allocate:true},
  {id:"very-large-tile",w:9000,h:9000,vertices:6500000,allocate:false},
  {id:"expected-refusal",w:18000,h:18000,vertices:25000000,allocate:false},
];
const deviceMemoryGb=8,results=[];
for(const c of cases){
  const before=process.memoryUsage();
  const start=performance.now();
  let stats=null;
  if(c.allocate){
    const data=new Float32Array(c.w*c.h);
    for(let i=0;i<data.length;i++)data[i]=100+(i%997)*.125;
    stats=rasterStats({width:c.w,height:c.h,data});
  }
  const elapsedMs=performance.now()-start;
  const after=process.memoryUsage();
  const guard=classifyTerrainWorkload({rasterWidth:c.w,rasterHeight:c.h,estimatedVertices:c.vertices,deviceMemoryGb});
  results.push({
    id:c.id,rasterPixels:c.w*c.h,rasterWidth:c.w,rasterHeight:c.h,estimatedVertices:c.vertices,
    allocatedAndScanned:c.allocate,elapsedMs:Number(elapsedMs.toFixed(3)),
    rssBefore:before.rss,rssAfter:after.rss,heapUsedAfter:after.heapUsed,
    stats,guard
  });
}
const expected={small:"allow",normal:"allow",large:"warn","very-large-tile":"tile","expected-refusal":"refuse"};
const checks=results.map(r=>({id:r.id,expected:expected[r.id],observed:r.guard.action,pass:r.guard.action===expected[r.id]}));
const evidence={
  schema:"vyndi.pq1.performance-evidence/v1",
  environment:{node:process.version,platform:process.platform,arch:process.arch,assumedBrowserDeviceMemoryGb:deviceMemoryGb},
  methodology:"Small/normal/large raster arrays are actually allocated and scanned; very-large/refusal cases exercise the deterministic guard without intentionally exhausting CI memory.",
  results,checks,result:checks.every(x=>x.pass)?"PASS":"FAIL"
};
await writeFile(resolve(outdir,"evidence.json"),JSON.stringify(evidence,null,2)+"\n");
console.log(JSON.stringify(evidence,null,2));
if(evidence.result!=="PASS")process.exitCode=1;
