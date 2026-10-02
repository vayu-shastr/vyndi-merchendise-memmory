import { THREE, OrbitControls } from "./vendor/three-glb-viewer.mjs?v=0.183.0";

function parseRgb(value="#808080"){
  const hex=String(value||"#808080").replace("#","").slice(0,6).padEnd(6,"0");
  return [
    parseInt(hex.slice(0,2),16)||128,
    parseInt(hex.slice(2,4),16)||128,
    parseInt(hex.slice(4,6),16)||128
  ];
}

function renderSoftwarePreview({canvas,mesh,materials,modelWidthMm=101.6,statusEl=null}={}){
  const ctx=canvas.getContext("2d",{alpha:false});
  if(!ctx)throw new Error("WebGL is unavailable and the Canvas 2D fallback could not be created.");

  const vertices=mesh?.vertices||[],triangles=mesh?.triangles||[];
  if(!vertices.length||!triangles.length)throw new Error("Generated preview mesh is empty.");

  canvas.dataset.renderState="loading";
  canvas.dataset.renderMode="software-2d";
  canvas.dataset.renderError="";

  const palette=(materials?.length?materials:[{color:"#808080"}]).map(m=>parseRgb(m?.color));
  const maxTriangles=24000;
  const stride=Math.max(1,Math.ceil(triangles.length/maxTriangles));
  let yaw=-0.62,pitch=0.88,zoom=1,dragging=false,lastX=0,lastY=0,disposed=false,resizeObserver=null;

  let minX=Infinity,minY=Infinity,minZ=Infinity,maxX=-Infinity,maxY=-Infinity,maxZ=-Infinity;
  for(const v of vertices){
    const x=Number(v.x)||0,y=Number(v.y)||0,z=Number(v.z)||0;
    if(x<minX)minX=x;if(x>maxX)maxX=x;
    if(y<minY)minY=y;if(y>maxY)maxY=y;
    if(z<minZ)minZ=z;if(z>maxZ)maxZ=z;
  }
  const cx=(minX+maxX)/2,cy=(minY+maxY)/2,cz=(minZ+maxZ)/2;
  const expected=Math.max(10,Number(modelWidthMm)||101.6);
  const span=Math.max(maxX-minX,maxY-minY,maxZ-minZ,expected*.7,1);

  function resize(){
    const cssW=Math.max(320,canvas.clientWidth||canvas.parentElement?.clientWidth||800);
    const cssH=Math.max(260,canvas.clientHeight||canvas.parentElement?.clientHeight||360);
    const dpr=Math.min(globalThis.devicePixelRatio||1,1.5);
    const w=Math.round(cssW*dpr),h=Math.round(cssH*dpr);
    if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}
    draw();
  }

  function project(v,w,h,scale){
    let x=(Number(v.x)||0)-cx,y=(Number(v.y)||0)-cy,z=(Number(v.z)||0)-cz;
    const cyaw=Math.cos(yaw),syaw=Math.sin(yaw);
    const x1=cyaw*x-syaw*y,y1=syaw*x+cyaw*y;
    const cp=Math.cos(pitch),sp=Math.sin(pitch);
    const y2=cp*y1-sp*z,z2=sp*y1+cp*z;
    const perspective=1/(1+Math.max(-.7,Math.min(.7,z2/(span*3))));
    return {x:w/2+x1*scale*perspective,y:h/2-y2*scale*perspective,d:z2,p:perspective};
  }

  function draw(){
    if(disposed)return;
    const w=canvas.width,h=canvas.height;
    if(!w||!h)return;
    ctx.fillStyle="#0b1012";ctx.fillRect(0,0,w,h);
    const scale=Math.min(w,h)*.74/span*zoom;
    const faces=[];
    for(let i=0;i<triangles.length;i+=stride){
      const t=triangles[i],a=vertices[t.a],b=vertices[t.b],c=vertices[t.c];
      if(!a||!b||!c)continue;
      const pa=project(a,w,h,scale),pb=project(b,w,h,scale),pc=project(c,w,h,scale);
      const area=(pb.x-pa.x)*(pc.y-pa.y)-(pb.y-pa.y)*(pc.x-pa.x);
      if(Math.abs(area)<.08)continue;
      const region=Math.max(0,Math.min(palette.length-1,Math.floor(Number(t.region)||0)));
      faces.push({pa,pb,pc,depth:(pa.d+pb.d+pc.d)/3,region,shade:Math.max(.42,Math.min(1.16,.78+Math.abs(area)/(scale*scale)*.35))});
    }
    faces.sort((a,b)=>a.depth-b.depth);
    for(const f of faces){
      const base=palette[f.region]||palette[0];
      const rr=Math.max(0,Math.min(255,Math.round(base[0]*f.shade)));
      const gg=Math.max(0,Math.min(255,Math.round(base[1]*f.shade)));
      const bb=Math.max(0,Math.min(255,Math.round(base[2]*f.shade)));
      ctx.beginPath();ctx.moveTo(f.pa.x,f.pa.y);ctx.lineTo(f.pb.x,f.pb.y);ctx.lineTo(f.pc.x,f.pc.y);ctx.closePath();
      ctx.fillStyle=`rgb(${rr},${gg},${bb})`;ctx.fill();
    }
    ctx.fillStyle="rgba(255,255,255,.78)";
    ctx.font=`${Math.max(12,Math.round(h*.026))}px Arial`;
    ctx.fillText("SOFTWARE 3D · WebGL unavailable",18,h-20);
  }

  const onDown=e=>{dragging=true;lastX=e.clientX;lastY=e.clientY;canvas.setPointerCapture?.(e.pointerId)};
  const onMove=e=>{if(!dragging)return;yaw+=(e.clientX-lastX)*.008;pitch=Math.max(.18,Math.min(1.42,pitch+(e.clientY-lastY)*.007));lastX=e.clientX;lastY=e.clientY;draw()};
  const onUp=()=>{dragging=false};
  const onWheel=e=>{e.preventDefault();zoom=Math.max(.45,Math.min(4,zoom*(e.deltaY>0?.9:1.1)));draw()};

  canvas.addEventListener("pointerdown",onDown);
  canvas.addEventListener("pointermove",onMove);
  canvas.addEventListener("pointerup",onUp);
  canvas.addEventListener("pointercancel",onUp);
  canvas.addEventListener("wheel",onWheel,{passive:false});
  resizeObserver=new ResizeObserver(resize);resizeObserver.observe(canvas);
  resize();

  canvas.dataset.renderState="ready";
  if(statusEl)statusEl.textContent="Software 3D preview active · WebGL is unavailable on this browser. Drag to orbit and wheel/pinch to zoom.";

  return ()=>{
    disposed=true;resizeObserver?.disconnect();
    canvas.removeEventListener("pointerdown",onDown);
    canvas.removeEventListener("pointermove",onMove);
    canvas.removeEventListener("pointerup",onUp);
    canvas.removeEventListener("pointercancel",onUp);
    canvas.removeEventListener("wheel",onWheel);
  };
}

export function renderProductionMeshPreview({canvas,mesh,materials,modelWidthMm=101.6,statusEl=null}={}){
  if(!canvas)throw new Error("Preview canvas is unavailable.");
  canvas.dataset.renderState="loading";
  canvas.dataset.renderMode="webgl";
  canvas.dataset.renderError="";

  let renderer,controls,geometry,materialList=[],resizeObserver,frame=0,disposed=false;
  const webglContext=canvas.getContext("webgl2",{antialias:true,alpha:false,powerPreference:"high-performance"})
    || canvas.getContext("webgl",{antialias:true,alpha:false,powerPreference:"high-performance"});
  if(!webglContext)return renderSoftwarePreview({canvas,mesh,materials,modelWidthMm,statusEl});
  try{
    renderer=new THREE.WebGLRenderer({canvas,context:webglContext,antialias:true,alpha:false,powerPreference:"high-performance"});
    renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio||1,2));
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure=1.18;

    const scene=new THREE.Scene();
    scene.background=new THREE.Color(0x0b1012);
    const camera=new THREE.PerspectiveCamera(34,1,.01,100000);
    scene.add(new THREE.HemisphereLight(0xffffff,0x26333a,2.8));
    const key=new THREE.DirectionalLight(0xffffff,3.4);key.position.set(1.8,2.6,3.2);scene.add(key);
    const rim=new THREE.DirectionalLight(0x7fd7ff,1.4);rim.position.set(-2.5,1.2,-1.8);scene.add(rim);

    geometry=new THREE.BufferGeometry();
    const vertices=mesh?.vertices||[],triangles=mesh?.triangles||[];
    if(!vertices.length||!triangles.length)throw new Error("Generated preview mesh is empty.");
    const positions=new Float32Array(vertices.length*3);
    vertices.forEach((v,i)=>{positions[i*3]=Number(v.x)||0;positions[i*3+1]=Number(v.y)||0;positions[i*3+2]=Number(v.z)||0});
    geometry.setAttribute("position",new THREE.BufferAttribute(positions,3));

    const sourceMaterials=materials?.length?materials:[{name:"Terrain",color:"#808080FF"}];
    materialList=sourceMaterials.map((material,index)=>new THREE.MeshStandardMaterial({
      name:String(material?.name||("Material "+index)),
      color:new THREE.Color(String(material?.color||"#808080").slice(0,7)),
      metalness:0,roughness:.78,side:THREE.DoubleSide
    }));

    const grouped=new Map();
    for(const tri of triangles){
      const region=Math.max(0,Math.min(materialList.length-1,Math.floor(Number(tri.region)||0)));
      if(!grouped.has(region))grouped.set(region,[]);
      grouped.get(region).push(tri.a,tri.b,tri.c);
    }
    const ordered=[];let indexStart=0;
    for(let region=0;region<materialList.length;region++){
      const indices=grouped.get(region)||[];
      if(!indices.length)continue;
      ordered.push(...indices);
      geometry.addGroup(indexStart,indices.length,region);
      indexStart+=indices.length;
    }
    geometry.setIndex(ordered);
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();

    const object=new THREE.Mesh(geometry,materialList);
    object.rotation.x=-Math.PI/2;
    scene.add(object);
    object.updateMatrixWorld(true);

    controls=new OrbitControls(camera,canvas);
    controls.enableDamping=true;controls.dampingFactor=.08;controls.enablePan=false;

    const expected=Math.max(10,Number(modelWidthMm)||101.6);
    const box=new THREE.Box3().setFromObject(object),size=new THREE.Vector3(),center=new THREE.Vector3();
    box.getSize(size);box.getCenter(center);
    const maxDim=Math.max(size.x,size.y,size.z);
    if(!Number.isFinite(maxDim)||maxDim<=0)throw new Error("Generated preview mesh has invalid bounds.");
    const framed=Math.max(maxDim,expected*.7);
    const distance=framed/Math.tan(THREE.MathUtils.degToRad(camera.fov*.5))*.82;
    camera.near=Math.max(.01,framed/5000);camera.far=Math.max(5000,framed*60);
    camera.position.set(center.x+distance*.55,center.y+distance*.65,center.z+distance*.9);
    camera.updateProjectionMatrix();
    controls.target.copy(center);controls.minDistance=framed*.3;controls.maxDistance=framed*8;controls.update();

    const resize=()=>{
      const width=Math.max(320,canvas.clientWidth||canvas.parentElement?.clientWidth||800);
      const height=Math.max(260,canvas.clientHeight||canvas.parentElement?.clientHeight||360);
      renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();
    };
    resize();
    resizeObserver=new ResizeObserver(resize);resizeObserver.observe(canvas);

    const tick=()=>{if(disposed)return;controls.update();renderer.render(scene,camera);frame=requestAnimationFrame(tick)};
    tick();
    canvas.dataset.renderState="ready";
    canvas.dataset.renderMode="webgl";
    if(statusEl)statusEl.textContent="3D preview active · exact generated production mesh. Drag to orbit and wheel/pinch to zoom.";

    return ()=>{
      disposed=true;if(frame)cancelAnimationFrame(frame);resizeObserver?.disconnect();controls?.dispose();
      geometry?.dispose();for(const material of materialList)material.dispose();renderer?.dispose();
    };
  }catch(error){
    try{resizeObserver?.disconnect();controls?.dispose();geometry?.dispose();for(const material of materialList)material.dispose();renderer?.dispose()}catch{}
    const message=String(error?.message||error);
    if(/webgl|context/i.test(message)){
      try{return renderSoftwarePreview({canvas,mesh,materials,modelWidthMm,statusEl})}
      catch(fallbackError){
        canvas.dataset.renderState="error";canvas.dataset.renderError=String(fallbackError?.message||fallbackError);
        if(statusEl)statusEl.textContent=`3D preview failed · ${canvas.dataset.renderError}. The downloadable GLB remains available.`;
        throw fallbackError;
      }
    }
    canvas.dataset.renderState="error";
    canvas.dataset.renderError=message;
    if(statusEl)statusEl.textContent=`3D preview failed · ${message}. The downloadable GLB remains available.`;
    throw error;
  }
}
