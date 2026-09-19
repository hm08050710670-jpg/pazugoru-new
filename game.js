
/* パズゴル v0.9 R09 — reaction sheet integration, 2026-09-17
 * Self-contained: no accounts, tracking, external libraries, or network requests.
 * Tile identities and DOM nodes persist through a drag. A single animation loop
 * draws held tiles at the finger and interpolates displaced tiles into vacancies.
 */
(() => {
  'use strict';
  const Audio=window.PazugoruAudio, Assets=window.PazugoruAssets;
  if(!Audio||!Assets){
    document.getElementById('loadText').textContent='音声または素材のプログラムが読み込めません。ZIP内の全ファイルが必要です。';
    const retry=document.getElementById('loadRetry');retry.hidden=false;retry.onclick=()=>location.reload();return;
  }


  /* Original swipe/cell-cross SFX — short, bright, addictive feedback.
     No external audio assets; generated with Web Audio so the HTML stays self-contained. */
  const SwipeSound = (()=>{
    const AudioCtor=window.AudioContext||window.webkitAudioContext;
    let ctx=null, master=null, lastAt=0, step=0;
    const ensure=()=>{const ch=Audio.channel('swipe',.34,{threshold:-12,knee:8,ratio:4,attack:.002,release:.08});if(!ch)return null;ctx=ch.context;master=ch.bus;return Audio.unlock();};
    const hit=(speed=1)=>{
      const c=ensure();if(!c||c.state!=='running')return;
      const now=c.currentTime;
      if(now-lastAt<.022)return;lastAt=now;Audio.count('swipe');step=(step+1)%6;
      const pitch=[880,990,1110,1245,1110,990][step]*(.97+Math.min(1.35,speed)*.035);
      const o=c.createOscillator(),g=c.createGain(),f=c.createBiquadFilter();
      o.type='triangle';o.frequency.setValueAtTime(pitch,now);o.frequency.exponentialRampToValueAtTime(pitch*1.14,now+.026);
      f.type='highpass';f.frequency.value=520;
      g.gain.setValueAtTime(.0001,now);g.gain.exponentialRampToValueAtTime(.18,now+.0025);g.gain.exponentialRampToValueAtTime(.0001,now+.050);
      o.connect(f);f.connect(g);g.connect(master);Audio.registerVoice(o,[f,g]);o.start(now);o.stop(now+.055);
      const o2=c.createOscillator(),g2=c.createGain();o2.type='sine';o2.frequency.setValueAtTime(pitch*2.02,now);
      g2.gain.setValueAtTime(.035,now);g2.gain.exponentialRampToValueAtTime(.0001,now+.027);o2.connect(g2);g2.connect(master);Audio.registerVoice(o2,[g2]);o2.start(now);o2.stop(now+.03);
    };
    return {unlock:ensure,hit};
  })();

  /* Original match/combo sound. Inspired by the responsive feel of puzzle games,
     but synthesized from scratch with no copied commercial audio. */
  const MatchJuice=(()=>{
    const AudioCtor=window.AudioContext||window.webkitAudioContext;let ctx=null,bus=null;
    function ensure(){const ch=Audio.channel('combo',.47,{threshold:-10,ratio:5,attack:.002,release:.10});if(!ch)return null;ctx=ch.context;bus=ch.bus;return Audio.unlock();}
    function tone(f,t,d,g,type='sine',slide=1){const c=ensure();if(!c||c.state!=='running')return;const o=c.createOscillator(),v=c.createGain();o.type=type;o.frequency.setValueAtTime(f,t);o.frequency.exponentialRampToValueAtTime(Math.max(80,f*slide),t+d);v.gain.setValueAtTime(.0001,t);v.gain.exponentialRampToValueAtTime(g,t+.004);v.gain.exponentialRampToValueAtTime(.0001,t+d);o.connect(v);v.connect(bus);Audio.registerVoice(o,[v]);o.start(t);o.stop(t+d+.01)}
    function pop(size,combo){const c=ensure();if(!c||c.state!=='running')return;Audio.count('combo');const t=c.currentTime,up=Math.min(combo-1,9)*42;if(size<=3){tone(500+up,t,.075,.17,'triangle',1.28);tone(1010+up,t+.012,.045,.055)}else if(size===4){tone(560+up,t,.095,.19,'triangle',1.38);tone(840+up,t+.018,.075,.09,'sine',1.18);tone(1320+up,t+.025,.05,.05)}else{tone(470+up,t,.13,.22,'triangle',1.48);tone(705+up,t+.015,.12,.12,'sine',1.30);tone(1055+up,t+.03,.10,.08,'sine',1.20);tone(1580+up,t+.045,.07,.045)}if(combo>=2)tone(690+combo*58,t+.055,.09,Math.min(.14,.055+combo*.008),'triangle',1.30);if(combo>=3)tone(220+combo*13,t+.018,.11,Math.min(.16,.075+combo*.009),'triangle',.78);if(combo>=5)tone(1180+combo*35,t+.075,.14,.14,'sine',1.28);if(combo>=7)tone(1760+combo*28,t+.10,.10,.10,'sine',1.16)}
    return {unlock:ensure,pop};
  })();
    const BattleSound=(()=>{const AudioCtor=window.AudioContext||window.webkitAudioContext;let ctx=null,bus=null,started=false;function ensure(){const ch=Audio.channel('battle',.54,{threshold:-9,ratio:6,attack:.002,release:.12});if(!ch)return null;ctx=ch.context;bus=ch.bus;return Audio.unlock();}function tone(f,t,d,g,type='triangle',to=1){const c=ensure();if(!c||c.state!=='running')return;const o=c.createOscillator(),v=c.createGain();o.type=type;o.frequency.setValueAtTime(f,t);o.frequency.exponentialRampToValueAtTime(Math.max(55,f*to),t+d);v.gain.setValueAtTime(.0001,t);v.gain.exponentialRampToValueAtTime(g,t+.003);v.gain.exponentialRampToValueAtTime(.0001,t+d);o.connect(v);v.connect(bus);Audio.registerVoice(o,[v]);o.start(t);o.stop(t+d+.02)}function attack(combo){const c=ensure();if(!c||c.state!=='running')return;Audio.count('attack');const t=c.currentTime,p=Math.min(combo,10);tone(185+p*8,t,.18,.28,'sawtooth',.62);tone(520+p*32,t+.018,.15,.22,'triangle',1.55);tone(980+p*45,t+.045,.12,.16,'sine',1.38);if(combo>=5)tone(1450+p*28,t+.075,.14,.12,'sine',1.22)}function enemy(){const c=ensure();if(!c||c.state!=='running')return;Audio.count('enemy');const t=c.currentTime;tone(340,t,.18,.25,'sawtooth',.52);tone(155,t+.025,.22,.28,'triangle',.65);tone(760,t+.05,.10,.12,'square',.72)}function playerHit(){const c=ensure();if(!c||c.state!=='running')return;Audio.count('hit');const t=c.currentTime;tone(118,t,.30,.38,'sawtooth',.48);tone(235,t+.008,.22,.32,'square',.58);tone(520,t+.018,.12,.22,'triangle',.42);tone(82,t+.035,.34,.34,'sine',.72)}function finish(){const c=ensure();if(!c||c.state!=='running')return;Audio.count('finish');const t=c.currentTime;tone(105,t,.46,.40,'sawtooth',.40);tone(210,t+.018,.38,.34,'triangle',.55);tone(420,t+.055,.32,.28,'triangle',1.70);tone(840,t+.12,.28,.22,'sine',1.55);tone(1260,t+.22,.32,.18,'sine',1.28);tone(1680,t+.34,.42,.14,'sine',.92)}function start(){if(started)return;const c=ensure();if(!c||c.state!=='running')return;started=true;const t=c.currentTime;tone(523,t,.10,.10,'sine',1.18);tone(659,t+.075,.12,.11,'sine',1.15);tone(784,t+.15,.16,.12,'sine',1.10)}function victory(){const c=ensure();if(!c||c.state!=='running')return;Audio.count('victory');const t=c.currentTime+.04;const notes=[[392,0,.16,.13],[523.25,.16,.16,.14],[659.25,.32,.18,.15],[783.99,.50,.22,.17],[659.25,.78,.12,.11],[783.99,.91,.12,.12],[987.77,1.05,.24,.18],[1046.5,1.34,.18,.16],[1318.5,1.53,.52,.20]];for(const [f,o,d,g] of notes){tone(f,t+o,d,g,'triangle',1.015);tone(f*2,t+o+.008,Math.min(.16,d*.72),g*.28,'sine',1.005)}tone(196,t,.42,.10,'sine',.98);tone(261.63,t+.50,.38,.10,'sine',.98);tone(329.63,t+1.05,.48,.11,'sine',.98);tone(523.25,t+1.53,.62,.12,'sine',.99)}return {unlock:ensure,attack,enemy,playerHit,finish,victory,start};})();
function matchBurst(point,size,combo){const count=Math.min(16,6+Math.max(0,size-3)*2+Math.min(combo,5)),wrap=document.createElement('span');wrap.className='match-burst';wrap.style.left=point.x+'px';wrap.style.top=point.y+'px';ui.effects.appendChild(wrap);for(let n=0;n<count;n++){const dot=document.createElement('i');wrap.appendChild(dot);const a=Math.PI*2*n/count+combo*.21,d=22+size*5+(n%3)*7,x=Math.cos(a)*d,y=Math.sin(a)*d;animateElement(dot,[{transform:'translate(-50%,-50%) scale(.45)',opacity:1},{transform:`translate(calc(-50% + ${x}px),calc(-50% + ${y}px)) scale(${size>=5?1.25:.8})`,opacity:0}],{duration:motion(300+size*22),easing:'cubic-bezier(.1,.7,.2,1)',fill:'both'})}setTimeout(()=>wrap.remove(),motion(520));const ring=document.createElement('span');ring.className='match-ring';ring.style.left=(point.x-22)+'px';ring.style.top=(point.y-22)+'px';ui.effects.appendChild(ring);const ra=animateElement(ring,[{transform:'scale(.35)',opacity:.95},{transform:`scale(${size>=5?2.2:size===4?1.75:1.35})`,opacity:0}],{duration:motion(300),easing:'ease-out',fill:'both'});if(ra)ra.finished.then(()=>ring.remove()).catch(()=>ring.remove());ui.board.classList.remove('combo-kick');void ui.board.offsetWidth;ui.board.classList.add('combo-kick');setTimeout(()=>ui.board.classList.remove('combo-kick'),110);if(combo>=2){const b=document.createElement('span');b.className='combo-banner';b.textContent=combo>=10?`${combo} COMBO!!`:combo>=5?`${combo} COMBO!`:`${combo} COMBO`;ui.effects.appendChild(b);const sc=combo>=10?1.82:combo>=7?1.58:combo>=5?1.44:1.18,ba=animateElement(b,[{transform:'translate(-50%,-50%) scale(.45) rotate(-5deg)',opacity:0},{transform:`translate(-50%,-50%) scale(${sc}) rotate(-2deg)`,opacity:1,offset:.25},{transform:'translate(-50%,-80%) scale(1)',opacity:0}],{duration:motion(500),easing:'ease-out',fill:'both'});if(ba)ba.finished.then(()=>b.remove()).catch(()=>b.remove())}}


  const VERSION = '0.39-BODY39';
  let POSES=Object.freeze({});
  let activeStage=null, loadSerial=0;
  const COLS = 6, ROWS = 5, SIZE = COLS * ROWS;
  const COLORS = ['red', 'blue', 'green', 'yellow', 'purple', 'pink'];
  const LABELS = ['赤・炎', '青・水滴', '緑・葉', '黄・雷', '紫・渦', 'ピンク・回復'];
  let CONFIG = Object.freeze({ enemyMax:1200, playerMax:3200, enemyAttack:260,
    enemyEvery:2, attackPerBall:42, comboStep:.38, healPerBall:38, healComboStep:.2 });
  const $ = id => document.getElementById(id);
  const ui = { app:$('app'), viewport:$('viewport'), hero:$('hero'), board:$('board'),
    shell:$('boardShell'), cells:$('cells'), pieces:$('pieces'), slot:$('slot'),
    status:$('status'), enemyHud:$('enemyHud'), enemyBar:$('enemyBar'),
    enemyFill:$('enemyFill'), enemyTrail:$('enemyTrail'), enemyNumber:$('enemyNumber'),
    playerHud:$('playerHud'), playerBar:$('playerBar'), playerFill:$('playerFill'),
    playerNumber:$('playerNumber'), count:$('turnCount'), attackCount:$('attackCount'),
    dragon:$('dragon'), anchor:$('dragonAnchor'), effects:$('effects'), word:$('battle-word'),
    menu:$('menuButton'), help:$('helpLayer'), result:$('resultLayer') };
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const state = { phase:'loading', grid:[], tiles:new Map(), nextId:1, drag:null,
    turn:0, enemy:CONFIG.enemyMax, player:CONFIG.playerMax, maxCombo:0,
    epoch:0, geometry:null, keyboardIndex:0, lastResult:null, refillQueue:[], bossPhase2Shown:false, bossRageShown:false };
  let frameId=0, lastFrame=0, layoutFrame=0, wordAnimation=null, dragonAnimation=null;
  let rng=Math.random;
  let faceTimer=0;
  const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
  const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const motion=ms=>reducedMotion.matches?Math.min(ms,45):ms;
  const randomColor=()=>state.refillQueue.length ? state.refillQueue.shift() : Math.floor(rng()*6);
  class StaleRun extends Error {}
  async function wait(ms,epoch){await pause(ms);if(epoch!==state.epoch)throw new StaleRun();}
  function setStatus(text){ui.status.textContent=text;}
  function modalMode(open){ui.viewport.classList.toggle('modal-open',open);ui.app.classList.toggle('modal-open',open);}
  function setPhase(phase){state.phase=phase;ui.app.dataset.phase=phase;ui.menu.disabled=phase!=='ready';posePhase(phase);}

  // Pure match rules. 4/5/6 in a straight line disappear as one group;
  // touching horizontal/vertical matches of the same color are a single combo.
  function findGroups(types){
    const matched=new Set();
    for(let r=0;r<ROWS;r++){
      for(let c=0;c<COLS;){let end=c+1;const color=types[r*COLS+c];
        while(end<COLS&&types[r*COLS+end]===color)end++;
        if(color!=null&&end-c>=3)for(let x=c;x<end;x++)matched.add(r*COLS+x);
        c=end;
      }
    }
    for(let c=0;c<COLS;c++){
      for(let r=0;r<ROWS;){let end=r+1;const color=types[r*COLS+c];
        while(end<ROWS&&types[end*COLS+c]===color)end++;
        if(color!=null&&end-r>=3)for(let y=r;y<end;y++)matched.add(y*COLS+c);
        r=end;
      }
    }
    const seen=new Set(), result=[];
    for(const start of matched){
      if(seen.has(start))continue;
      const stack=[start], cells=[];seen.add(start);
      while(stack.length){const i=stack.pop();cells.push(i);const r=Math.floor(i/COLS),c=i%COLS;
        for(const [dr,dc] of [[0,1],[0,-1],[1,0],[-1,0]]){
          const nr=r+dr,nc=c+dc,n=nr*COLS+nc;
          if(nr>=0&&nr<ROWS&&nc>=0&&nc<COLS&&matched.has(n)&&!seen.has(n)&&types[n]===types[i]){
            seen.add(n);stack.push(n);
          }
        }
      }
      result.push({color:types[start],cells});
    }
    return result;
  }
  function hasEasyMove(types){
    for(let i=0;i<SIZE;i++)for(const n of [i%COLS<COLS-1?i+1:-1,i+COLS<SIZE?i+COLS:-1]){
      if(n<0)continue;
      const copy=types.slice();[copy[i],copy[n]]=[copy[n],copy[i]];
      if(findGroups(copy).length)return true;
    }
    return false;
  }
  function freshTypes(){
    let types=[];
    for(let attempt=0;attempt<100;attempt++){
      types=[];
      for(let i=0;i<SIZE;i++){
        const possible=COLORS.map((_,c)=>c).filter(c=>
          !(i%COLS>=2&&types[i-1]===c&&types[i-2]===c)&&
          !(i>=COLS*2&&types[i-COLS]===c&&types[i-COLS*2]===c));
        types.push(possible[Math.floor(rng()*possible.length)]);
      }
      if(hasEasyMove(types))return types;
    }
    return types;
  }
  function currentTypes(){return state.grid.map(tile=>tile?tile.color:null);}
  function center(index){const g=state.geometry;return {x:(index%COLS+.5)*g.step,y:(Math.floor(index/COLS)+.5)*g.step};}
  function orbMarkup(color){return `<span class="orb"><svg viewBox="0 0 100 100" aria-hidden="true"><use href="#orb-${COLORS[color]}"></use></svg></span>`;}
  function createTile(color,index,startRow){
    const tile={id:state.nextId++,color,index,x:0,y:0,tx:0,ty:0,renderX:NaN,renderY:NaN,el:document.createElement('div')};
    tile.el.className='tile';tile.el.dataset.id=String(tile.id);tile.el.dataset.color=COLORS[color];
    tile.el.innerHTML=orbMarkup(color);ui.pieces.appendChild(tile.el);state.tiles.set(tile.id,tile);
    const pos=center(index);tile.tx=pos.x;tile.ty=pos.y;tile.x=pos.x;tile.y=startRow==null?pos.y:(startRow+.5)*state.geometry.step;
    sizeTile(tile);paintTile(tile);return tile;
  }
  function sizeTile(tile){const d=state.geometry.diameter;tile.el.style.width=d+'px';tile.el.style.height=d+'px';tile.renderX=NaN;}
  function paintTile(tile){
    if(tile.renderX===tile.x&&tile.renderY===tile.y)return;
    const d=state.geometry.diameter;
    tile.el.style.transform=`translate3d(${(tile.x-d/2).toFixed(2)}px,${(tile.y-d/2).toFixed(2)}px,0)`;
    tile.el.dataset.index=String(tile.index);tile.renderX=tile.x;tile.renderY=tile.y;
  }
  function targetTile(tile,index){tile.index=index;const p=center(index);tile.tx=p.x;tile.ty=p.y;tile.el.dataset.index=String(index);}
  function requestDraw(){if(!frameId){lastFrame=performance.now();frameId=requestAnimationFrame(drawFrame);}}
  function drawFrame(now){
    frameId=0;const dt=clamp(now-lastFrame,1,34);lastFrame=now;
    const k=reducedMotion.matches?1:1-Math.exp(-dt/34);
    let stillMoving=false;
    for(const tile of state.tiles.values()){
      if(state.drag&&tile===state.drag.tile){tile.x=state.drag.displayX;tile.y=state.drag.displayY;}
      else {
        const dx=tile.tx-tile.x,dy=tile.ty-tile.y;
        if(Math.abs(dx)+Math.abs(dy)>.14){tile.x+=dx*k;tile.y+=dy*k;stillMoving=true;}
        else{tile.x=tile.tx;tile.y=tile.ty;}
      }
      paintTile(tile);
    }
    if(stillMoving)frameId=requestAnimationFrame(drawFrame);
  }
  function measure(){
    const r=ui.board.getBoundingClientRect();
    state.geometry={left:r.left,top:r.top,width:r.width,height:r.height,step:r.width/COLS,diameter:r.width/COLS*.94};
  }
  function resize(){
    layoutFrame=0;
    if(!ui.app.isConnected)return;
    const vv=window.visualViewport;
    const vh=vv?vv.height:window.innerHeight,vw=vv?vv.width:window.innerWidth;
    const vpStyle=getComputedStyle(ui.viewport);
    const safeH=(parseFloat(vpStyle.paddingTop)||0)+(parseFloat(vpStyle.paddingBottom)||0);
    const safeW=(parseFloat(vpStyle.paddingLeft)||0)+(parseFloat(vpStyle.paddingRight)||0);
    const usableH=Math.max(220,Math.min(870,vh-safeH));
    const width=Math.min(vw-safeW,460,Math.max(210,(usableH-305)*1.2+40));
    const willChange=state.geometry&&(Math.abs(ui.app.clientWidth-width)>2);
    if(willChange&&state.drag)cancelDrag('画面サイズが変わったため、この手を元に戻しました');
    document.documentElement.style.setProperty('--screen-h',vh+'px');
    document.documentElement.style.setProperty('--screen-w',vw+'px');
    document.documentElement.style.setProperty('--app-w',width+'px');
    const scale=clamp((ui.hero.clientHeight-62)/320,.26,1.13);
    document.documentElement.style.setProperty('--dragon-scale',scale.toFixed(3));
    if(activeStage){
      const d=activeStage.display, box=d.inkBounds, env=d.motionBounds;
      const heroRect=ui.hero.getBoundingClientRect(), titleRect=document.querySelector('.stage-title').getBoundingClientRect();
      const menuRect=ui.menu.getBoundingClientRect(), hudRect=ui.enemyHud.getBoundingClientRect();
      const top=Math.max(titleRect.bottom,menuRect.bottom)-heroRect.top+10;
      const bottom=hudRect.top-heroRect.top-10;
      const gap=14, safeW=Math.max(60,heroRect.width-32), safeH=Math.max(40,bottom-top);
      const scale=Math.min(d.visibleHeight/(box[3]-box[1]),Math.max(.04,(safeW-gap*2)/(env[2]-env[0])),Math.max(.04,(safeH-gap*2)/(env[3]-env[1])));
      const y=top+(safeH-(env[3]-env[1])*scale)/2-env[1]*scale;
      ui.anchor.style.setProperty('--actor-w',(d.frameWidth*scale)+'px');
      ui.anchor.style.setProperty('--actor-h',(d.frameHeight*scale)+'px');
      ui.anchor.style.setProperty('--actor-y',y+'px');
      ui.anchor.dataset.displayScale=String(scale);
    }
    measure();
    for(const tile of state.tiles.values()){sizeTile(tile);targetTile(tile,tile.index);if(!state.drag){tile.x=tile.tx;tile.y=tile.ty;}paintTile(tile);}
    if(state.drag){state.drag.lastLocal=null;requestDraw();}
  }
  function scheduleLayout(){if(!layoutFrame)layoutFrame=requestAnimationFrame(resize);}
  function updateHP(){
    const er=state.enemy/CONFIG.enemyMax,pr=state.player/CONFIG.playerMax;
    ui.enemyFill.style.transform=`scaleX(${er})`;ui.enemyTrail.style.transform=`scaleX(${er})`;
    ui.playerFill.style.transform=`scaleX(${pr})`;
    ui.enemyNumber.textContent=`${state.enemy.toLocaleString('ja-JP')} / ${CONFIG.enemyMax.toLocaleString('ja-JP')}`;
    ui.playerNumber.textContent=`${state.player.toLocaleString('ja-JP')} / ${CONFIG.playerMax.toLocaleString('ja-JP')}`;
    ui.enemyBar.setAttribute('aria-valuemax',String(CONFIG.enemyMax));ui.playerBar.setAttribute('aria-valuemax',String(CONFIG.playerMax));
    ui.enemyBar.setAttribute('aria-valuenow',String(state.enemy));ui.playerBar.setAttribute('aria-valuenow',String(state.player));
    ui.playerHud.classList.toggle('low',pr<=.25);
    const every=currentEnemyEvery(),left=every-state.turn%every;
    ui.count.textContent=`あと${left}ターン`;ui.attackCount.classList.toggle('soon',left===1);
  }
  function bossPhase(){
    if(activeStage?.element!=='fire'||!activeStage?.bossPhases)return {rage:false,phase2:false,every:CONFIG.enemyEvery,healMultiplier:1};
    const ratio=state.enemy/CONFIG.enemyMax,bp=activeStage.bossPhases;
    const rage=ratio<=bp.rage.hpRatio,phase2=ratio<=bp.phase2.hpRatio;
    return {rage,phase2,every:(rage?bp.rage.enemyEvery:phase2?bp.phase2.enemyEvery:CONFIG.enemyEvery),healMultiplier:rage?(bp.rage.healMultiplier||1):1};
  }
  function currentEnemyEvery(){return bossPhase().every;}
  function resetGame(types){
    ui.hero.classList.remove('boss-rage');state.bossPhase2Shown=false;state.bossRageShown=false;
    state.epoch++;Audio.stopEffects();resetDirector();
    clearTimeout(faceTimer);ui.dragon.classList.remove('hurt1','hurt2','hurt3','ko');
    if(state.drag)cancelDrag('');
    if(wordAnimation)wordAnimation.cancel();if(dragonAnimation)dragonAnimation.cancel();
    ui.effects.replaceChildren();ui.word.style.opacity='0';ui.result.hidden=true;ui.help.hidden=true;modalMode(false);
    ui.shell.classList.remove('resolving');ui.pieces.replaceChildren();state.tiles.clear();
    state.turn=0;state.enemy=CONFIG.enemyMax;state.player=CONFIG.playerMax;state.bossPhase2Shown=false;state.bossRageShown=false;state.maxCombo=0;state.lastResult=null;state.refillQueue=[];
    setPhase('ready');measure();
    state.grid=(types||freshTypes()).map((color,index)=>createTile(color,index));
    state.keyboardIndex=0;ui.slot.style.display='none';updateHP();setStatus('ボールを押したまま動かそう');requestDraw();
  }

  // Input coordinates are derived from fixed cell geometry, never animated DOM bounds.
  // Even at high pointer speed, interpolate the observed path across each intervening cell.
  function localPoint(x,y){const g=state.geometry;return {x:x-g.left,y:y-g.top};}
  function logicalPoint(p){const g=state.geometry;return {x:clamp(p.x,.001,g.width-.001),y:clamp(p.y,.001,g.height-.001)};}
  function indexAt(p){const g=state.geometry;return clamp(Math.floor(p.y/g.step),0,ROWS-1)*COLS+clamp(Math.floor(p.x/g.step),0,COLS-1);}
  function showSlot(index){const g=state.geometry,p=center(index),d=g.diameter*.91;ui.slot.style.cssText=`display:block;width:${d}px;height:${d}px;left:${p.x-d/2}px;top:${p.y-d/2}px`;} 
  function beginDrag(x,y,pointerId,kind){
    SwipeSound.unlock();
    MatchJuice.unlock();
    BattleSound.unlock();BattleSound.start();
    if(state.phase!=='ready'||!ui.help.hidden||!ui.result.hidden)return false;
    measure();const p=localPoint(x,y),g=state.geometry;
    if(p.x<0||p.x>=g.width||p.y<0||p.y>=g.height)return false;
    const index=indexAt(p),tile=state.grid[index],pos=center(index);
    if(!tile)return false;
    state.drag={tile,pointerId,kind,index,moved:false,snapshot:state.grid.slice(),lastLocal:logicalPoint(p),displayX:pos.x,displayY:pos.y,
      offsetX:pos.x-p.x,offsetY:pos.y-p.y};
    tile.el.classList.add('held');showSlot(index);setPhase('dragging');
    setStatus('指を離すまで操作できます · 枠の外から戻ってもOK');requestDraw();return true;
  }
  function swapStep(next){
    const d=state.drag;if(!d||next===d.index)return;
    const old=d.index,neighbor=state.grid[next];
    state.grid[old]=neighbor;state.grid[next]=d.tile;targetTile(neighbor,old);targetTile(d.tile,next);
    d.index=next;d.moved=true;showSlot(next);
    const velocity=d.lastLocal?Math.hypot(d.displayX-d.lastLocal.x,d.displayY-d.lastLocal.y)/(state.geometry.step||1):1;
    SwipeSound.hit(velocity);
  }
  function advanceAt(p){
    const d=state.drag,g=state.geometry;if(!d)return;
    const dest=indexAt(p);let remaining=COLS+ROWS;
    // Small hysteresis prevents rapid swapping at a cell boundary.
    while(d.index!==dest&&remaining-->0){
      const c=d.index%COLS,r=Math.floor(d.index/COLS),dc=dest%COLS-c,dr=Math.floor(dest/COLS)-r;
      const pos=center(d.index),dx=(p.x-pos.x)/g.step,dy=(p.y-pos.y)/g.step;
      let next=-1;
      if(dc!==0&&Math.abs(dx)>.54&&(dr===0||Math.abs(dx)>=Math.abs(dy)))next=d.index+Math.sign(dc);
      else if(dr!==0&&Math.abs(dy)>.54)next=d.index+COLS*Math.sign(dr);
      else break;
      swapStep(next);
    }
  }
  function moveDrag(x,y){
    const d=state.drag;if(!d)return;
    const g=state.geometry,raw=localPoint(x,y),p=logicalPoint(raw),from=d.lastLocal||p;
    const dist=Math.hypot(p.x-from.x,p.y-from.y);
    const steps=Math.max(1,Math.ceil(dist/(g.step*.2)));
    for(let n=1;n<=steps;n++)advanceAt({x:from.x+(p.x-from.x)*n/steps,y:from.y+(p.y-from.y)*n/steps});
    d.lastLocal=p;
    // The visible ball may follow a little outside the frame; the logical cell clamps
    // to the edge. Capture is not released, no matter how far it goes within the page.
    d.displayX=clamp(raw.x+d.offsetX,-g.step*.12,g.width+g.step*.12);
    d.displayY=clamp(raw.y+d.offsetY,-g.step*.12,g.height+g.step*.12);
    requestDraw();
  }
  function releaseCapture(d){try{if(d.kind==='pointer'&&ui.board.hasPointerCapture(d.pointerId))ui.board.releasePointerCapture(d.pointerId);}catch(_){}}
  function cancelDrag(message){
    const d=state.drag;if(!d)return;
    state.drag=null;state.grid=d.snapshot;
    state.grid.forEach((tile,i)=>{targetTile(tile,i);tile.el.classList.remove('held','keyboard-picked');});
    ui.slot.style.display='none';releaseCapture(d);setPhase('ready');if(message)setStatus(message);requestDraw();
  }
  function endDrag(){
    const d=state.drag;if(!d)return;
    state.drag=null;d.tile.el.classList.remove('held','keyboard-picked');ui.slot.style.display='none';
    releaseCapture(d);requestDraw();
    if(!d.moved){setPhase('ready');setStatus('ボールを押したまま、隣のマスへ動かそう');return;}
    setPhase('settling');runTurn(state.epoch).catch(onRunError);
  }
  function onRunError(error){
    if(error instanceof StaleRun)return;
    console.error('Pazugoru:',error);state.drag=null;setPhase('ready');ui.slot.style.display='none';ui.shell.classList.remove('resolving');
    setStatus('操作を再開できません。メニューから最初からやり直してください');
  }
  function prevent(e){if(e.cancelable)e.preventDefault();}
  if('PointerEvent' in window){
    ui.board.addEventListener('pointerdown',e=>{
      if(e.isPrimary===false||(e.pointerType==='mouse'&&e.button!==0))return;
      if(beginDrag(e.clientX,e.clientY,e.pointerId,'pointer')){prevent(e);try{ui.board.setPointerCapture(e.pointerId);}catch(_){}}
    },{passive:false});
    document.addEventListener('pointermove',e=>{
      if(!state.drag||state.drag.kind!=='pointer'||state.drag.pointerId!==e.pointerId)return;
      prevent(e);
      const samples=typeof e.getCoalescedEvents==='function'?e.getCoalescedEvents():[];
      for(const sample of samples)moveDrag(sample.clientX,sample.clientY);
      moveDrag(e.clientX,e.clientY);
    },{passive:false});
    document.addEventListener('pointerup',e=>{
      if(!state.drag||state.drag.kind!=='pointer'||state.drag.pointerId!==e.pointerId)return;
      prevent(e);moveDrag(e.clientX,e.clientY);endDrag();
    },{passive:false});
    document.addEventListener('pointercancel',e=>{
      if(state.drag&&state.drag.kind==='pointer'&&state.drag.pointerId===e.pointerId)cancelDrag('入力が中断されたため、この手を元に戻しました');
    });
    ui.board.addEventListener('lostpointercapture',e=>{
      if(state.drag&&state.drag.kind==='pointer'&&state.drag.pointerId===e.pointerId)cancelDrag('入力が中断されたため、この手を元に戻しました');
    });
  } else {
    // Older touch-only browsers: preserve the initiating touch identifier.
    ui.board.addEventListener('touchstart',e=>{if(state.drag)return;const t=e.changedTouches[0];if(t&&beginDrag(t.clientX,t.clientY,t.identifier,'touch'))prevent(e);},{passive:false});
    document.addEventListener('touchmove',e=>{if(!state.drag||state.drag.kind!=='touch')return;const t=[...e.touches].find(t=>t.identifier===state.drag.pointerId);if(t){prevent(e);moveDrag(t.clientX,t.clientY);}},{passive:false});
    document.addEventListener('touchend',e=>{if(!state.drag||state.drag.kind!=='touch')return;const t=[...e.changedTouches].find(t=>t.identifier===state.drag.pointerId);if(t){prevent(e);moveDrag(t.clientX,t.clientY);endDrag();}},{passive:false});
    document.addEventListener('touchcancel',()=>cancelDrag('入力が中断されたため、この手を元に戻しました'));
  }
  // Safari fallback: do not let a touch that belongs to the game start page scrolling.
  // The layout itself has no page-sized scroll range. System/browser chrome cannot be captured.
  document.addEventListener('touchmove',e=>{if(state.drag||(!e.target.closest('.sheet,.reaction-sheet')&&ui.help.hidden&&ui.result.hidden))prevent(e);},{passive:false,capture:true});
  document.addEventListener('touchstart',e=>{if(state.drag&&e.touches.length>1)prevent(e);},{passive:false,capture:true});
  document.addEventListener('gesturestart',e=>{if(state.drag||e.target.closest('#board'))prevent(e);},{passive:false});
  document.addEventListener('gesturechange',e=>{if(state.drag)prevent(e);},{passive:false});
  ui.app.addEventListener('contextmenu',e=>{if(state.drag||e.target.closest('#board'))prevent(e);});
  ui.app.addEventListener('dragstart',prevent);
  window.addEventListener('blur',()=>cancelDrag('操作を中断しました。この手は元に戻っています'));
  document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelDrag('操作を中断しました。この手は元に戻っています');});
  window.addEventListener('orientationchange',()=>cancelDrag('画面の向きが変わったため、この手を元に戻しました'));
  // Keyboard parity; it does not add a second concurrent gesture.
  ui.board.addEventListener('keydown',e=>{
    const dirs={ArrowLeft:-1,ArrowRight:1,ArrowUp:-COLS,ArrowDown:COLS};
    if(e.key==='Escape'&&state.drag&&state.drag.kind==='keyboard'){prevent(e);cancelDrag('操作を取り消しました');return;}
    if(e.key===' '||e.key==='Enter'){
      prevent(e);
      if(state.drag&&state.drag.kind==='keyboard'){state.keyboardIndex=state.drag.index;endDrag();}
      else if(state.phase==='ready'){const p=center(state.keyboardIndex),g=state.geometry;beginDrag(p.x+g.left,p.y+g.top,-1,'keyboard');}
      return;
    }
    if(!(e.key in dirs)||(state.phase!=='ready'&&!(state.drag&&state.drag.kind==='keyboard')))return;
    prevent(e);const old=state.drag?state.drag.index:state.keyboardIndex;
    const next=old+dirs[e.key];if(next<0||next>=SIZE||(e.key==='ArrowLeft'&&old%COLS===0)||(e.key==='ArrowRight'&&old%COLS===COLS-1))return;
    state.keyboardIndex=next;
    if(state.drag){const p=center(next),g=state.geometry;moveDrag(p.x+g.left,p.y+g.top);}
    else{showSlot(next);setStatus(`${Math.floor(next/COLS)+1}行 ${next%COLS+1}列 · ${LABELS[state.grid[next].color]} · スペースで持つ`);}
  });

  function appPoint(x,y){const r=ui.app.getBoundingClientRect();return {x:x-r.left,y:y-r.top};}
  function centerOf(el){const r=el.getBoundingClientRect();return appPoint(r.left+r.width/2,r.top+r.height/2);}
  function animateElement(el,frames,options){
    if(typeof el.animate==='function')return el.animate(frames,options);
    Object.assign(el.style,frames[frames.length-1]);return null;
  }
  function floating(text,point,className='float-text',duration=700){
    const el=document.createElement('span');el.className=className;el.textContent=text;ui.effects.appendChild(el);
    const scale=className==='combo-pop'?1.08:1;
    const anim=animateElement(el,[
      {transform:`translate(${point.x}px,${point.y}px) translate(-50%,-50%) scale(.8)`,opacity:0},
      {transform:`translate(${point.x}px,${point.y-6}px) translate(-50%,-50%) scale(${scale})`,opacity:1,offset:.2},
      {transform:`translate(${point.x}px,${point.y-26}px) translate(-50%,-50%) scale(1)`,opacity:0}
    ],{duration:motion(duration),easing:'ease-out',fill:'both'});
    if(anim)anim.finished.then(()=>el.remove()).catch(()=>el.remove());else setTimeout(()=>el.remove(),duration);
  }
  function battleWord(text,n=1){
    if(wordAnimation)wordAnimation.cancel();ui.word.textContent=text;
    ui.word.style.top=Math.max(88,ui.hero.clientHeight*.34)+'px';ui.word.style.fontSize=(n>=10?29:n>=7?28:33)+'px';
    wordAnimation=animateElement(ui.word,[{opacity:0,transform:'scale(.65) rotate(-4deg)'},{opacity:1,transform:'scale(1.13) rotate(-2deg)',offset:.2},{opacity:1,transform:'scale(1)',offset:.65},{opacity:0,transform:'scale(1) translateY(-12px)'}],{duration:motion(730),fill:'both'});
  }
  function hitWord(combo){return combo<=2?'ペチッ！':combo<=4?'バシッ！':combo<=6?'ドン！！':combo<=9?'ドドドドッ！！！':'ULTRA SHOT!!';}
  function grassScatter(point,count){
    for(let i=0;i<count;i++){const e=document.createElement('i');e.className='grass-chip';ui.effects.appendChild(e);const angle=i*2.39996,dist=20+(i%4)*9;
      const a=animateElement(e,[{transform:`translate(${point.x}px,${point.y}px) rotate(0)`,opacity:1},{transform:`translate(${point.x+Math.cos(angle)*dist}px,${point.y+Math.sin(angle)*dist-16}px) rotate(${i*73}deg)`,opacity:0}],{duration:motion(330),fill:'both',easing:'ease-out'});
      if(a)a.finished.then(()=>e.remove()).catch(()=>e.remove());else e.remove();
    }
  }
  function impact(point,combo){
    if(!reducedMotion.matches)grassScatter(point,Math.min(10,3+combo));
    const el=document.createElement('div');el.className='spark';el.style.left=(point.x-25)+'px';el.style.top=(point.y-25)+'px';ui.effects.appendChild(el);
    const a=animateElement(el,[{transform:'scale(.3)',opacity:.9},{transform:`scale(${Math.min(2.5,.8+combo*.14)})`,opacity:0}],{duration:motion(220),easing:'ease-out',fill:'both'});
    if(a)a.finished.then(()=>el.remove()).catch(()=>el.remove());else el.remove();
  }
  // Artwork director: independent of tile input, path interpolation and matching.
  let directorReady=false, idleClock=0, idleStamp=0, poseAnimation=null;
  let previewOpen=false, previewSerial=0, expressionTimer=0, currentPose='normal';
  const spriteImage=$('dragonImage'), spriteVisual=$('dragonVisual'), poseNote=$('poseNote');
  const poseLog=[];
  // Stage assets are held by PazugoruAssets, not by a global preload-all array.
  function setPose(name,force=false){
    if(!POSES[name])name='normal';
    if(!POSES[name])return;
    if(name===currentPose&&!force)return;
    currentPose=name;
    spriteImage.src=POSES[name].src;spriteImage.alt=`${activeStage?.name||'モンスター'}：${POSES[name].label}`;
    ui.dragon.dataset.pose=name;
    ui.dragon.classList.toggle('ko',name==='defeated');
    poseNote.textContent=POSES[name].note||'';
    if(poseAnimation){poseAnimation.cancel();poseAnimation=null;}
    if(['happy','smile','wink'].includes(name)){
      poseAnimation=animateElement(spriteVisual,[{transform:'translateY(0) rotate(-2deg)'},{transform:'translateY(-4px) rotate(2deg)'},{transform:'translateY(0) rotate(-2deg)'}],{duration:motion(1500),iterations:reducedMotion.matches?1:Infinity,easing:'ease-in-out'});
    } else if(['curious','stare'].includes(name)){
      poseAnimation=animateElement(spriteVisual,[{transform:'rotate(-3deg)'},{transform:'rotate(3deg)'},{transform:'rotate(-3deg)'}],{duration:motion(2200),iterations:reducedMotion.matches?1:Infinity,easing:'ease-in-out'});
    } else if(name==='sleepy'){
      poseAnimation=animateElement(spriteVisual,[{transform:'translateY(0) rotate(-1deg)'},{transform:'translateY(3px) rotate(3deg)'},{transform:'translateY(0) rotate(-1deg)'}],{duration:motion(2600),iterations:reducedMotion.matches?1:Infinity,easing:'ease-in-out'});
    }
    poseLog.push({pose:name,phase:state.phase,time:Math.round(performance.now())});if(poseLog.length>100)poseLog.shift();
  }
  function idlePose(){
    if(!directorReady||previewOpen||document.hidden||!ui.help.hidden||!ui.result.hidden||state.phase!=='ready')return;
    const elapsed=(performance.now()-idleStamp)/1000;
    if(elapsed<4)return;
    const t=elapsed%32;
    const next=state.enemy/CONFIG.enemyMax<.22?(t<9?'worried':t<16?'cry':t<23?'alert':'grumpy'):
      t<4?'normal':t<8?'happy':t<14?'curious':t<18?'stare':t<25?'sleepy':t<28?'smile':'normal';
    setPose(next);
  }
  function posePhase(phase){
    if(!directorReady||previewOpen)return;
    if(phase==='dragging'){
      clearTimeout(expressionTimer);clearTimeout(faceTimer);
      if(currentPose==='sleepy'){
        setPose('surprised');const ep=state.epoch;
        expressionTimer=setTimeout(()=>{if(ep===state.epoch&&state.phase==='dragging')setPose('alert');},motion(480));
      } else setPose('alert');
      idleStamp=performance.now();
    }else if(phase==='ready'){
      ui.dragon.classList.remove('hurt1','hurt2','hurt3');
      clearTimeout(faceTimer);clearTimeout(expressionTimer);idleStamp=performance.now();
      setPose(state.enemy/CONFIG.enemyMax<.35?'worried':'normal');
    }else if(phase==='resolving'){
      clearTimeout(expressionTimer);setPose('alert');
    }
  }
  function resetDirector(){
    clearTimeout(faceTimer);clearTimeout(expressionTimer);clearInterval(idleClock);
    previewOpen=false;previewSerial++;
    if($('reactionLayer'))$('reactionLayer').hidden=true;
    if(poseAnimation){poseAnimation.cancel();poseAnimation=null;}
    ui.dragon.classList.remove('hurt1','hurt2','hurt3','ko');
    ui.app.classList.remove('power-attack');ui.hero.classList.remove('charged');
    ui.result.classList.remove('win');
    idleStamp=performance.now();setPose('normal',true);
    if(directorReady)idleClock=setInterval(idlePose,700);
  }
  function briefly(name,ms=950){
    clearTimeout(expressionTimer);setPose(name);const ep=state.epoch;
    expressionTimer=setTimeout(()=>{if(state.epoch===ep&&!previewOpen&&state.phase==='ready'){idleStamp=performance.now();setPose('normal');}},motion(ms));
  }
  function dragonFace(combo){
    clearTimeout(faceTimer);clearTimeout(expressionTimer);
    const key=combo<=2?'hurt1':combo<=4?'hurt2':'hurt3';setPose(key,true);
    ui.dragon.classList.remove('hurt1','hurt2','hurt3');ui.dragon.classList.add(key);
    const ep=state.epoch;
    faceTimer=setTimeout(()=>{if(ep===state.epoch&&state.enemy>0&&!previewOpen&&state.phase==='ready'){ui.dragon.classList.remove(key);setPose('normal');}},motion(950));
  }
  function starCloud(point,n=5){
    for(let i=0;i<n;i++){
      const e=document.createElement('span');e.className='reaction-star';e.textContent=i%2?'✦':'★';ui.effects.appendChild(e);
      const a=i*2*Math.PI/n;
      const anim=animateElement(e,[{transform:`translate(${point.x}px,${point.y}px) scale(.3)`,opacity:1},
        {transform:`translate(${point.x+Math.cos(a)*42}px,${point.y+Math.sin(a)*28-12}px) rotate(${i*65}deg) scale(1)`,opacity:.95,offset:.45},
        {transform:`translate(${point.x+Math.cos(a)*57}px,${point.y+Math.sin(a)*39-15}px) scale(.2)`,opacity:0}],{duration:motion(620),easing:'ease-out',fill:'both'});
      if(anim)anim.finished.then(()=>e.remove()).catch(()=>e.remove());else e.remove();
    }
  }
  function actorPoint(){
    const r=ui.anchor.getBoundingClientRect(), b=activeStage?.display.inkBounds;
    return b?appPoint(r.left+r.width*((b[0]+b[2])/1024),r.top+r.height*(b[1]+(b[3]-b[1])*.54)/512):centerOf(ui.anchor);
  }
  function energyBall(point,kind='attack'){
    const e=document.createElement('div');e.className='enemy-ball '+kind;
    e.innerHTML='<i></i>';ui.effects.appendChild(e);
    e.style.left=(point.x-22)+'px';e.style.top=(point.y-22)+'px';return e;
  }
  function attackKind(){return state.enemy<=CONFIG.enemyMax*.25?'special':state.enemy<=CONFIG.enemyMax*.55?'strong':'attack';}
  async function korafuLeafAttack(kind='attack',epoch=state.epoch){
    const origin=actorPoint(),target=centerOf(ui.playerBar),count=kind==='special'?12:kind==='strong'?10:7;
    // actorPoint already targets visible body.
    const tasks=[];
    for(let i=0;i<count;i++){const e=document.createElement('i');e.className='leaf-shot';ui.effects.appendChild(e);
      const ox=origin.x-12+(i%4)*8,oy=origin.y+(i%3)*6,tx=target.x-40+i*80/(count-1),ty=target.y;
      const a=animateElement(e,[{transform:`translate(${ox}px,${oy}px) rotate(${i*38}deg) scale(.45)`,opacity:0},{opacity:1,offset:.12},{transform:`translate(${(ox+tx)/2}px,${oy-25+(i%3)*9}px) rotate(${180+i*65}deg) scale(1)`,opacity:1,offset:.5},{transform:`translate(${tx}px,${ty}px) rotate(${520+i*90}deg) scale(.8)`,opacity:.8}],{duration:motion(320+i*14),easing:'cubic-bezier(.2,.72,.32,1)',fill:'both'});
      tasks.push(a?a.finished.then(()=>e.remove()).catch(()=>e.remove()):Promise.resolve(e.remove()));
    }
    await Promise.all(tasks);if(epoch!==state.epoch)throw new StaleRun();
    grassScatter(target,kind==='special'?14:8);
  }
  
  function bunkerSandAttack(){
    const origin=actorPoint(),target=centerOf(ui.playerBar);
    for(let i=0;i<9;i++){
      const e=document.createElement('i');e.className='sand-shot';ui.effects.appendChild(e);
      const ox=origin.x-15+(i%3)*12,oy=origin.y+(i%3)*5,tx=target.x-50+i*12,ty=target.y+(i%2)*8;
      const a=animateElement(e,[{transform:`translate(${ox}px,${oy}px) scale(.35)`,opacity:0},
      {opacity:1,offset:.12},{transform:`translate(${(ox+tx)/2}px,${oy-42}px) scale(1.15)`,opacity:.9,offset:.55},
      {transform:`translate(${tx}px,${ty}px) scale(.65)`,opacity:0}],{duration:motion(390+i*17),easing:'cubic-bezier(.2,.72,.32,1)',fill:'both'});
      if(a)a.finished.then(()=>e.remove()).catch(()=>e.remove());else setTimeout(()=>e.remove(),540);
    }
  }

  function roughRushAttack(){
    const origin=actorPoint(),target=centerOf(ui.playerBar);
    for(let i=0;i<8;i++){const e=document.createElement('i');e.className='rough-shot';ui.effects.appendChild(e);
      const ox=origin.x-35+i*8,oy=origin.y+(i%3)*5,tx=target.x-48+i*14,ty=target.y+(i%2)*7;
      const a=animateElement(e,[{transform:`translate(${ox}px,${oy}px) rotate(${i*16}deg) scale(.4)`,opacity:0},{opacity:1,offset:.12},
      {transform:`translate(${tx}px,${ty}px) rotate(${250+i*37}deg) scale(1.1)`,opacity:.9}],{duration:motion(300+i*13),easing:'cubic-bezier(.15,.8,.25,1)',fill:'both'});
      if(a)a.finished.then(()=>e.remove()).catch(()=>e.remove());else setTimeout(()=>e.remove(),480);}
  }
  function fireBreathAttack(){
    const origin=actorPoint(),target=centerOf(ui.playerBar);
    for(let i=0;i<10;i++){const e=document.createElement('i');e.className='fire-shot';ui.effects.appendChild(e);
      const ox=origin.x-12+(i%3)*8,oy=origin.y-15+(i%4)*6,tx=target.x-55+i*12,ty=target.y+(i%2)*8;
      const a=animateElement(e,[{transform:`translate(${ox}px,${oy}px) scale(.3)`,opacity:0},{opacity:1,offset:.1},
      {transform:`translate(${(ox+tx)/2}px,${oy-25}px) scale(1.25)`,opacity:1,offset:.55},{transform:`translate(${tx}px,${ty}px) scale(.65)`,opacity:.3}],{duration:motion(350+i*16),easing:'cubic-bezier(.2,.7,.25,1)',fill:'both'});
      if(a)a.finished.then(()=>e.remove()).catch(()=>e.remove());else setTimeout(()=>e.remove(),520);}
  }
async function enemyShot(epoch){
    clearTimeout(faceTimer);clearTimeout(expressionTimer);ui.dragon.classList.remove('hurt1','hurt2','hurt3');
    const ratio=state.enemy/CONFIG.enemyMax,kind=ratio<=.25?'special':ratio<=.55?'strong':'attack';setPose(kind);ui.count.textContent='攻撃！';
    const element=activeStage?.element||'grass';
    const words={
      sand:[kind==='special'?'サンドストーム！':kind==='strong'?'バンカーラッシュ！':'砂弾！','砂'],
      rough:[kind==='special'?'ラフサイクロン！':kind==='strong'?'ラフラッシュ！':'突進！','ラフ'],
      fire:[kind==='special'?'ファイアバースト！':kind==='strong'?'フレイムブレス！':'火炎！','炎'],
      grass:[kind==='special'?'グリーントルネード！':kind==='strong'?'リーフストーム！':'葉っぱショット！','草']
    }[element]||['攻撃！','属性'];
    setStatus(`${activeStage.name}の${words[1]}攻撃`);battleWord(words[0],kind==='special'?8:kind==='strong'?5:2);
    if(dragonAnimation)dragonAnimation.cancel();dragonAnimation=animateElement(ui.dragon,[{transform:'translateX(0) scale(1)'},{transform:'translateX(-5px) scale(.96)',offset:.3},{transform:'translateX(8px) scale(1.04)',offset:.62},{transform:'translateX(0) scale(1)'}],{duration:motion(330),easing:'ease-out'});
    if(element==='sand')bunkerSandAttack();else if(element==='rough')roughRushAttack();else if(element==='fire')fireBreathAttack();else korafuLeafAttack();
    await wait(motion(430),epoch);impact(centerOf(ui.playerBar),kind==='special'?7:kind==='strong'?5:2);return kind;
  }
  function playerDamageFX(){ui.playerHud.classList.remove('player-hit');void ui.playerHud.offsetWidth;ui.playerHud.classList.add('player-hit');setTimeout(()=>ui.playerHud.classList.remove('player-hit'),560);const f=document.createElement('div');f.className='hit-screen';ui.effects.appendChild(f);const a=animateElement(f,[{opacity:0},{opacity:.95,offset:.18},{opacity:0}],{duration:motion(430),easing:'ease-out',fill:'both'});if(a)a.finished.then(()=>f.remove()).catch(()=>f.remove());else setTimeout(()=>f.remove(),450)}
  async function defeatedSequence(epoch,combo){
    setPhase('defeated');clearTimeout(faceTimer);clearTimeout(expressionTimer);
    if(dragonAnimation)dragonAnimation.cancel();
    setPose('hurt3');BattleSound.finish();battleWord('FINISH!!',Math.max(combo,7));
    dragonAnimation=animateElement(ui.dragon,[{transform:'translateY(0) rotate(0)'},{transform:'translateY(-12px) rotate(-8deg)'},{transform:'translateY(1px) rotate(0)'}],{duration:motion(370),easing:'ease-out'});
    starCloud(actorPoint(),6);await wait(motion(370),epoch);
    if(dragonAnimation)dragonAnimation.cancel();ui.dragon.classList.remove('hurt1','hurt2','hurt3');
    setPose('defeated',true);
    dragonAnimation=animateElement(ui.dragon,[{transform:'translateY(-6px)',opacity:.8},{transform:'translateY(2px)',opacity:1,offset:.65},{transform:'translateY(0)',opacity:1}],{duration:motion(340),easing:'ease-out'});
    const floor=actorPoint();floor.y+=ui.anchor.getBoundingClientRect().height*.25;starCloud(floor,5);
    ui.count.textContent='撃破！';setStatus(`${activeStage.name}を撃破！`);
    const hasNext=!!Assets.nextId();
    if(hasNext){
      await wait(motion(360),epoch);
      finish(true);
    }else{
      await wait(motion(300),epoch);BattleSound.victory();battleWord('VICTORY!',10);
      await wait(1500,epoch);finish(true);
    }
  }
  function openReactions(){
    if(state.phase!=='ready')return;
    ui.help.hidden=true;previewOpen=true;previewSerial++;clearTimeout(faceTimer);clearTimeout(expressionTimer);
    setPhase('preview');$('reactionLayer').hidden=false;modalMode(true);
    ui.app.classList.add('reaction-preview');previewReaction('normal');
  }
  function closeReactions(){
    previewOpen=false;previewSerial++;
    $('reactionLayer').hidden=true;ui.app.classList.remove('reaction-preview');ui.hero.classList.remove('charged');
    ui.effects.replaceChildren();if(dragonAnimation)dragonAnimation.cancel();
    modalMode(false);setPhase('ready');setStatus('ボールを押したまま動かそう');ui.menu.focus({preventScroll:true});
  }
  function previewReaction(name){
    if(!POSES[name]||!previewOpen)return;
    previewSerial++;setPose(name,true);ui.effects.replaceChildren();
    if(dragonAnimation)dragonAnimation.cancel();
    ui.hero.classList.remove('charged');
    $('poseCaption').textContent=POSES[name].label;
    $('poseDetail').textContent=POSES[name].detail;
    document.querySelectorAll('[data-preview-pose]').forEach(b=>b.classList.toggle('selected',b.dataset.previewPose===name));
    if(POSES[name].kind==='hit'){
      const c=name==='hurt1'?1:name==='hurt2'?3:7;
      const strength=c*1.5;
      dragonAnimation=animateElement(ui.dragon,[{transform:'none'},{transform:`translate(${strength}px,-3px) rotate(${c}deg)`,offset:.3},{transform:'none'}],{duration:motion(480),easing:'ease-out'});
      impact(actorPoint(),c);if(c>4)starCloud(actorPoint());
    }else if(POSES[name].kind==='attack'){
      void korafuLeafAttack(name,state.epoch).catch(onRunError);
    }else if(name==='defeated')starCloud(actorPoint(),6);
  }

  async function healSuction(amount,count,epoch,sources=[]){
    if(!count)return;const start=centerOf(ui.board),target=centerOf(ui.playerBar);
    const n=Math.min(8,Math.max(3,Math.ceil(count/2)));
    for(let i=0;i<n;i++){const el=document.createElement('div');el.className='healParticle';ui.effects.appendChild(el);
      const origin=sources.length?sources[i%sources.length]:start;
      const sx=origin.x+(Math.random()-.5)*10,sy=origin.y+(Math.random()-.5)*10;
      const a=animateElement(el,[{transform:`translate(${sx-9}px,${sy-9}px) scale(1)`,opacity:1},{transform:`translate(${target.x-9}px,${target.y-9}px) scale(.2)`,opacity:.1}],{duration:motion(460),easing:'cubic-bezier(.2,.75,.2,1)',fill:'both'});
      if(a)a.finished.then(()=>el.remove()).catch(()=>el.remove());else el.remove();await wait(motion(38),epoch);}
    await wait(motion(460),epoch);floating(amount?`＋${amount} HP`:'HP満タン',target,'float-text heal',900);
  }
  async function shoot(combo,attackColors,epoch){
    const count=Math.min(28,Math.max(1,combo*3-2)),g=state.geometry;
    const destination=actorPoint();
    // actorPoint already targets visible body.
    for(let i=0;i<count;i++){
      const color=attackColors[i%attackColors.length],el=document.createElement('div');el.className='flyball';
      el.innerHTML=`<i class="ball-trail"></i><svg class="golf-spin" viewBox="0 0 100 100"><use href="#orb-golf"></use></svg>`;ui.effects.appendChild(el);
      const start=appPoint(g.left+g.width*(.18+(i%7)*.1),g.top+g.step*.38);
      const target={x:destination.x+((i%3)-1)*9,y:destination.y+((i%4)-1.5)*7};
      const a=animateElement(el,[{transform:`translate(${start.x-12}px,${start.y-12}px) scale(1)`,opacity:1},{transform:`translate(${target.x-12}px,${target.y-12}px) scale(.6)`,opacity:1}],{duration:motion(250),easing:'cubic-bezier(.5,0,.8,.55)',fill:'both'});
      const done=()=>{el.remove();if(epoch!==state.epoch)return;if(i===0){dragonFace(combo);battleWord(hitWord(combo),combo);}if(!reducedMotion.matches&&i%2===0)impact(target,combo);};
      if(a)a.finished.then(done).catch(()=>el.remove());else done();
      await wait(motion(21),epoch);
    }
    await wait(motion(240),epoch);
    BattleSound.attack(combo);
    dragonFace(combo);if(combo>=7)starCloud(destination,combo>=10?8:5);
    if(dragonAnimation)dragonAnimation.cancel();
    const strength=Math.min(9,1+combo*1.05);
    dragonAnimation=animateElement(ui.dragon,[{transform:'translateX(0) rotate(0)'},{transform:`translateX(${strength}px) rotate(${strength*.6}deg)`,offset:.25},{transform:`translateX(${-strength*.5}px) rotate(${-strength*.35}deg)`,offset:.6},{transform:'translateX(0) rotate(0)'}],{duration:motion(320),easing:'ease-out'});
  }
  async function collapse(epoch){
    const next=Array(SIZE).fill(null);
    for(let c=0;c<COLS;c++){
      const remaining=[];
      for(let r=ROWS-1;r>=0;r--)if(state.grid[r*COLS+c])remaining.push(state.grid[r*COLS+c]);
      const missing=ROWS-remaining.length;
      for(let k=0;k<remaining.length;k++){const index=(ROWS-1-k)*COLS+c,tile=remaining[k];next[index]=tile;targetTile(tile,index);}
      for(let r=missing-1;r>=0;r--){const index=r*COLS+c;next[index]=createTile(randomColor(),index,r-missing);}
    }
    state.grid=next;requestDraw();await wait(motion(300),epoch);
  }
  async function runTurn(epoch){
    await wait(motion(125),epoch);
    setPhase('resolving');ui.shell.classList.add('resolving');
    let combo=0,attackBalls=0,healBalls=0,waves=0;const attackColors=[],healSources=[];
    let groups=findGroups(currentTypes());
    if(!groups.length){setPhase('ready');ui.shell.classList.remove('resolving');setStatus('揃わなかった！縦・横に同じ色を3個以上');briefly('grumpy',850);return;}
    while(groups.length){
      for(const group of groups){
        combo++;if(group.color===5)healBalls+=group.cells.length;else{attackBalls+=group.cells.length;attackColors.push(group.color);}
        let x=0,y=0;for(const i of group.cells){const p=center(i);x+=p.x;y+=p.y;state.grid[i].el.classList.add('matched');}
        const p=appPoint(state.geometry.left+x/group.cells.length,state.geometry.top+y/group.cells.length);
        if(group.color===5)healSources.push(p);
        MatchJuice.pop(group.cells.length,combo);matchBurst(p,group.cells.length,combo);
        floating(`${combo} COMBO`,p,'combo-pop',580);setStatus(`${combo} COMBO${group.color===5?' · 回復':'！'}`);
        await wait(motion(combo>=5?125:110),epoch);
      }
      await wait(motion(90),epoch);
      for(const group of groups)for(const i of group.cells){const tile=state.grid[i];tile.el.remove();state.tiles.delete(tile.id);state.grid[i]=null;}
      await collapse(epoch);waves++;groups=findGroups(currentTypes());
      if(waves>=40&&groups.length){
        // Practical safety valve for a pathological RNG; do not leave a stuck game.
        ui.pieces.replaceChildren();state.tiles.clear();state.grid=freshTypes().map((c,i)=>createTile(c,i));groups=[];
      }
    }
    ui.shell.classList.remove('resolving');state.maxCombo=Math.max(state.maxCombo,combo);
    const damage=Math.round(attackBalls*CONFIG.attackPerBall*(1+(combo-1)*CONFIG.comboStep));
    const phaseBefore=bossPhase();
    const nominalHeal=Math.round(healBalls*CONFIG.healPerBall*(1+(combo-1)*CONFIG.healComboStep)*phaseBefore.healMultiplier);
    const actualHeal=Math.min(CONFIG.playerMax-state.player,nominalHeal);
    if(healBalls){await healSuction(actualHeal,healBalls,epoch,healSources);state.player+=actualHeal;updateHP();}
    setPhase('attack');
    if(attackBalls){
      await shoot(combo,attackColors,epoch);state.enemy=Math.max(0,state.enemy-damage);updateHP();
      if(activeStage?.element==='fire'&&activeStage?.bossPhases&&state.enemy>0){
        const ph=bossPhase();
        if(ph.rage&&!state.bossRageShown){state.bossRageShown=true;state.bossPhase2Shown=true;BattleSound.enemy();battleWord('怒りモード!!',9);setStatus('越谷ベビードラゴンが怒った！ 毎ターン攻撃・回復量50%');ui.hero.classList.add('boss-rage');await wait(motion(520),epoch);}
        else if(ph.phase2&&!state.bossPhase2Shown){state.bossPhase2Shown=true;battleWord('猛攻モード!',6);setStatus('ボスが本気になった！ ここから毎ターン攻撃');await wait(motion(430),epoch);}
      }
      const where=centerOf(ui.enemyHud);where.y-=22;floating(damage.toLocaleString('ja-JP'),where,'float-text damage',800);
      await wait(motion(390),epoch);
    }else{battleWord('回復！',combo);await wait(motion(420),epoch);}
    state.turn++;state.lastResult={combo,damage,heal:actualHeal,healBalls,attackBalls,waves};
    updateHP();
    if(state.enemy<=0){await defeatedSequence(epoch,combo);return;}
    const enemyEvery=currentEnemyEvery();
    if(state.turn%enemyEvery===0){
      setPhase('enemy');BattleSound.enemy();await enemyShot(epoch);BattleSound.playerHit();playerDamageFX();state.player=Math.max(0,state.player-CONFIG.enemyAttack);updateHP();
      floating(`−${CONFIG.enemyAttack}`,centerOf(ui.playerHud),'float-text damage',700);
      if(state.player<=0){await wait(motion(430),epoch);finish(false);return;}
      setStatus(`${combo} COMBO · ${damage}ダメージ${actualHeal?' / ＋'+actualHeal+'回復':''} · ${({sand:'砂',rough:'ラフ',fire:'炎',grass:'草'}[activeStage?.element]||'属性')}ダメージ −${CONFIG.enemyAttack}`);
    }else setStatus(`${combo} COMBO · ${damage}ダメージ${actualHeal?' / ＋'+actualHeal+'回復':''}`);
    setPhase('ready');if(combo>=3&&state.turn%currentEnemyEvery()!==0)briefly('angry',650);
  }
  
  const COURSE_START={1:'s1-korafu',2:'c2-sunamogu'};
  const COURSE_BOSS=new Set(['boss-koshigaya','c2-abiko']);
  function courseOf(id){return String(id||'').startsWith('c2-')?2:1}
  function unlockedCourse(){return Math.max(1,Number(localStorage.getItem('pazugoru-unlocked-course')||1))}
  function markCourseClear(n){localStorage.setItem('pazugoru-course-'+n+'-clear','1');localStorage.setItem('pazugoru-unlocked-course',String(Math.max(unlockedCourse(),n+1)));updateStageMap()}
  function updateStageMap(){const u=unlockedCourse();for(const n of [1,2]){const b=document.querySelector(`[data-course="${n}"]`);if(!b)continue;b.disabled=n>u;b.classList.toggle('locked',n>u);const s=document.getElementById('stars'+n);if(s)s.textContent=localStorage.getItem('pazugoru-course-'+n+'-clear')==='1'?'★★★':'☆☆☆'}}
  function showStageMap(){const m=document.getElementById('stageMap');if(!m)return;m.hidden=false;updateStageMap();Audio.stopEffects()}
  function hideStageMap(){const m=document.getElementById('stageMap');if(m)m.hidden=true}
  async function startCourse(n){if(n>unlockedCourse())return;hideStageMap();await loadBattle(COURSE_START[n])}
  async function finish(win){
    setPhase('ended');clearTimeout(faceTimer);clearTimeout(expressionTimer);
    const currentCourse=courseOf(activeStage?.id),nextId=Assets.nextId();
    if(win&&!COURSE_BOSS.has(activeStage?.id)&&nextId&&courseOf(nextId)===currentCourse){
      ui.result.hidden=true;modalMode(false);
      try{await Assets.prefetchNext();if(COURSE_BOSS.has(nextId))await bossIntro();await loadBattle(nextId);}
      catch(e){ui.result.hidden=false;modalMode(true);setStatus('次のステージを読み込めませんでした');}
      return;
    }
    if(win&&COURSE_BOSS.has(activeStage?.id))markCourseClear(currentCourse);
    if(!win)setPose('wink');
    ui.result.classList.toggle('win',win);ui.result.hidden=false;modalMode(true);
    $('resultTitle').textContent=win?'STAGE '+currentCourse+' CLEAR!':'GAME OVER';
    $('resultMessage').textContent=win?(activeStage.name+'を撃破！'):(activeStage.name+'に負けた！');
    const nsb=$('nextStageButton');if(nsb)nsb.hidden=true;
    $('resultTurns').textContent=`${state.turn} ターン`;$('resultCombo').textContent=`最高 ${state.maxCombo} COMBO`;
    let mapBtn=$('mapReturnButton');
    if(!mapBtn){mapBtn=document.createElement('button');mapBtn.id='mapReturnButton';mapBtn.className='map-return';mapBtn.textContent='ステージ選択へ';$('retryButton').parentElement.appendChild(mapBtn);mapBtn.addEventListener('click',()=>{ui.result.hidden=true;modalMode(false);showStageMap()});}
    mapBtn.hidden=false;$('retryButton').textContent=win?'もう一度あそぶ':'もう一度挑戦';$('retryButton').focus({preventScroll:true});
  }
  async function bossIntro(){
    const layer=$('bossIntro');if(!layer)return;
    layer.hidden=false;layer.setAttribute('aria-hidden','false');BattleSound.enemy();
    const word=layer.querySelector('.boss-intro-word');
    const a=animateElement(word,[{transform:'scale(.55)',opacity:0},{transform:'scale(1.16)',opacity:1,offset:.58},{transform:'scale(1)',opacity:1}],{duration:motion(760),easing:'cubic-bezier(.18,.8,.25,1)',fill:'both'});
    await wait(motion(1250),state.epoch);layer.hidden=true;layer.setAttribute('aria-hidden','true');if(a)a.cancel();
  }
  ui.menu.addEventListener('click',()=>{if(state.phase!=='ready')return;ui.help.hidden=false;modalMode(true);$('helpClose').focus({preventScroll:true});});
  $('helpClose').addEventListener('click',()=>{ui.help.hidden=true;modalMode(false);idleStamp=performance.now();ui.menu.focus({preventScroll:true});});
  $('resetButton').addEventListener('click',()=>resetGame());$('retryButton').addEventListener('click',()=>resetGame());
  
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!ui.help.hidden){ui.help.hidden=true;modalMode(false);idleStamp=performance.now();ui.menu.focus({preventScroll:true});}});
  window.addEventListener('resize',scheduleLayout);
  if(window.visualViewport)window.visualViewport.addEventListener('resize',scheduleLayout);
  if('ResizeObserver' in window)new ResizeObserver(()=>{if(ui.app.isConnected)scheduleLayout();}).observe(ui.board);
  for(let i=0;i<SIZE;i++){const cell=document.createElement('div');cell.className='cell'+((Math.floor(i/COLS)+i%COLS)%2?' alt':'');ui.cells.appendChild(cell);}
  $('viewReactions').addEventListener('click',openReactions);
  $('reactionClose').addEventListener('click',closeReactions);
  $('reactionLayer').addEventListener('click',e=>{const btn=e.target.closest('[data-preview-pose]');if(btn)previewReaction(btn.dataset.previewPose);});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&previewOpen){e.preventDefault();closeReactions();}});
  async function loadBattle(id){
    const seq=++loadSerial;state.epoch++;
    if(state.drag)cancelDrag('');
    clearInterval(idleClock);clearTimeout(faceTimer);clearTimeout(expressionTimer);directorReady=false;
    if(poseAnimation)poseAnimation.cancel();if(dragonAnimation)dragonAnimation.cancel();
    Audio.stopEffects();ui.effects.replaceChildren();ui.result.hidden=true;ui.help.hidden=true;$('reactionLayer').hidden=true;modalMode(false);
    setPhase('loading');$('loadLayer').hidden=false;$('loadRetry').hidden=true;setStatus('ステージを読み込んでいます');
    try{
      const catalog=await Assets.getCatalog();id=id||catalog.stages[0].id;
      const s=await Assets.activate(id,(done,total)=>{if(seq===loadSerial){$('loadText').textContent='素材を準備中 '+done+' / '+total;$('loadProgress').value=done/total;}});
      if(seq!==loadSerial)return;
      activeStage=s;CONFIG=Object.freeze({...s.stats});POSES=Object.freeze(s.poses);
      ui.app.setAttribute('aria-label','パズゴル '+s.stageLabel+' '+s.name);
      ui.hero.style.setProperty('--stage-image',`url("${s.background}")`);
      $('stageLabel').textContent=s.stageLabel;$('enemyName').textContent=s.name;
      ui.enemyBar.setAttribute('aria-label',s.name+'のHP');spriteImage.src=POSES.normal.src;
      spriteImage.width=s.display.frameWidth;spriteImage.height=s.display.frameHeight;
      directorReady=true;resize();resetGame();$('loadLayer').hidden=true;
      // Do not download future characters at initial boot. A ready stage can be
      // prefetched just before an actual transition using Assets.prefetchNext().
    }catch(err){
      if(seq!==loadSerial)return;
      setPhase('load-error');$('loadText').textContent='素材を読み込めませんでした。展開した全ファイルを同じ場所に置いてください。';
      $('loadDetail').textContent=err.message;$('loadRetry').hidden=false;setStatus('再試行してください');
    }
  }
  $('loadRetry').addEventListener('click',()=>void loadBattle(activeStage?.id));
  window.addEventListener('pagehide',()=>{clearInterval(idleClock);if(poseAnimation)poseAnimation.cancel();});
  window.addEventListener('pageshow',()=>{if(directorReady){clearInterval(idleClock);idleClock=setInterval(idlePose,700);}});

  resize();void document.querySelectorAll('.map-node[data-course]').forEach(b=>b.addEventListener('click',()=>startCourse(Number(b.dataset.course))));
  updateStageMap();showStageMap();

  // Test-only helpers are absent from a normal URL. No server/score writes exist.
  if(new URLSearchParams(location.search).get('test')==='1'){
    window.__pazugoruTest=Object.freeze({
      version:VERSION, bossState:bossPhase, layout:()=>({bounds:activeStage.display.inkBounds,motion:activeStage.display.motionBounds,scale:Number(ui.anchor.dataset.displayScale)}), rules:findGroups, hasEasyMove, hitWord,
      assets:Assets.info,loadStage:loadBattle,audio:Audio.info,stage:()=>activeStage,
      attackPreview:async()=>{await enemyShot(state.epoch);},
      visual:()=>({source:$('dragonImage').currentSrc.slice(0,28),loaded:$('dragonImage').complete&&$('dragonImage').naturalWidth>0,ko:ui.dragon.classList.contains('ko'),classes:ui.dragon.className}),
      react:n=>dragonFace(n),
      poses:()=>({current:currentPose,log:poseLog.slice(),names:Object.keys(POSES),preview:previewOpen}),
      preview:()=>openReactions(),previewPose:n=>previewReaction(n),closePreview:()=>closeReactions(),
      idleAt:seconds=>{idleStamp=performance.now()-seconds*1000;idlePose();},
      setPose:n=>setPose(n,true),
      snapshot:()=>({phase:state.phase,types:currentTypes(),ids:state.grid.map(t=>t.id),turn:state.turn,enemy:state.enemy,player:state.player,
        drag:state.drag?{id:state.drag.tile.id,index:state.drag.index,pointer:state.drag.pointerId}:null,
        positions:[...state.tiles.values()].map(t=>({id:t.id,index:t.index,x:t.x,y:t.y,tx:t.tx,ty:t.ty})),
        count:ui.count.textContent,lastResult:state.lastResult,geometry:{...state.geometry},scroll:{x:scrollX,y:scrollY}}),
      setBoard:types=>{if(!Array.isArray(types)||types.length!==SIZE||types.some(c=>!Number.isInteger(c)||c<0||c>5))throw Error('Expected 30 colors in 0..5');resetGame(types);},
      setHP:(enemy,player,turn=0)=>{state.enemy=clamp(enemy,0,CONFIG.enemyMax);state.player=clamp(player,0,CONFIG.playerMax);state.turn=turn;updateHP();},
      setRefills:types=>{if(types.some(c=>!Number.isInteger(c)||c<0||c>5))throw Error('Invalid colors');state.refillQueue=types.slice();},
      setSeed:seed=>{let n=seed>>>0;rng=()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};},
      resolve:()=>{if(state.phase!=='ready')throw Error('Busy');setPhase('settling');runTurn(state.epoch).catch(onRunError);},
      cancel:()=>cancelDrag('test cancel'),reset:()=>resetGame()
    });
  }
})();

