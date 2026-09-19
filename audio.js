/* Pazugoru v0.30 L30 — shared sound device; BGM fetched from a compressed original.
 * No audio recording, accounts or third-party network endpoints.
 */
(() => {
  'use strict';
  const Ctor=window.AudioContext||window.webkitAudioContext;
  const TRACK={title:'芝上のコンボ',url:'bgm.mp3',duration:60};
  const STORE='pazugoru.audio.mix.v30';
  let context=null, output=null, fxMaster=null, music=null, analyser=null;
  let buffer=null, decoding=null, source=null, requestCount=0, starts=0, maxConcurrent=0;
  let offset=0, startedAt=0, away=false, wanted=true, waiting=false, error='', pending=false;
  let bgmVolume=.14, effectsVolume=1, serial=0;
  const channels=new Map(), voices=new Set();
  const sounds={swipe:0,combo:0,attack:0,enemy:0,hit:0,finish:0,victory:0};
  try { const p=JSON.parse(localStorage.getItem(STORE)||'null');
    if(p&&Number.isFinite(p.bgm))bgmVolume=Math.max(0,Math.min(1,p.bgm));
    if(p&&Number.isFinite(p.effects))effectsVolume=Math.max(0,Math.min(1,p.effects));
  } catch(_) {}
  function ramp(param,value,seconds=.05) {
    if(!context)return;
    const t=context.currentTime;
    if(param.cancelAndHoldAtTime)param.cancelAndHoldAtTime(t);
    else{param.cancelScheduledValues(t);param.setValueAtTime(param.value,t);}
    param.setTargetAtTime(value,t,seconds);
  }
  function ensure() {
    if(!Ctor)return null;
    if(context&&context.state!=='closed')return context;
    context=new Ctor({latencyHint:'interactive'});
    output=context.createDynamicsCompressor();
    output.threshold.value=-2; output.knee.value=2;output.ratio.value=12;
    output.attack.value=.003;output.release.value=.12;output.connect(context.destination);
    fxMaster=context.createGain();fxMaster.gain.value=effectsVolume;fxMaster.connect(output);
    music=context.createGain();music.gain.value=0;
    analyser=context.createAnalyser();analyser.fftSize=1024;
    music.connect(analyser);analyser.connect(output);
    context.addEventListener('statechange',()=>{
      if(context.state!=='running'&&source){stopSource();waiting=true;}
      render();
    });
    return context;
  }
  function channel(name,level,params={}) {
    const c=ensure();if(!c)return null;
    if(!channels.has(name)) {
      const gain=c.createGain();gain.gain.value=level;
      const limiter=c.createDynamicsCompressor();
      for(const [key,value] of Object.entries(params))if(limiter[key])limiter[key].value=value;
      gain.connect(limiter);limiter.connect(fxMaster);channels.set(name,gain);
    }
    return {context:c,bus:channels.get(name)};
  }
  function registerVoice(node,links=[]) {
    const entry={node,links};voices.add(entry);
    node.onended=()=>{voices.delete(entry);for(const n of [node,...links])try{n.disconnect();}catch(_){};};
    if(voices.size>64){const old=voices.values().next().value;try{old.node.stop();}catch(_){};}
  }
  function stopEffects(){for(const {node} of voices)try{node.stop();}catch(_){};}
  function position(){return source&&context?(offset+Math.max(0,context.currentTime-startedAt))%60:offset;}
  function stopSource(){if(!source)return;offset=position();const old=source;source=null;try{old.stop();old.disconnect();}catch(_){};}
  function factor(){const app=document.getElementById('app');return app?.dataset.phase==='defeated' ? .14 : (!document.getElementById('resultLayer')?.hidden ? .4 : 1);}
  function levels(){if(!context)return;ramp(music.gain,wanted&&!away&&!document.hidden?bgmVolume*factor():0);ramp(fxMaster.gain,effectsVolume);}
  function render(){
    const app=document.getElementById('app');if(!app)return;
    const playing=!!(source&&context?.state==='running'&&!away&&!document.hidden);
    app.dataset.bgm=playing?'on':error?'error':pending?'loading':waiting?'waiting':'paused';
    for(const [id,val] of [['bgmVolume',bgmVolume],['effectsVolume',effectsVolume]]){
      const input=document.getElementById(id),out=document.getElementById(id+'Value');
      if(input)input.value=String(Math.round(val*100));if(out)out.textContent=Math.round(val*100)+'%';
    }
    const msg=document.getElementById('bgmMessage');if(msg)msg.textContent=!Ctor?'音声非対応のブラウザです。音なしで遊べます。':error?error:
      playing?'芝上のコンボ · 60秒ループ。結果画面ではBGMを控えめにします。':
      pending?'BGMを読み込んでいます。パズルは先に遊べます。':
      'BGMは初期ONです。自動再生が制限される場合は、最初の画面タップから流れます。';
    const retry=document.getElementById('audioRetry');if(retry)retry.hidden=!error;
  }
  async function getBuffer(){
    if(buffer)return buffer;if(decoding)return decoding;
    decoding=(async()=>{
      const c=ensure();if(!c)throw Error('AudioContext unavailable');
      const ac=new AbortController(),timer=setTimeout(()=>ac.abort(),15000);
      try{
        requestCount++;
        const response=await fetch(new URL(TRACK.url,document.baseURI),{signal:ac.signal});
        if(!response.ok)throw Error('BGM HTTP '+response.status);
        const bytes=await response.arrayBuffer();
        if(bytes.byteLength<1000)throw Error('BGM file is empty');
        const decoded=await c.decodeAudioData(bytes);
        if(decoded.numberOfChannels<1||Math.abs(decoded.duration-TRACK.duration)>.15)throw Error('Unexpected BGM duration');
        buffer=decoded;return decoded;
      }finally{clearTimeout(timer);}
    })().catch(e=>{decoding=null;throw e;});
    return decoding;
  }
  function beginSource(){
    if(source||!buffer||!context||context.state!=='running'||away||document.hidden||!wanted)return;
    const node=context.createBufferSource();node.buffer=buffer;node.loop=true;node.loopStart=0;node.loopEnd=Math.min(60,buffer.duration);
    node.connect(music);source=node;startedAt=context.currentTime;
    node.onended=()=>{if(source===node)source=null;try{node.disconnect();}catch(_){};};
    node.start(0,offset%node.loopEnd);starts++;maxConcurrent=Math.max(maxConcurrent,1);waiting=false;levels();render();
  }
  async function enable(origin='gesture'){
    if(!Ctor||document.hidden)return;
    away=false;wanted=true;const c=ensure();
    // resume occurs synchronously in the real tap handler; no synthetic gestures.
    const resume=c.resume().catch(()=>{});
    if(source&&c.state==='running'){levels();return;}
    const token=++serial;pending=!buffer;error='';waiting=c.state!=='running';render();
    let timer;
    try{
      const decoded=getBuffer();
      await Promise.all([decoded,Promise.race([resume,new Promise(r=>{timer=setTimeout(r,1400);})])]);
      if(token!==serial||away||document.hidden)return;
      waiting=c.state!=='running';beginSource();
    }catch(e){
      if(token===serial){error='BGMを読み込めませんでした。メニューの「音を再読み込み」で再試行できます。';console.warn('BGM load:',e.message);}
    }finally{clearTimeout(timer);if(token===serial){pending=false;render();}}
  }
  function unlock(){const c=ensure();if(c&&!document.hidden&&c.state!=='running')c.resume().catch(()=>{});return c;}
  function pause(){serial++;away=true;stopSource();stopEffects();if(context&&context.state!=='closed'){levels();context.suspend().catch(()=>{});}pending=false;render();}
  function setVolume(kind,value){
    value=Number(value);if(!Number.isFinite(value))return;
    if(kind==='bgm')bgmVolume=Math.max(0,Math.min(1,value));else effectsVolume=Math.max(0,Math.min(1,value));
    try{localStorage.setItem(STORE,JSON.stringify({bgm:bgmVolume,effects:effectsVolume}));}catch(_){}
    levels();render();
  }
  function info(){let rms=0;
    if(analyser&&context?.state==='running'){const data=new Float32Array(analyser.fftSize);analyser.getFloatTimeDomainData(data);rms=Math.sqrt(data.reduce((a,x)=>a+x*x,0)/data.length);}
    return{version:'0.30-L30',title:TRACK.title,playing:!!(source&&context?.state==='running'&&!away),state:context?.state||'uncreated',
      wanted,waiting,pending,error,position:position(),duration:buffer?.duration||0,requestCount,starts,maxConcurrent,active:source?1:0,voices:voices.size,
      bgmVolume,effectsVolume,rms,channels:channels.size,sounds:{...sounds}};
  }
  window.PazugoruAudio=Object.freeze({channel,unlock,registerVoice,stopEffects,enable,levels,setVolume,info,count:name=>{if(name in sounds)sounds[name]++;}});
  for(const type of ['pointerdown','pointerup','touchend','keydown'])document.addEventListener(type,e=>{
    if(!e.isTrusted||document.hidden||(e.type==='keydown'&&e.repeat))return;
    if(e.pointerType==='mouse'&&e.button!==0)return;
    unlock();if(!source||context?.state!=='running')void enable('gesture');
  },{capture:true,passive:true});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();else{away=false;void enable('return');}});
  window.addEventListener('pagehide',pause);window.addEventListener('pageshow',()=>{away=false;void enable('return');});
  document.getElementById('bgmVolume')?.addEventListener('input',e=>setVolume('bgm',Number(e.target.value)/100));
  document.getElementById('effectsVolume')?.addEventListener('input',e=>setVolume('effects',Number(e.target.value)/100));
  document.getElementById('audioRetry')?.addEventListener('click',()=>void enable('retry'));
  const app=document.getElementById('app');if(app)new MutationObserver(levels).observe(app,{attributes:true,attributeFilter:['data-phase']});
  render();void enable('load');
  if(new URLSearchParams(location.search).get('test')==='1')window.__pazugoruBgmTest={info,enable,pause,setVolume,
    seek:sec=>{stopSource();offset=Math.max(0,Number(sec))%60;away=false;beginSource();},
    loopProof:async()=>{await getBuffer();const O=window.OfflineAudioContext||window.webkitOfflineAudioContext;
      const o=new O(2,44100,44100);const n=o.createBufferSource();n.buffer=buffer;n.loop=true;n.loopEnd=60;n.connect(o.destination);n.start(0,59.75);
      const r=await o.startRendering();return{samples:r.length,peak:Math.max(...r.getChannelData(0).slice(10500,12000)),duration:buffer.duration};}};
})();
