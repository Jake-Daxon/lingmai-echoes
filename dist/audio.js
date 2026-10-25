// Adapted from Aftertouch (MIT). Copyright (c) 2026 Nicolas Chapuis and Aftertouch contributors.
export class Sound {
 constructor(){this.ctx=null;this.enabled=false;this.notes=[];this.lastNote=-10;this.mode='forward';}
 async start(){
  if(!this.ctx){
   this.ctx=new AudioContext();const c=this.ctx;
   this.master=c.createGain();this.master.gain.value=0;
   const compressor=c.createDynamicsCompressor();compressor.threshold.value=-16;compressor.ratio.value=4;this.master.connect(compressor);compressor.connect(c.destination);
   this.reverb=c.createConvolver();const buffer=c.createBuffer(2,c.sampleRate*3,c.sampleRate);for(let ch=0;ch<2;ch++){const data=buffer.getChannelData(ch);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*Math.pow(1-i/data.length,3.4);}
   this.reverb.buffer=buffer;const wet=c.createGain();wet.gain.value=.34;this.reverb.connect(wet);wet.connect(this.master);
   this.delay=c.createDelay(2);this.delay.delayTime.value=.375;const feedback=c.createGain();feedback.gain.value=.23;const delayGain=c.createGain();delayGain.gain.value=.22;this.delay.connect(feedback);feedback.connect(this.delay);this.delay.connect(delayGain);delayGain.connect(this.master);
   this.pad=c.createGain();this.pad.gain.value=.035;const filter=c.createBiquadFilter();filter.type='lowpass';filter.frequency.value=500;this.pad.connect(filter);filter.connect(this.master);filter.connect(this.reverb);
   for(const hz of [65.406,98,130.812,195.998]){const osc=c.createOscillator();osc.type='sine';osc.frequency.value=hz;osc.detune.value=(Math.random()-.5)*5;osc.connect(this.pad);osc.start();}
   this.flow=c.createOscillator();this.flow.type='sine';this.flow.frequency.value=261.63;this.flowGain=c.createGain();this.flowGain.gain.value=0;this.flow.connect(this.flowGain);this.flowGain.connect(this.reverb);this.flow.start();
  }
  await this.ctx.resume();this.enabled=true;this.master.gain.setTargetAtTime(.75,this.ctx.currentTime,.5);
 }
 toggle(){if(!this.enabled)return this.start();this.enabled=false;this.master?.gain.setTargetAtTime(0,this.ctx.currentTime,.15);return Promise.resolve();}
 pluck(x,z,size=1){
  if(!this.ctx||!this.enabled)return;const c=this.ctx,now=c.currentTime;if(now-this.lastNote<.1)return;this.lastNote=now;
  const scale=[0,2,4,7,9,12,14,16,19,21];const note=scale[Math.min(9,Math.floor((x+3.2)/6.4*10))];let f=130.812*Math.pow(2,note/12);if(z<-.5)f*=2;
  const envelope=c.createGain();envelope.gain.setValueAtTime(0,now);envelope.gain.linearRampToValueAtTime(.15,now+.006);envelope.gain.exponentialRampToValueAtTime(.0001,now+2.8);
  const pan=c.createStereoPanner();pan.pan.value=Math.max(-.75,Math.min(.75,x/4));envelope.connect(pan);pan.connect(this.master);pan.connect(this.reverb);pan.connect(this.delay);
  for(const [multiple,gain] of [[1,.8],[2,.22],[3,.06]]){const o=c.createOscillator(),v=c.createGain();o.type='sine';o.frequency.setValueAtTime(f*multiple,now);o.frequency.exponentialRampToValueAtTime(f*multiple*.998,now+2);v.gain.value=gain;o.connect(v);v.connect(envelope);o.start(now);o.stop(now+3);}
  setTimeout(()=>{envelope.disconnect();pan.disconnect();},3400);
 }
 update(t,hand,reverse){if(!this.ctx)return;let now=this.ctx.currentTime;this.flow.frequency.setTargetAtTime(reverse?98:196+(hand?.x||0)*12,now,.25);this.flowGain.gain.setTargetAtTime(this.enabled?(reverse?.035:hand?.018:0):0,now,.3);this.pad.gain.setTargetAtTime(reverse?.055:.035,now,.5);}
}

