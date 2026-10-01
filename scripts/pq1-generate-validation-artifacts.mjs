import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { PRINTERS } from "../dist/terrain-medal-core.mjs";
import { buildPrintValidationCoupon, encodeBinaryStl, encode3mf, encodeGlb, meshEdgeUse } from "../dist/print-model-core.mjs";

const root=resolve(fileURLToPath(new URL("..",import.meta.url)));
const outdir=resolve(root,"qualification/validation-artifacts/generated");
await mkdir(outdir,{recursive:true});
const profile=PRINTERS["bambu-p1s-ams"];
const coupon=buildPrintValidationCoupon({technology:profile.technology,nozzleMm:profile.nozzle,minFeatureMm:profile.minFeature,minEmbossMm:profile.minEmboss});
const edges=meshEdgeUse(coupon.mesh);
if(edges.boundaryEdges||edges.nonManifoldEdges)throw new Error("PQ1 coupon is not watertight.");
const materials=[
 {name:"Terrain",color:"#343A3EFF"},{name:"Water",color:"#2F9BC1FF"},{name:"Route",color:"#FF5C35FF"},
 {name:"Roads",color:"#B5B5B5FF"},{name:"Labels",color:"#B8F229FF"},{name:"Trails",color:"#E7C66AFF"},{name:"Railways",color:"#D893FFFF"},{name:"Buildings",color:"#F4F6F2FF"}
];
const files={
 "pq1-validation-coupon.stl":encodeBinaryStl(coupon.mesh,{name:"VYNDI PQ1 validation coupon"}),
 "pq1-validation-coupon.3mf":encode3mf(coupon.mesh,{title:"VYNDI PQ1 validation coupon",materials}),
 "pq1-validation-coupon.glb":encodeGlb(coupon.mesh,{title:"VYNDI PQ1 validation coupon",materials})
};
const sha256=data=>createHash("sha256").update(data).digest("hex");
const artifacts=[];
for(const [name,data] of Object.entries(files)){
 await writeFile(resolve(outdir,name),data);
 artifacts.push({name,bytes:data.byteLength??data.length,sha256:sha256(data)});
}
const manifest={
 schema:"vyndi.pq1.validation-artifacts/v1",
 authority:"Same governed artifacts shall be used for Bambu Studio, OrcaSlicer, PrusaSlicer, Cura and physical coupon testing.",
 profile:{id:"bambu-p1s-ams",label:profile.label,nozzleMm:profile.nozzle,minFeatureMm:profile.minFeature,minEmbossMm:profile.minEmboss,recommendedLayerMm:profile.recommendedLayer},
 mesh:{vertices:coupon.mesh.vertices.length,triangles:coupon.mesh.triangles.length,boundaryEdges:edges.boundaryEdges,nonManifoldEdges:edges.nonManifoldEdges},
 gradedFeatures:coupon.features,
 artifacts,
 result:"UNVALIDATED — artifact generation is not slicer or physical-print evidence"
};
await writeFile(resolve(outdir,"manifest.json"),JSON.stringify(manifest,null,2)+"\n");
console.log(JSON.stringify(manifest,null,2));
