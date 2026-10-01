import { THREE, OrbitControls } from "./vendor/three-glb-viewer.mjs?v=0.183.0";

export function renderProductionMeshPreview({canvas,mesh,materials,modelWidthMm=101.6,statusEl=null}={}){
  if(!canvas)throw new Error("Preview canvas is unavailable.");
  canvas.dataset.renderState="loading";
  canvas.dataset.renderError="";

  let renderer,controls,geometry,materialList=[],resizeObserver,frame=0,disposed=false;
  try{
    renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:"high-performance"});
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
    if(statusEl)statusEl.textContent="3D preview active · exact generated production mesh. Drag to orbit and wheel/pinch to zoom.";

    return ()=>{
      disposed=true;if(frame)cancelAnimationFrame(frame);resizeObserver?.disconnect();controls?.dispose();
      geometry?.dispose();for(const material of materialList)material.dispose();renderer?.dispose();
    };
  }catch(error){
    canvas.dataset.renderState="error";
    canvas.dataset.renderError=String(error?.message||error);
    if(statusEl)statusEl.textContent=`3D preview failed · ${canvas.dataset.renderError}. The downloadable GLB remains available.`;
    try{resizeObserver?.disconnect();controls?.dispose();geometry?.dispose();for(const material of materialList)material.dispose();renderer?.dispose()}catch{}
    throw error;
  }
}
