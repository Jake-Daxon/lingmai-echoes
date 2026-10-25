import * as THREE from 'three';

const TAU = Math.PI * 2;
export const MAX_SEEDS = 48;
export const RADIUS = 3.35;
export function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export const clamp = (x,a,b) => Math.max(a,Math.min(b,x));
const smooth = (a,b,x) => { x = clamp((x-a)/(b-a),0,1); return x*x*(3-2*x); };

const fieldGLSL = `
uniform float uTime;
uniform vec4 uSeeds[48];
uniform vec3 uHand;
uniform float uPress;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
float ground(vec2 p){
 float r=length(p)/3.35;
 float edge=1.-smoothstep(.74,1.,r);
 float n=noise(p*1.35)*.18+noise(p*3.3)*.07;
 float h=(.10+n+sin(p.x*1.3+p.y)*.04)*edge-.08;
 for(int i=0;i<48;i++){
  vec4 s=uSeeds[i]; float age=uTime-s.z;
  float ready=smoothstep(0.,3.0,age)*step(.001,s.w);
  float d=length(p-s.xy);
  h+=exp(-d*d*2.5)*s.w*.27*ready;
  h+=sin(d*9.-age*3.)*exp(-pow(d-age*.8,2.)*2.)*.055*exp(-max(age,0.)*.36)*step(0.,age)*step(.001,s.w);
 }
 float hd=length(p-uHand.xz);
 h+=exp(-hd*hd*2.)*uPress*.15;
 return h*edge-.012;
}
vec3 groundNormal(vec2 p){float e=.012;return normalize(vec3(ground(p-vec2(e,0.))-ground(p+vec2(e,0.)),2.*e,ground(p-vec2(0.,e))-ground(p+vec2(0.,e))));}
`;
const finish = `\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n`;

export class World {
 constructor(canvas) {
  this.canvas=canvas; this.time=0; this.events=[]; this.corals=[]; this.seedSerial=0;
  this.scene=new THREE.Scene();
  this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,preserveDrawingBuffer:true,powerPreference:'high-performance'});
  this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));
  this.renderer.setClearColor(0x081416);
  this.renderer.outputColorSpace=THREE.SRGBColorSpace;
  this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
  this.renderer.toneMappingExposure=1.25;
  this.camera=new THREE.PerspectiveCamera(36,1,.1,100);
  this.angle=.22;this.elevation=.65;this.distance=12.8;this.target=new THREE.Vector3(0,.35,0);
  this.seedUniform=Array.from({length:MAX_SEEDS},()=>new THREE.Vector4(0,0,100000,0));
  this.uniforms={uTime:{value:0},uSeeds:{value:this.seedUniform},uHand:{value:new THREE.Vector3(8,0,8)},uPress:{value:0}};
  this.scene.add(new THREE.HemisphereLight(0xd9f7ee,0x0c252d,3));
  let key=new THREE.DirectionalLight(0xffddb6,4);key.position.set(-3,6,3);this.scene.add(key);
  let fill=new THREE.DirectionalLight(0x70d7dd,3);fill.position.set(4,2,-4);this.scene.add(fill);
  this.root=new THREE.Group();this.scene.add(this.root);
  this.createBackground();this.createTerrain();this.createGrass();this.createShell();this.createSwarm();this.createHand();
  this.raycaster=new THREE.Raycaster();this.hitPlane=new THREE.Plane(new THREE.Vector3(0,1,0),-.15);
  this.pointer=new THREE.Vector3(8,0,8);this.press=0;this.activeHand=false;
  this.snapshot=[];this.snapshotIndex=-1;this.maxSnapshots=1350;
  this.resize();
 }
 createBackground(){
  const geo=new THREE.PlaneGeometry(2,2);
  const mat=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,uniforms:{uAspect:{value:1}},vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,.999,1.);}`,fragmentShader:`varying vec2 vUv;uniform float uAspect;void main(){vec2 p=vUv-.5;p.x*=uAspect;float glow=exp(-dot(p-vec2(.1,.11),p-vec2(.1,.11))*3.9);vec3 col=mix(vec3(.011,.027,.034),vec3(.027,.104,.107),glow*.62);float grain=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453);col+=(grain-.5)*.0012;gl_FragColor=vec4(col,1.);${finish}}`});
  this.background=new THREE.Mesh(geo,mat);this.background.frustumCulled=false;this.background.renderOrder=-100;this.scene.add(this.background);
 }
 createTerrain(){
  let geo=new THREE.CircleGeometry(RADIUS,160,0,TAU); // Replace fan with a dense radial surface.
  geo.dispose();
  const positions=[],uvs=[],indices=[];const rings=85,sectors=160;
  for(let r=0;r<=rings;r++)for(let j=0;j<=sectors;j++){let a=j/sectors*TAU,rad=Math.max(.001,r/rings*RADIUS);positions.push(Math.cos(a)*rad,0,Math.sin(a)*rad);uvs.push(j/sectors,r/rings);}
  for(let r=0;r<rings;r++)for(let j=0;j<sectors;j++){let a=r*(sectors+1)+j,b=a+sectors+1;indices.push(a,b,a+1,b,b+1,a+1);}
  geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geo.setIndex(indices);
  const mat=new THREE.ShaderMaterial({uniforms:this.uniforms,side:THREE.DoubleSide,vertexShader:`${fieldGLSL}varying vec3 vPos;void main(){vec3 p=position;p.y=ground(p.xz);vPos=p;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,fragmentShader:`${fieldGLSL}varying vec3 vPos;void main(){vec3 n=normalize(cross(dFdx(vPos),dFdy(vPos)));if(n.y<0.)n=-n;float light=max(dot(n,normalize(vec3(-.5,1.,.4))),0.);float tex=noise(vPos.xz*13.);vec3 color=mix(vec3(.004,.017,.019),vec3(.016,.068,.055),light*.6+tex*.2);float contour=pow(.5+.5*sin(ground(vPos.xz)*155.),16.);color+=vec3(.025,.08,.055)*contour*.12;vec3 viewDir=normalize(cameraPosition-vPos);float spec=pow(max(dot(reflect(normalize(vec3(.3,-1.,-.8)),n),viewDir),0.),45.);color+=vec3(.17,.34,.31)*spec*.7;float rim=pow(1.-abs(dot(n,viewDir)),3.);color+=vec3(.025,.12,.13)*rim;gl_FragColor=vec4(color,1.);${finish}}`});
  this.terrain=new THREE.Mesh(geo,mat);this.terrain.frustumCulled=false;this.root.add(this.terrain);
 }
 createGrass(){
  const random=rng(87234);const count=16500;const segments=5;const pos=[],uv=[],index=[];
  for(let j=0;j<=segments;j++){let y=j/segments;pos.push(-1,y,0,1,y,0);uv.push(0,y,1,y);if(j<segments){let n=j*2;index.push(n,n+1,n+2,n+1,n+3,n+2);}}
  const geo=new THREE.InstancedBufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(index);
  const bases=new Float32Array(count*3),seeds=new Float32Array(count*3);
  for(let i=0;i<count;i++){let a=random()*TAU,r=Math.sqrt(random())*3.27;bases[i*3]=Math.cos(a)*r;bases[i*3+1]=random();bases[i*3+2]=Math.sin(a)*r;seeds.set([random(),random(),random()],i*3);}
  geo.setAttribute('aBase',new THREE.InstancedBufferAttribute(bases,3));geo.setAttribute('aSeed',new THREE.InstancedBufferAttribute(seeds,3));geo.instanceCount=count;
  const mat=new THREE.ShaderMaterial({side:THREE.DoubleSide,uniforms:this.uniforms,vertexShader:`${fieldGLSL}attribute vec3 aBase;attribute vec3 aSeed;varying float vH;varying float vSeed;varying float vFacing;varying vec3 vWorld;void main(){
   float h=ground(aBase.xz);float edge=1.-smoothstep(2.75,3.34,length(aBase.xz));float len=(.085+aSeed.x*.23+max(h,0.)*.22)*edge;
   float t=position.y;float ang=aSeed.y*6.283;vec3 p=vec3(aBase.x,h,aBase.z);vec2 wind=vec2(sin(uTime*.8+aBase.x*1.7+aBase.z),cos(uTime*.7+aBase.z*1.8))*t*t*len*.25;
   vec2 hd=aBase.xz-uHand.xz;float dist=length(hd);wind+=normalize(hd+.001)*exp(-dist*dist*1.7)*t*t*.32;
   p.xz+=vec2(cos(ang),sin(ang))*position.x*.004*(1.-t*.87)+wind;
   p.y+=t*len;p.xz+=vec2(sin(ang),cos(ang))*t*t*len*.28;
   vH=t;vSeed=aSeed.z;vWorld=p;vFacing=.5+.5*sin(ang);gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
  }`,fragmentShader:`varying float vH;varying float vSeed;varying float vFacing;varying vec3 vWorld;void main(){vec3 base=vec3(.018,.10,.102);vec3 tip=mix(vec3(.25,.48,.42),vec3(.69,.76,.53),vSeed*.8);vec3 col=mix(base,tip,pow(vH,1.8))*(.64+.5*vFacing);float farFade=smoothstep(-3.4,1.8,vWorld.z);col*=.78+farFade*.25;gl_FragColor=vec4(col,1.);${finish}}`});
  this.grass=new THREE.Mesh(geo,mat);this.grass.frustumCulled=false;this.root.add(this.grass);
 }
 createShell(){
  const geo=new THREE.SphereGeometry(1,100,36);
  const mat=new THREE.MeshPhysicalMaterial({color:0x08292d,metalness:.57,roughness:.3,clearcoat:1,clearcoatRoughness:.15});
  this.shell=new THREE.Mesh(geo,mat);this.shell.position.y=-.36;this.shell.scale.set(3.36,.34,3.36);this.root.add(this.shell);
  for(let i=0;i<15;i++){
   const a=.12+i*.088,r=Math.cos(a)*3.35,y=-.34-Math.sin(a)*.34;
   let points=[];for(let j=0;j<=200;j++){let th=j/200*TAU;points.push(new THREE.Vector3(Math.cos(th)*r,y,Math.sin(th)*r));}
   const line=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:0x407875,transparent:true,opacity:.07+(1-i/15)*.10}));this.root.add(line);
  }
  let orbit=[];for(let i=0;i<300;i++){let a=i/300*TAU;orbit.push(new THREE.Vector3(Math.cos(a)*3.83,-.47,Math.sin(a)*3.83));}
  const ring=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(orbit),new THREE.LineBasicMaterial({color:0x75aaa0,transparent:true,opacity:.17}));this.root.add(ring);
  const ticks=[];for(let i=0;i<80;i++){let a=i/80*TAU,r=3.84;let len=i%5===0?.055:.02;ticks.push(Math.cos(a)*r,-.47,Math.sin(a)*r,Math.cos(a)*(r+len),-.47,Math.sin(a)*(r+len));}
  this.root.add(new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(ticks,3)),new THREE.LineBasicMaterial({color:0x75aaa0,transparent:true,opacity:.22})));
 }
 createCoral(event){
  const random=rng(event.id*4397+432);const positions=[],origins=[],normals=[],births=[],tips=[],blooms=[];
  const up=new THREE.Vector3(0,1,0);
  function branch(start,direction,length,radius,depth,birth){
   const end=start.clone().addScaledVector(direction,length);const bend=new THREE.Vector3((random()-.5)*.09,.02,(random()-.5)*.09);
   const tangent=direction.clone().normalize();let side=new THREE.Vector3().crossVectors(tangent,Math.abs(tangent.y)>.95?new THREE.Vector3(1,0,0):up).normalize();let binormal=new THREE.Vector3().crossVectors(tangent,side).normalize();
   const n=4,sides=5;
   const point=(j,k)=>{let t=j/n,ang=k/sides*TAU,rad=radius*(1-t*.67);let center=start.clone().lerp(end,t).addScaledVector(bend,Math.sin(t*Math.PI));let normal=side.clone().multiplyScalar(Math.cos(ang)).addScaledVector(binormal,Math.sin(ang));return {p:center.addScaledVector(normal,rad),n:normal,t};};
   const add=v=>{positions.push(v.p.x,v.p.y,v.p.z);origins.push(start.x,start.y,start.z);normals.push(v.n.x,v.n.y,v.n.z);births.push(birth);tips.push(depth/4+v.t*.17);};
   for(let j=0;j<n;j++)for(let k=0;k<sides;k++){let a=point(j,k),b=point(j,k+1),c=point(j+1,k),d=point(j+1,k+1);add(a);add(b);add(c);add(b);add(d);add(c);}
   if(depth===2)blooms.push({point:end.clone(),birth:birth+.25,scale:.18+random()*.14,seed:random()});
   if(depth<4){let children=depth===0?4:depth===3?2:3;for(let i=0;i<children;i++){let angle=i/children*TAU+random()*.5;const spread=.65+random()*.35;let dir=direction.clone().multiplyScalar(.6).addScaledVector(side,Math.cos(angle)*spread).addScaledVector(binormal,Math.sin(angle)*spread*.65);dir.y+=.25;dir.normalize();branch(end,dir,length*(.59+random()*.09),radius*.61,depth+1,birth+.37);}}
  }
  branch(new THREE.Vector3(),new THREE.Vector3((random()-.5)*.2,1,(random()-.5)*.2).normalize(),.43+random()*.28,.035,0,0);
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));geo.setAttribute('aOrigin',new THREE.Float32BufferAttribute(origins,3));geo.setAttribute('aBirth',new THREE.Float32BufferAttribute(births,1));geo.setAttribute('aTip',new THREE.Float32BufferAttribute(tips,1));
  const tone=event.tone??random();const uniforms={uAge:{value:0},uTime:{value:0},uTone:{value:tone},uScale:{value:event.size}};
  const mat=new THREE.ShaderMaterial({uniforms,vertexShader:`attribute vec3 aOrigin;attribute float aBirth;attribute float aTip;uniform float uAge;uniform float uTime;varying vec3 vNormal;varying vec3 vPos;varying float vTip;varying float vShow;void main(){float g=smoothstep(aBirth,aBirth+.6,uAge);vec3 p=mix(aOrigin,position,g);p.x+=sin(uTime*.7+p.y*3.+position.z)*.025*p.y*p.y;p.z+=cos(uTime*.53+p.y*2.)*.017*p.y*p.y;vNormal=normalize(mat3(modelMatrix)*normal);vPos=(modelMatrix*vec4(p,1.)).xyz;vTip=aTip;vShow=g;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,fragmentShader:`uniform float uTone;uniform float uAge;varying vec3 vNormal;varying vec3 vPos;varying float vTip;varying float vShow;void main(){if(vShow<.002)discard;vec3 n=normalize(vNormal);float key=max(dot(n,normalize(vec3(-.7,1.,.8))),0.);float rim=max(dot(n,normalize(vec3(.8,.3,-1.))),0.);vec3 dark=mix(vec3(.18,.12,.06),vec3(.12,.25,.22),step(.72,uTone));vec3 tip=mix(vec3(1.,.43,.20),vec3(1.,.78,.47),uTone);if(uTone>.72)tip=vec3(.61,.83,.67);vec3 col=mix(dark,tip,smoothstep(-.1,1.,vTip));col*=.35+key*.85;col+=tip*rim*.25;float fres=pow(1.-abs(dot(n,normalize(cameraPosition-vPos))),3.);col+=tip*fres*.14;float birthGlow=exp(-pow(uAge-1.4,2.)*1.5);col+=vec3(.4,.13,.025)*birthGlow*max(vTip,0.);gl_FragColor=vec4(col,1.);${finish}}`});
  const mesh=new THREE.Mesh(geo,mat);mesh.position.set(event.x,this.height(event.x,event.z,event.birth+4),event.z);mesh.rotation.y=random()*TAU;mesh.scale.setScalar(event.size);mesh.frustumCulled=false;this.addBlooms(mesh,blooms,uniforms);this.root.add(mesh);return mesh;
 }
 addBlooms(parent,blooms,uniforms){
  const pos=[],uvs=[],indices=[],rings=12,slices=48;
  for(let r=0;r<=rings;r++)for(let j=0;j<=slices;j++){
   const q=r/rings,a=j/slices*TAU;
   const radius=q*(1+Math.sin(a*9)*.065*q*q);
   const h=.40*Math.pow(1-q,1.5)-.12*Math.sin(q*Math.PI)+Math.sin(a*18+q*5)*.028*q*q;
   pos.push(Math.cos(a)*radius,h,Math.sin(a)*radius);uvs.push(j/slices,q);
  }
  for(let r=0;r<rings;r++)for(let j=0;j<slices;j++){let a=r*(slices+1)+j,b=a+slices+1;indices.push(a,a+1,b,b,a+1,b+1);}
  const geo=new THREE.InstancedBufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geo.setIndex(indices);
  const offsets=[],data=[];for(const b of blooms){offsets.push(b.point.x,b.point.y-.03,b.point.z);data.push(b.birth,b.scale,b.seed);}
  geo.setAttribute('aOffset',new THREE.InstancedBufferAttribute(new Float32Array(offsets),3));geo.setAttribute('aData',new THREE.InstancedBufferAttribute(new Float32Array(data),3));geo.instanceCount=blooms.length;
  const mat=new THREE.ShaderMaterial({uniforms,side:THREE.DoubleSide,vertexShader:`attribute vec3 aOffset;attribute vec3 aData;uniform float uAge;uniform float uTime;varying vec3 vWorld;varying vec2 vUv;varying float vShow;varying float vSeed;void main(){float g=smoothstep(aData.x,aData.x+1.5,uAge);vec3 p=position*aData.y*g;float a=aData.z*6.283;p.xz=mat2(cos(a),-sin(a),sin(a),cos(a))*p.xz;p.y+=sin(uTime*.65+aData.z*8.+p.x*4.)*.012*uv.y;vec3 pt=p+aOffset;pt.x+=sin(uTime*.7+pt.y*3.+aOffset.z)*.025*pt.y*pt.y;pt.z+=cos(uTime*.53+pt.y*2.)*.017*pt.y*pt.y;vWorld=(modelMatrix*vec4(pt,1.)).xyz;vUv=uv;vShow=g;vSeed=aData.z;gl_Position=projectionMatrix*modelViewMatrix*vec4(pt,1.);}`,fragmentShader:`uniform float uTone;uniform float uAge;varying vec3 vWorld;varying vec2 vUv;varying float vShow;varying float vSeed;void main(){if(vShow<.005)discard;vec3 n=normalize(cross(dFdx(vWorld),dFdy(vWorld)));if(n.y<0.)n=-n;float light=max(dot(n,normalize(vec3(-.6,1.,.7))),0.);float back=max(dot(n,normalize(vec3(.8,.3,-1.))),0.);float ribs=pow(.5+.5*cos(vUv.x*6.283*48.),7.);vec3 peach=mix(vec3(.80,.16,.047),vec3(1.,.59,.26),vSeed);vec3 cream=vec3(.58,.80,.58);vec3 col=uTone>.72?cream:peach;col=mix(col*.34,col,smoothstep(0.,.5,vUv.y));col*=.42+light*.78;col+=col*ribs*.23;float edge=pow(vUv.y,12.);col+=vec3(.64,.36,.13)*edge*.65;col+=vec3(.11,.18,.15)*back;vec3 viewDir=normalize(cameraPosition-vWorld);float fres=pow(1.-abs(dot(n,viewDir)),2.);col+=col*fres*.2;gl_FragColor=vec4(col,1.);${finish}}`});
  const mesh=new THREE.Mesh(geo,mat);mesh.frustumCulled=false;parent.add(mesh);
 }
 createSwarm(){
  const random=rng(7743);this.agentCount=560;this.agents=new Float32Array(this.agentCount*6);this.agentSeed=new Float32Array(this.agentCount*3);this.agentPositions=new Float32Array(this.agentCount*3);this.agentTails=new Float32Array(this.agentCount*6);
  for(let i=0;i<this.agentCount;i++){let a=random()*TAU,r=.8+random()*2.5;this.agents.set([Math.cos(a)*r,.5+random()*1.5,Math.sin(a)*r,-Math.sin(a)*.12,(random()-.5)*.05,Math.cos(a)*.12],i*6);this.agentSeed.set([random(),random(),random()],i*3);}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(this.agentPositions,3).setUsage(THREE.DynamicDrawUsage));geo.setAttribute('aSeed',new THREE.BufferAttribute(this.agentSeed,3));
  this.swarm=new THREE.Points(geo,new THREE.ShaderMaterial({uniforms:{uTime:{value:0},uPixelRatio:{value:this.renderer.getPixelRatio()}},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,vertexShader:`attribute vec3 aSeed;varying float vSeed;uniform float uTime;uniform float uPixelRatio;void main(){vec4 p=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*p;vSeed=aSeed.x;gl_PointSize=(5.5+aSeed.y*6.)*uPixelRatio*(8./-p.z)*(0.75+.25*sin(uTime*2.+aSeed.z*20.));}`,fragmentShader:`varying float vSeed;void main(){float d=length(gl_PointCoord-.5)*2.;if(d>1.)discard;float a=pow(1.-d,1.7);vec3 c=mix(vec3(1.,.39,.13),vec3(.4,.89,.79),step(.75,vSeed));gl_FragColor=vec4(c,a*.95);}` }));this.swarm.frustumCulled=false;this.root.add(this.swarm);
  this.tails=new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.BufferAttribute(this.agentTails,3).setUsage(THREE.DynamicDrawUsage)),new THREE.LineBasicMaterial({color:0xe6af69,transparent:true,opacity:.23,blending:THREE.AdditiveBlending,depthWrite:false}));this.tails.frustumCulled=false;this.root.add(this.tails);
  const dustCount=220,pos=new Float32Array(dustCount*3);for(let i=0;i<dustCount;i++)pos.set([(random()-.5)*15,(random()-.5)*7,(random()-.5)*13],i*3);
  this.dust=new THREE.Points(new THREE.BufferGeometry().setAttribute('position',new THREE.BufferAttribute(pos,3)),new THREE.PointsMaterial({color:0xabc5b7,size:.012,transparent:true,opacity:.28,sizeAttenuation:true,depthWrite:false}));this.scene.add(this.dust);
 }
 createHand(){
  this.handGroup=new THREE.Group();this.root.add(this.handGroup);
  const geo=new THREE.RingGeometry(.10,.109,60);geo.rotateX(-Math.PI/2);
  this.handRing=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:0xffdab0,transparent:true,opacity:.7,side:THREE.DoubleSide,depthWrite:false}));this.handGroup.add(this.handRing);
  const dot=new THREE.Mesh(new THREE.SphereGeometry(.022,12,8),new THREE.MeshBasicMaterial({color:0xffdbaf}));this.handGroup.add(dot);
  const lineGeo=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0),new THREE.Vector3(0,1,0)]);
  this.handBeam=new THREE.Line(lineGeo,new THREE.LineBasicMaterial({color:0xfbcbaa,transparent:true,opacity:.28}));this.handGroup.add(this.handBeam);this.handGroup.visible=false;
 }
 height(x,z,t=this.time){
  let edge=1-smooth(.74,1,Math.hypot(x,z)/RADIUS);
  let h=.18+Math.sin(x*1.3+z)*.04;
  for(const s of this.events){const age=t-s.birth;const d=Math.hypot(x-s.x,z-s.z);h+=Math.exp(-d*d*2.5)*s.size*.27*smooth(0,3,age);}
  return h*edge*edge-.09;
 }
 seed(x,z,size=1,tone){
  if(Math.hypot(x,z)>2.95||this.events.length>=MAX_SEEDS)return null;
  const e={x,z,size,birth:this.time,id:++this.seedSerial,tone};this.events.push(e);this.corals.push(this.createCoral(e));this.syncSeeds();return e;
 }
 syncSeeds(){
  for(let i=0;i<MAX_SEEDS;i++){const e=this.events[i];this.seedUniform[i].set(e?.x||0,e?.z||0,e?.birth??100000,e?.size||0);}
 }
 setHand(x,z,press=0,active=true){this.pointer.set(x,.4,z);this.press=press;this.activeHand=active;}
 pointerToWorld(clientX,clientY){
  const rect=this.canvas.getBoundingClientRect();this.raycaster.setFromCamera(new THREE.Vector2((clientX-rect.left)/rect.width*2-1,1-(clientY-rect.top)/rect.height*2),this.camera);let hit=new THREE.Vector3();return this.raycaster.ray.intersectPlane(this.hitPlane,hit)?hit:null;
 }
 step(dt=1/30){
  this.time+=dt;const t=this.time;
  const hand=this.activeHand?this.pointer:null;
  for(let i=0;i<this.agentCount;i++){
   const k=i*6,s=i*3;let x=this.agents[k],y=this.agents[k+1],z=this.agents[k+2],vx=this.agents[k+3],vy=this.agents[k+4],vz=this.agents[k+5];
   let r=Math.hypot(x,z)+.001;let targetY=.65+this.agentSeed[s]*1.6;
   let ax=-x*.085-z*.105,az=-z*.085+x*.105,ay=(targetY-y)*.18;
   ax+=Math.sin(z*1.6+t*.35+this.agentSeed[s+1]*6)*.09;az+=Math.cos(x*1.4+t*.3+this.agentSeed[s+2]*6)*.09;
   if(hand){let dx=hand.x-x,dz=hand.z-z,dy=.95+this.agentSeed[s]*.9-y;let d2=dx*dx+dz*dz+dy*dy+.35;let a=.52/(.5+d2*.25);ax+=(dx*a-dz*.18);az+=(dz*a+dx*.18);ay+=dy*a*.7;}
   if(r>3.4){ax-=x*(r-3.4)*.7;az-=z*(r-3.4)*.7;}
   vx=(vx+ax*dt)*.985;vy=(vy+ay*dt)*.985;vz=(vz+az*dt)*.985;
   this.agents[k]=x+vx*dt;this.agents[k+1]=clamp(y+vy*dt,.25,3.7);this.agents[k+2]=z+vz*dt;this.agents[k+3]=vx;this.agents[k+4]=vy;this.agents[k+5]=vz;
  }
  this.saveSnapshot();
 }
 saveSnapshot(){
  if(this.snapshotIndex<this.snapshot.length-1)this.snapshot.length=this.snapshotIndex+1;
  this.snapshot.push({time:this.time,agents:this.agents.slice(),hand:[this.pointer.x,this.pointer.z,this.press,this.activeHand]});
  if(this.snapshot.length>this.maxSnapshots)this.snapshot.shift();this.snapshotIndex=this.snapshot.length-1;
 }
 rewind(steps=2){
  this.snapshotIndex=Math.max(0,this.snapshotIndex-steps);let s=this.snapshot[this.snapshotIndex];if(!s)return;this.time=s.time;this.agents.set(s.agents);this.pointer.set(s.hand[0],.4,s.hand[1]);this.press=s.hand[2];this.activeHand=s.hand[3];
 }
 branchTimeline(){
  this.snapshot.length=this.snapshotIndex+1;
  for(let i=this.events.length-1;i>=0;i--)if(this.events[i].birth>this.time){this.root.remove(this.corals[i]);this.corals[i].traverse(o=>{o.geometry?.dispose();o.material?.dispose();});this.events.splice(i,1);this.corals.splice(i,1);}
  this.syncSeeds();
 }
 reset(){
  for(const c of this.corals){this.root.remove(c);c.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});}
  this.events=[];this.corals=[];this.seedSerial=0;this.time=0;this.snapshot=[];this.snapshotIndex=-1;this.activeHand=false;this.press=0;this.pointer.set(8,0,8);this.syncSeeds();
  const random=rng(7743);for(let i=0;i<this.agentCount;i++){let a=random()*TAU,r=.8+random()*2.5;this.agents.set([Math.cos(a)*r,.5+random()*1.5,Math.sin(a)*r,-Math.sin(a)*.12,(random()-.5)*.05,Math.cos(a)*.12],i*6);random();random();random();}
  this.saveSnapshot();
 }
 render({angle=this.angle,elevation=this.elevation,distance=this.distance,targetY=.2}={}){
  this.uniforms.uTime.value=this.time;this.uniforms.uHand.value.copy(this.activeHand?this.pointer:new THREE.Vector3(8,0,8));this.uniforms.uPress.value=this.press;
  this.camera.position.set(Math.sin(angle)*distance*Math.cos(elevation),Math.sin(elevation)*distance,Math.cos(angle)*distance*Math.cos(elevation));
  this.camera.lookAt(0,targetY,0);this.camera.updateMatrixWorld();
  for(let i=0;i<this.corals.length;i++){
   const e=this.events[i],c=this.corals[i],age=this.time-e.birth;c.visible=age>=0;c.material.uniforms.uAge.value=age;c.material.uniforms.uTime.value=this.time;c.position.y=this.height(e.x,e.z);const grow=.7+.3*smooth(0,3,age);c.scale.setScalar(e.size*grow);
  }
  for(let i=0;i<this.agentCount;i++){const k=i*6,s=i*3;this.agentPositions.set(this.agents.subarray(k,k+3),s);this.agentTails.set([this.agents[k],this.agents[k+1],this.agents[k+2],this.agents[k]-this.agents[k+3]*.35,this.agents[k+1]-this.agents[k+4]*.35,this.agents[k+2]-this.agents[k+5]*.35],i*6);}
  this.swarm.geometry.attributes.position.needsUpdate=true;this.tails.geometry.attributes.position.needsUpdate=true;this.swarm.material.uniforms.uTime.value=this.time;
  this.handGroup.visible=this.activeHand&&Math.hypot(this.pointer.x,this.pointer.z)<3.4;
  if(this.handGroup.visible){this.handGroup.position.set(this.pointer.x,this.height(this.pointer.x,this.pointer.z)+.05,this.pointer.z);this.handRing.scale.setScalar(.85+Math.sin(this.time*4)*.12+this.press*.25);this.handBeam.scale.y=this.press?.65:.2;}
  this.dust.rotation.y=this.time*.004;
  this.renderer.render(this.scene,this.camera);
 }
 resize(w=innerWidth,h=innerHeight,pixelRatio){if(pixelRatio)this.renderer.setPixelRatio(pixelRatio);this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.background.material.uniforms.uAspect.value=w/h;this.swarm.material.uniforms.uPixelRatio.value=this.renderer.getPixelRatio();}
 stats(){return {time:this.time,corals:this.events.filter(e=>e.birth<=this.time).length,swimmers:this.agentCount,history:this.snapshot.length,historyIndex:this.snapshotIndex,drawCalls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles,memory:this.renderer.info.memory};}
}

