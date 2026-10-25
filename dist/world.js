/* Pointer motion and seeded randomness adapted from Aftertouch, MIT.
   Copyright (c) 2026 Nicolas Chapuis and Aftertouch contributors. */
import * as THREE from './vendor/three.module.min.js';
import {chapters} from './data.js';
export function rng(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const cropVector=c=>new THREE.Vector4(c[0]/1448,1-(c[1]+c[3])/1086,c[2]/1448,c[3]/1086);
const fragment=`
uniform sampler2D uImage;uniform sampler2D uPrevious;uniform vec4 uCrop;uniform vec4 uOldCrop;
uniform float uAspect;uniform float uTime;uniform float uFade;uniform float uMyth;uniform vec2 uPointer;uniform float uLife;
varying vec2 vUv;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
vec4 painting(sampler2D tex,vec4 crop){
 vec2 uv=vUv;float aspect=crop.z*1448./(crop.w*1086.);
 if(uAspect>aspect)uv.y=(uv.y-.5)*aspect/uAspect+.5;else uv.x=(uv.x-.5)*uAspect/aspect+.5;
 uv=(uv-.5)*.96+.5;uv+=uPointer*.007;
 float cloud=noise(uv*5.+vec2(uTime*.016,0.));
 vec3 col=texture2D(tex,crop.xy+uv*crop.zw).rgb;
 float fog=pow(cloud,3.)*.055*(1.-smoothstep(.25,.8,uv.y));
 col=mix(col,vec3(.69,.77,.72),fog);
 col*=vec3(.87,.93,.91);col=mix(col,col*vec3(1.10,1.035,.91),uMyth*.55);
 col+=vec3(.12,.08,.018)*uLife*.12;
 return vec4(col,1.);
}
void main(){gl_FragColor=mix(painting(uPrevious,uOldCrop),painting(uImage,uCrop),smoothstep(0.,1.,uFade));
 #include <colorspace_fragment>
}`;
export class LivingWorld{
 constructor(canvas,fx,{reduced=false}={}){
  this.canvas=canvas;this.fx=fx;this.ctx=fx.getContext('2d');this.reduced=reduced;this.time=0;this.index=0;this.stepCount=0;this.pointer={x:0,y:0};this.target={x:0,y:0};this.paused=reduced;this.myth=0;this.fade=1;this.bursts=[];this.history=[];this.seeds=[];this.rain=0;
  this.renderer=new THREE.WebGLRenderer({canvas,alpha:false,antialias:false,powerPreference:'high-performance',preserveDrawingBuffer:true});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));this.renderer.outputColorSpace=THREE.SRGBColorSpace;
  this.scene=new THREE.Scene();this.camera=new THREE.OrthographicCamera(-1,1,1,-1,0,10);this.camera.position.z=1;
  this.uniforms={uImage:{value:null},uPrevious:{value:null},uCrop:{value:cropVector(chapters[0].crop)},uOldCrop:{value:cropVector(chapters[0].crop)},uAspect:{value:1},uTime:{value:0},uFade:{value:1},uMyth:{value:0},uPointer:{value:new THREE.Vector2()},uLife:{value:0}};
  this.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.ShaderMaterial({uniforms:this.uniforms,vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:fragment,depthTest:false,depthWrite:false})));
  const random=rng(7743);this.agents=Array.from({length:90},()=>({x:random(),y:random(),vx:(random()-.5)*.02,vy:(random()-.5)*.02,s:random(),a:random()*6.28}));this.random=random;this.resize();
 }
 async load(){const loader=new THREE.TextureLoader();this.textures=await Promise.all(chapters.map(c=>loader.loadAsync(c.image)));this.textures.forEach(t=>{t.colorSpace=THREE.SRGBColorSpace;t.minFilter=THREE.LinearFilter;t.generateMipmaps=false;});this.uniforms.uImage.value=this.textures[0];this.uniforms.uPrevious.value=this.textures[0];this.render();}
 setChapter(index,steps=0){if(!this.textures)return;this.uniforms.uPrevious.value=this.uniforms.uImage.value;this.uniforms.uOldCrop.value.copy(this.uniforms.uCrop.value);this.uniforms.uImage.value=this.textures[index];this.uniforms.uCrop.value.copy(cropVector(chapters[index].crop));this.index=index;this.stepCount=steps;this.fade=this.reduced?1:0;this.bursts=[];this.seeds=[];this.rain=index===2&&steps===3?1:0;this.history=[];this.render();}
 setPointer(x,y){this.target.x=x*2-1;this.target.y=1-y*2;}
 setMyth(value){this.myth=value?1:0;this.render();}
 points(){if(this.width<=760)return[[.24,.49],[.50,.55],[.77,.47]];return chapters[this.index].points;}
 trace(x,y){this.trail??=[];this.trail.push({x,y,birth:this.time});if(this.trail.length>140)this.trail.shift();}
 activate(n){this.stepCount=n;const [x,y]=this.points()[n-1];this.bursts.push({x,y,time:this.time});for(let i=0;i<18;i++)this.seeds.push({x,y,vx:(this.random()-.5)*.2,vy:-this.random()*.1,birth:this.time});if(this.index===2&&n===3)this.rain=1;this.render();}
 step(dt){
  this.fade=Math.min(1,this.fade+dt*.65);this.pointer.x+=(this.target.x-this.pointer.x)*.035;this.pointer.y+=(this.target.y-this.pointer.y)*.035;
  if(!this.paused){this.time+=dt;for(const p of this.agents){let ax=Math.sin(p.y*6+this.time*.1+p.a)*.004,ay=Math.cos(p.x*4+this.time*.12+p.a)*.003;const hx=(this.target.x+1)/2,hy=(1-this.target.y)/2,dx=hx-p.x,dy=hy-p.y;ax+=dx*.001;ay+=dy*.001;p.vx=(p.vx+ax*dt)*.995;p.vy=(p.vy+ay*dt)*.995;p.x+=p.vx*dt;p.y+=p.vy*dt;if(p.x<0)p.x=1;if(p.x>1)p.x=0;if(p.y<0)p.y=1;if(p.y>1)p.y=0;}
   this.history.push({time:this.time,agents:this.agents.map(p=>({...p}))});if(this.history.length>180)this.history.shift();
  }
 }
 render(){if(!this.textures)return;this.uniforms.uTime.value=this.time;this.uniforms.uFade.value=this.fade;this.uniforms.uPointer.value.set(this.reduced?0:this.pointer.x,this.reduced?0:this.pointer.y);this.uniforms.uMyth.value=this.myth;this.uniforms.uLife.value=this.stepCount/3;this.renderer.render(this.scene,this.camera);this.drawAtmosphere();}
 drawAtmosphere(){const c=this.ctx,w=this.width,h=this.height,t=this.time;c.clearRect(0,0,w,h);const strength=.4+this.myth*.45;
  for(const p of this.agents){let r=1+p.s*1.7,alpha=(.17+Math.sin(t*.8+p.a)*.12)*strength;c.fillStyle=`rgba(248,220,154,${alpha})`;c.beginPath();c.arc(p.x*w,p.y*h,r,0,Math.PI*2);c.fill();}
  if(this.trail?.length){this.trail=this.trail.filter(p=>t-p.birth<3);c.save();c.shadowColor='#e0cc91';c.shadowBlur=12;c.lineWidth=1.8;for(let i=1;i<this.trail.length;i++){let a=this.trail[i-1],b=this.trail[i];c.strokeStyle=`rgba(239,224,175,${Math.max(0,1-(t-b.birth)/3)*.7})`;c.beginPath();c.moveTo(a.x*w,a.y*h);c.lineTo(b.x*w,b.y*h);c.stroke();}c.restore();}
  const points=this.points();if(this.stepCount){c.lineWidth=1.1;c.shadowColor='#e9c779';c.shadowBlur=10;
   for(let n=0;n<this.stepCount-1;n++){const a=points[n],b=points[n+1];c.strokeStyle='rgba(235,211,150,.5)';c.beginPath();c.moveTo(a[0]*w,a[1]*h);c.bezierCurveTo((a[0]+b[0])/2*w,a[1]*h,(a[0]+b[0])/2*w,b[1]*h,b[0]*w,b[1]*h);c.stroke();for(let k=0;k<8;k++){let f=((t*.08+k/8)%1),e=f*f*(3-2*f),x=(a[0]+(b[0]-a[0])*f)*w,y=(a[1]+(b[1]-a[1])*e)*h;c.fillStyle=`rgba(248,225,168,${.25+this.myth*.3})`;c.beginPath();c.arc(x,y,1.5,0,6.28);c.fill();}}
   c.shadowBlur=0;
   if(this.index===1){for(let k=0;k<this.stepCount*7;k++){const f=k/20,x=(.29+f*.42)*w,y=(.65-f*.22)*h+Math.sin(k)*7;c.save();c.translate(x,y);c.rotate(-.5);c.fillStyle=`rgba(212,188,128,${.18+Math.sin(t*.8-k*.3)*.08})`;c.beginPath();c.ellipse(0,0,4,6,0,0,6.28);c.fill();c.restore();}}
   if(this.index===0||this.index===2){const a=points[Math.min(this.stepCount-1,2)];for(let k=0;k<3;k++){let f=(t*.15+k/3)%1;c.strokeStyle=`rgba(224,211,170,${(1-f)*.28})`;c.beginPath();c.ellipse(a[0]*w,a[1]*h,20+f*80,7+f*25,0,0,6.28);c.stroke();}}
  }
  for(const b of this.bursts){let age=t-b.time;if(age>4)continue;c.strokeStyle=`rgba(243,218,157,${Math.max(0,.65-age*.16)})`;c.lineWidth=1;c.beginPath();c.arc(b.x*w,b.y*h,12+age*38,0,6.28);c.stroke();}this.bursts=this.bursts.filter(b=>t-b.time<4);
  for(const s of this.seeds){let age=t-s.birth;if(age>4)continue;let x=(s.x+s.vx*age)*w,y=(s.y+s.vy*age+age*age*.012)*h;c.fillStyle=`rgba(241,216,146,${(1-age/4)*.7})`;c.beginPath();c.ellipse(x,y,2,5,t+s.vx*10,0,6.28);c.fill();}this.seeds=this.seeds.filter(s=>t-s.birth<4);
  if(this.index===2&&(this.myth||this.stepCount>1)){c.save();let x=w*.32,y=h*.60;c.translate(x,y);c.globalAlpha=(.04+this.myth*.07+this.stepCount*.025);c.strokeStyle='#ffe1a1';c.lineWidth=.8;for(let k=0;k<33;k++){let angle=-Math.PI+.3+k/32*(Math.PI-.6),radius=Math.min(w*.24,260);c.beginPath();c.moveTo(0,0);c.quadraticCurveTo(Math.cos(angle)*radius*.5,Math.sin(angle)*radius*.9,Math.cos(angle)*radius,Math.sin(angle)*radius);c.stroke();c.beginPath();c.ellipse(Math.cos(angle)*radius*.82,Math.sin(angle)*radius*.82,8,16,angle+Math.PI/2,0,6.28);c.stroke();}c.restore();}
  if(this.rain){c.strokeStyle='rgba(211,226,215,.16)';c.lineWidth=.8;for(let k=0;k<110;k++){let x=((k*.61803)%1)*w,y=((k*.327+t*.20)%1)*h;c.beginPath();c.moveTo(x,y);c.lineTo(x-8,y+26);c.stroke();}}
 }
 resize(){this.width=this.canvas.parentElement.clientWidth;this.height=this.canvas.parentElement.clientHeight;const dpr=Math.min(devicePixelRatio,1.75);this.renderer.setSize(this.width,this.height,false);this.uniforms.uAspect.value=this.width/this.height;this.fx.width=this.width*dpr;this.fx.height=this.height*dpr;this.ctx.setTransform(dpr,0,0,dpr,0,0);this.render();}
 dispose(){this.renderer.dispose();this.textures?.forEach(t=>t.dispose());}
}
