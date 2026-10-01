import { chromium } from "playwright";

const base=process.env.VMM_URL||"https://vmm.vayushastr.workers.dev/terrain-medal";
const browser=await chromium.launch({headless:true,args:["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"]});
const page=await browser.newPage({viewport:{width:1600,height:1000}});
const consoleErrors=[];
page.on("console",msg=>{ if(msg.type()==="error") consoleErrors.push(msg.text()); });
page.on("pageerror",err=>consoleErrors.push(String(err)));

try{
  await page.goto(base+"?e2e="+Date.now(),{waitUntil:"networkidle",timeout:60000});

  const gpx=`<?xml version="1.0" encoding="UTF-8"?>
  <gpx version="1.1" creator="VMM-E2E">
    <trk><name>VMM browser smoke</name><trkseg>
      <trkpt lat="48.8566" lon="2.3522"><ele>35</ele></trkpt>
      <trkpt lat="48.8666" lon="2.3622"><ele>42</ele></trkpt>
      <trkpt lat="48.8766" lon="2.3722"><ele>38</ele></trkpt>
      <trkpt lat="48.8866" lon="2.3822"><ele>45</ele></trkpt>
    </trkseg></trk>
  </gpx>`;

  await page.setInputFiles("#gpxInput",{name:"vmm-e2e.gpx",mimeType:"application/gpx+xml",buffer:Buffer.from(gpx)});
  await page.waitForFunction(()=>document.querySelector("#gpxState")?.textContent?.includes("route"),null,{timeout:90000});
  await page.check('input[name="diameter"][value="3"]');
  await page.fill("#meshTargetXy","2");
  await page.dispatchEvent("#meshTargetXy","change");

  await page.click("#generatePrintModel");
  await page.waitForFunction(()=>document.querySelector("#productionStatus")?.textContent?.startsWith("Ready ·"),null,{timeout:120000});
  await page.waitForFunction(()=>document.querySelector("#glbFallbackCanvas")?.dataset?.renderState==="ready" || document.querySelector("#glbFallbackCanvas")?.dataset?.renderState==="error",null,{timeout:30000});

  const result=await page.evaluate(()=>{
    const canvas=document.querySelector("#glbFallbackCanvas");
    const status=document.querySelector("#glbViewerStatus")?.textContent||"";
    const renderState=canvas?.dataset?.renderState||"missing";
    const renderError=canvas?.dataset?.renderError||"";
    const gl=canvas?.getContext("webgl2")||canvas?.getContext("webgl");
    let sampledNonBackground=0,total=0;
    if(gl&&canvas.width&&canvas.height){
      const w=Math.min(96,canvas.width),h=Math.min(96,canvas.height);
      const x=Math.max(0,Math.floor((canvas.width-w)/2)),y=Math.max(0,Math.floor((canvas.height-h)/2));
      const pixels=new Uint8Array(w*h*4);
      gl.readPixels(x,y,w,h,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
      for(let i=0;i<pixels.length;i+=4){
        total++;
        const r=pixels[i],g=pixels[i+1],b=pixels[i+2];
        if(Math.abs(r-11)>8||Math.abs(g-16)>8||Math.abs(b-18)>8)sampledNonBackground++;
      }
    }
    return {status,renderState,renderError,width:canvas?.width||0,height:canvas?.height||0,sampledNonBackground,total};
  });

  console.log(JSON.stringify({result,consoleErrors},null,2));
  await page.locator("#generatedModelPreview").screenshot({path:"glb-preview.png"});

  if(result.renderState!=="ready") throw new Error("fallback renderer not ready: "+result.renderError);
  if(result.sampledNonBackground<50) throw new Error("fallback canvas appears blank: "+JSON.stringify(result));
  if(consoleErrors.length) throw new Error("browser console errors: "+consoleErrors.join(" | "));
} finally {
  await browser.close();
}
