import { chromium } from "playwright";

const base=process.env.VMM_URL||"https://vmm.vayushastr.workers.dev/terrain-medal";
const browser=await chromium.launch({headless:true,args:["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"]});
const page=await browser.newPage({viewport:{width:1600,height:1000}});
const consoleErrors=[];
page.on("console",msg=>{ if(msg.type()==="error") consoleErrors.push(msg.text()); });
page.on("pageerror",err=>consoleErrors.push(String(err)));

try{
  await page.goto(base+"?renderer-smoke="+Date.now(),{waitUntil:"networkidle",timeout:60000});
  const result=await page.evaluate(async()=>{
    const [{renderProductionMeshPreview},{buildRadialMedalMesh}]=await Promise.all([
      import("/direct-mesh-preview.mjs?v=1"),
      import("/print-model-core.mjs?v=8")
    ]);
    const canvas=document.querySelector("#glbFallbackCanvas");
    const status=document.querySelector("#glbViewerStatus");
    if(!canvas)throw new Error("fallback canvas missing");
    const mesh=buildRadialMedalMesh({
      diameterMm:100,
      baseMm:3,
      rings:18,
      segments:96,
      heightAt:(x,y)=>1.2+Math.sin(x/12)*.6+Math.cos(y/15)*.4,
      regionAt:(x,y)=>x>0?2:0
    });
    const cleanup=renderProductionMeshPreview({
      canvas,mesh,modelWidthMm:100,statusEl:status,
      materials:[
        {name:"Terrain",color:"#88999AFF"},
        {name:"Water",color:"#2F9BC1FF"},
        {name:"Route",color:"#FF6A00FF"}
      ]
    });
    await new Promise(r=>setTimeout(r,1000));
    const gl=canvas.getContext("webgl2")||canvas.getContext("webgl");
    let sampledNonBackground=0,total=0;
    if(gl&&canvas.width&&canvas.height){
      const w=Math.min(128,canvas.width),h=Math.min(128,canvas.height);
      const x=Math.max(0,Math.floor((canvas.width-w)/2)),y=Math.max(0,Math.floor((canvas.height-h)/2));
      const pixels=new Uint8Array(w*h*4);
      gl.readPixels(x,y,w,h,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
      for(let i=0;i<pixels.length;i+=4){
        total++;
        const rr=pixels[i],gg=pixels[i+1],bb=pixels[i+2];
        if(Math.abs(rr-11)>8||Math.abs(gg-16)>8||Math.abs(bb-18)>8)sampledNonBackground++;
      }
    }
    const out={
      renderState:canvas.dataset.renderState||"",
      renderError:canvas.dataset.renderError||"",
      status:status?.textContent||"",
      width:canvas.width,height:canvas.height,
      sampledNonBackground,total
    };
    cleanup?.();
    return out;
  });

  console.log(JSON.stringify({result,consoleErrors},null,2));
  await page.locator("#generatedModelPreview").screenshot({path:"glb-preview.png"});
  if(result.renderState!=="ready")throw new Error("renderer not ready: "+result.renderError);
  if(result.sampledNonBackground<100)throw new Error("renderer canvas appears blank: "+JSON.stringify(result));
  if(consoleErrors.length)throw new Error("browser console errors: "+consoleErrors.join(" | "));
} catch(error) {
  const state=await page.evaluate(()=>({
    viewerStatus:document.querySelector("#glbViewerStatus")?.textContent||"",
    fallbackState:document.querySelector("#glbFallbackCanvas")?.dataset?.renderState||"",
    fallbackError:document.querySelector("#glbFallbackCanvas")?.dataset?.renderError||""
  })).catch(()=>({}));
  console.error("DIAGNOSTIC FAILURE",JSON.stringify({message:String(error),state,consoleErrors},null,2));
  await page.screenshot({path:"glb-preview.png",fullPage:true}).catch(()=>{});
  throw error;
} finally {
  await browser.close();
}
