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
    const preview=document.querySelector("#preview");
    const dimensions=typeof preview?.getDimensions==="function"?preview.getDimensions():null;
    return {
      state:preview?.dataset?.renderState||"missing",
      error:preview?.dataset?.renderError||"",
      loaded:Boolean(preview?.loaded),
      visible:Boolean(preview?.modelIsVisible),
      dimensions:dimensions?{x:Number(dimensions.x)||0,y:Number(dimensions.y)||0,z:Number(dimensions.z)||0}:null,
      status:document.querySelector("#status")?.textContent||""
    };
  });

  console.log(JSON.stringify({result,errors},null,2));
  await page.locator("#stage").screenshot({path:"direct-mesh-preview.png"});
  if(result.state!=="ready")throw new Error("model-viewer state "+result.state+": "+result.error);
  if(!result.loaded)throw new Error("model-viewer did not report loaded");
  if(!result.visible)throw new Error("model-viewer did not report modelIsVisible");
  if(result.dimensions&&Math.max(result.dimensions.x,result.dimensions.y,result.dimensions.z)<=0)throw new Error("model-viewer dimensions are empty");
  if(errors.length)throw new Error("browser console errors: "+errors.join(" | "));
}finally{
  await browser.close();
}
