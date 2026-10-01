import { chromium } from "playwright";

const url=process.env.PREVIEW_URL||"http://127.0.0.1:8765/tests/fixtures/direct-mesh-preview.html";
const browser=await chromium.launch({headless:true,args:["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"]});
const page=await browser.newPage({viewport:{width:1200,height:760}});
const errors=[];
page.on("console",msg=>{if(msg.type()==="error")errors.push(msg.text())});
page.on("pageerror",err=>errors.push(String(err)));

try{
  await page.goto(url,{waitUntil:"networkidle",timeout:30000});
  await page.waitForFunction(()=>["ready","error"].includes(document.querySelector("#preview")?.dataset?.renderState),null,{timeout:30000});
  await page.waitForTimeout(1000);

  const result=await page.evaluate(()=>{
    const canvas=document.querySelector("#preview");
    const state=canvas?.dataset?.renderState||"missing";
    const error=canvas?.dataset?.renderError||"";
    const gl=canvas?.getContext("webgl2")||canvas?.getContext("webgl");
    let changed=0,total=0;
    if(gl&&canvas.width&&canvas.height){
      const w=Math.min(180,canvas.width),h=Math.min(120,canvas.height);
      const x=Math.max(0,Math.floor((canvas.width-w)/2));
      const y=Math.max(0,Math.floor((canvas.height-h)/2));
      const pixels=new Uint8Array(w*h*4);
      gl.readPixels(x,y,w,h,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
      for(let i=0;i<pixels.length;i+=4){
        total++;
        const r=pixels[i],g=pixels[i+1],b=pixels[i+2];
        if(Math.abs(r-11)>10||Math.abs(g-16)>10||Math.abs(b-18)>10)changed++;
      }
    }
    return {state,error,width:canvas?.width||0,height:canvas?.height||0,changed,total,status:document.querySelector("#status")?.textContent||""};
  });

  console.log(JSON.stringify({result,errors},null,2));
  await page.locator("#stage").screenshot({path:"direct-mesh-preview.png"});
  if(result.state!=="ready")throw new Error("renderer state "+result.state+": "+result.error);
  if(result.changed<250)throw new Error("canvas appears blank: "+JSON.stringify(result));
  if(errors.length)throw new Error("browser console errors: "+errors.join(" | "));
}finally{
  await browser.close();
}
