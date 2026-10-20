const $ = id => document.getElementById(id);
const canvas = $('eye'), ctx = canvas.getContext('2d', {alpha:false});
const stage = $('stage'), video = $('video');
const palettes = {amber:[225,164,91], sage:[161,191,131], ice:[124,190,213]};
const chars = ' .,:;i+tf1L0#%@';
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let mode='pointer', palette='amber', gaze={x:0,y:0}, target={x:0,y:0}, response=6;
let width=1000,height=480,dpr=1,lastDraw=0,lastTime=0,fpsFrames=0,fpsTime=0;
let stream=null,worker=null,starting=false,session=0,ready=false,busy=false;
let lastCapture=0,lastVideoTime=-1,lastSeen=0,selectedFace=null,trackState='';
let blinkAt=performance.now()+4500,blinkStart=-1000,pointerAt=performance.now();
let screenWasCamera=false;

function resize(){
  const rect=stage.getBoundingClientRect(); width=rect.width;height=rect.height;
  dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);
}
new ResizeObserver(resize).observe(stage);

function hash(x,y){let n=Math.sin(x*127.1+y*311.7)*43758.5453;return n-Math.floor(n)}
function draw(t){
  ctx.fillStyle='#0d0f0d';ctx.fillRect(0,0,width,height);
  const mobile=width<700;
  const halfW=Math.min(width*(mobile?.43:.375),450),halfH=Math.min(halfW*(mobile?.48:.37),height*.30);
  const cx=width/2,cy=height*.47;
  const cell=mobile?5.5:6.7, line=mobile?8:9.3, font=mobile?7.6:9.2;
  ctx.font=`${font}px "Courier New",monospace`;ctx.textBaseline='middle';ctx.textAlign='center';
  // Quiet, fixed stars keep the living eye grounded in a terminal-like field.
  ctx.fillStyle='#283021';
  for(let i=0;i<45;i++){
    const x=hash(i,2)*width,y=hash(i,7)*height;
    if(Math.hypot((x-cx)/halfW,(y-cy)/halfH)>1.25)ctx.fillText(i%9===0?'+':'.',x,y);
  }
  let open=1;
  if(!reducedMotion){
    if(t>blinkAt){blinkStart=t;blinkAt=t+4200+hash(Math.floor(t),5)*3500}
    const bt=t-blinkStart;if(bt>=0&&bt<230)open=Math.max(.035,1-Math.sin(bt/230*Math.PI)**1.25);
  }
  const breath=reducedMotion?1:1+Math.sin(t*.0011)*.012;
  const irisR=Math.min(halfH*1.12,halfW*.37)*breath;
  const gx=gaze.x*halfW*.36,gy=gaze.y*halfH*.43;
  const rgb=palettes[palette],time=reducedMotion?0:t*.000055;
  for(let y=Math.floor((cy-halfH-8)/line)*line;y<cy+halfH+8;y+=line){
    for(let x=Math.floor((cx-halfW-8)/cell)*cell;x<cx+halfW+8;x+=cell){
      const ex=(x-cx)/halfW,ey=(y-cy)/(open*halfH);
      if(Math.abs(ex)>=1)continue;
      const lid=(1-ex*ex)**.72;
      if(Math.abs(ey)>lid)continue;
      const dx=(x-cx-gx),dy=(y-cy)/open-gy;
      const r=Math.hypot(dx,dy)/irisR,a=Math.atan2(dy,dx);
      const noise=hash(Math.round(x/cell),Math.round(y/line));
      let intensity,red,green,blue;
      if(r<.34){
        const glint=Math.hypot(dx/irisR+.20,dy/irisR+.28);
        if(glint<.085){intensity=.75;red=213;green=219;blue=196}else if(noise>.98){intensity=.1;red=67;green=68;blue=43}else continue;
      }else if(r<1){
        const fiber=Math.sin(a*97+Math.sin(r*24+a*3)*1.9+time)*.21+Math.sin(a*183-r*21)*.11;
        const fine=Math.sin(a*291+Math.sin(r*35))*0.08;
        intensity=.36+fiber+fine+noise*.18;
        intensity*=.75+.38*Math.sin((r-.34)/.66*Math.PI);
        intensity+=Math.exp(-(((r-.40)*29)**2))*.18;
        intensity*=Math.min(1,(1-r)*12);
        intensity*=.8+.2*(-dy/irisR);
        red=rgb[0]*Math.sqrt(intensity)*1.25;green=rgb[1]*Math.sqrt(intensity)*1.15;blue=rgb[2]*Math.sqrt(intensity);
      }else{
        const edge=Math.max(0,(lid-Math.abs(ey))/lid);
        const falloff=Math.max(0,1-Math.abs(ex)**1.8);
        intensity=(.19+edge*.24)*falloff*(.65+noise*.50);
        const shadow=Math.min(1,(r-1)*7+.16);
        intensity*=shadow;
        const vein=Math.sin(a*49+Math.sin(r*18))*Math.sin(r*30+a*7);
        if(vein>.85)intensity*=.6;
        red=185*Math.sqrt(intensity);green=191*Math.sqrt(intensity);blue=170*Math.sqrt(intensity);
      }
      intensity=Math.max(0,Math.min(.99,intensity));
      const charIndex=Math.max(1,Math.floor(Math.sqrt(intensity)*(chars.length-1)));
      ctx.fillStyle=`rgb(${red|0},${green|0},${blue|0})`;
      ctx.fillText(chars[charIndex],x,y);
    }
  }
}

function setStatus(text){$('status').replaceChildren(Object.assign(document.createElement('i'),{className:'status-dot'}),document.createTextNode(text))}
function updateModes(){
  ['pointer','demo'].forEach(id=>{const selected=mode===id;$(id).classList.toggle('selected',selected);$(id).setAttribute('aria-pressed',String(selected))});
  $('input-label').textContent=`INPUT: ${mode==='camera'?'CAMERA':mode==='demo'?'AUTOPILOT':'POINTER'}`;
  const active=mode==='camera';$('camera').classList.toggle('active',active);$('camera').querySelector('span').textContent=active?'Turn camera off':'Enable camera';
  $('camera').setAttribute('aria-pressed',String(active));
  $('stage-caption').textContent=active?'MOVE A LITTLE. IT’S WATCHING.':mode==='demo'?'A MOMENT OF DIGITAL DAYDREAMING.':'MOVE YOUR CURSOR. CATCH ITS EYE.';
}
function message(text){$('message').textContent=text;$('message').hidden=!text}
function stopCamera(){
  session++;starting=false;ready=false;busy=false;
  if(stream)stream.getTracks().forEach(t=>t.stop());stream=null;video.srcObject=null;
  worker?.terminate();worker=null;$('camera-preview').hidden=true;$('camera').disabled=false;
  selectedFace=null;lastSeen=0;lastVideoTime=-1;trackState='';
}
function chooseMode(next){stopCamera();mode=next;message('');target={x:0,y:0};updateModes();setStatus(next==='demo'?'LOST IN THOUGHT':'AWAITING YOUR CURIOSITY')}
$('pointer').addEventListener('click',()=>chooseMode('pointer'));
$('demo').addEventListener('click',()=>chooseMode('demo'));
window.addEventListener('pointermove',e=>{
  if(mode!=='pointer')return;
  const r=stage.getBoundingClientRect();target={x:Math.max(-1,Math.min(1,(e.clientX-r.left)/r.width*2-1)),y:Math.max(-1,Math.min(1,(e.clientY-r.top)/r.height*2-1))};
  pointerAt=performance.now();if(trackState!=='pointer'){setStatus('YOU HAVE ITS ATTENTION');trackState='pointer'}
});
stage.addEventListener('pointerdown',e=>{if(mode==='pointer'){stage.setPointerCapture?.(e.pointerId)}});
document.querySelectorAll('.swatch').forEach(b=>b.addEventListener('click',()=>{
  palette=b.dataset.color;document.querySelectorAll('.swatch').forEach(s=>{s.classList.toggle('selected',s===b);s.setAttribute('aria-pressed',String(s===b))});
  canvas.setAttribute('aria-label',`An animated ${palette} ASCII eye that follows your pointer or face`);
}));
$('response').addEventListener('input',e=>{response=+e.target.value;$('response-value').textContent=String(response).padStart(2,'0')});
$('about').addEventListener('click',()=>{const open=$('about-panel').hidden;$('about-panel').hidden=!open;$('about').setAttribute('aria-expanded',String(open));$('about').querySelector('span').textContent=open?'−':'+'});
$('fullscreen').addEventListener('click',async()=>{
  try{if(document.fullscreenElement)await document.exitFullscreen();else if($('observer').requestFullscreen)await $('observer').requestFullscreen();else message('Fullscreen is unavailable in this browser. You can use your browser’s fullscreen command.')}catch{message('Fullscreen is unavailable here. Open the site in its own browser tab to try again.')}
});
document.addEventListener('fullscreenchange',()=>{$('fullscreen').setAttribute('aria-label',document.fullscreenElement?'Exit fullscreen':'Enter fullscreen')});

function cameraError(error){
  if(error.name==='NotAllowedError'||error.name==='SecurityError')return 'Camera permission wasn’t granted. Allow camera access in your browser’s site settings, then try again. Pointer mode is ready to use.';
  if(error.name==='NotFoundError')return 'No camera found. Connect a camera, then try again. You can still use Pointer or Autopilot.';
  if(error.name==='NotReadableError'||error.name==='AbortError')return 'The camera couldn’t start. Close other apps using it, then try again.';
  return 'Face tracking couldn’t start. Try reloading the page in a current Chrome, Edge, Firefox, or Safari browser. Pointer mode is ready to use.';
}
async function startCamera(){
  if(starting)return;
  if(mode==='camera'){chooseMode('pointer');return}
  if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia){message('Camera access needs a secure page. Open this site over HTTPS or localhost in your browser.');return}
  stopCamera();const mySession=session;starting=true;$('camera').disabled=true;$('camera').querySelector('span').textContent='Opening camera…';message('');setStatus('WAITING FOR CAMERA PERMISSION');
  try{
    const acquired=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:640},height:{ideal:480}},audio:false});
    if(mySession!==session){acquired.getTracks().forEach(t=>t.stop());return}
    stream=acquired;video.srcObject=stream;await video.play();
    if(mySession!==session)return;
    $('camera-preview').hidden=false;setStatus('LOADING LOCAL FACE TRACKER');$('camera').querySelector('span').textContent='Loading tracker…';
    const localWorker=new Worker(new URL('./tracker-worker.js',import.meta.url));worker=localWorker;
    await new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>reject(new Error('Tracker initialization timed out')),30000);
      localWorker.onerror=e=>{clearTimeout(timeout);reject(new Error(e.message))};
      localWorker.onmessage=({data})=>{
        if(mySession!==session)return;
        if(data.type==='ready'){clearTimeout(timeout);resolve()}
        if(data.type==='error'){clearTimeout(timeout);reject(new Error(data.message))}
      };localWorker.postMessage({type:'init'});
    });
    if(mySession!==session)return;
    ready=true;starting=false;mode='camera';lastSeen=0;updateModes();$('camera').disabled=false;setStatus('LOOKING FOR A FACE');
    localWorker.onmessage=({data})=>{
      if(mySession!==session)return;busy=false;
      if(data.type==='result')handleFaces(data);
      if(data.type==='error'){chooseMode('pointer');message('The face tracker stopped. Your camera is off. Enable it again to retry.')} 
    };
    localWorker.onerror=()=>{if(mySession===session){chooseMode('pointer');message('The face tracker stopped. Your camera is off. Enable it again to retry.')}};
    stream.getVideoTracks()[0].addEventListener('ended',()=>{if(mySession===session){chooseMode('pointer');message('The camera disconnected. Pointer mode is ready to use.')}});
  }catch(error){if(mySession!==session)return;stopCamera();mode='pointer';updateModes();setStatus('POINTER MODE READY');message(cameraError(error))}
}
$('camera').addEventListener('click',startCamera);

function handleFaces({faces,width:vw,height:vh}){
  const overlay=$('boxes');if(overlay.width!==vw||overlay.height!==vh){overlay.width=vw;overlay.height=vh}const c=overlay.getContext('2d');c.clearRect(0,0,vw,vh);
  if(!faces.length){if(performance.now()-lastSeen>1100){selectedFace=null;if(trackState!=='search'){setStatus('LOOKING FOR A FACE');$('preview-label').textContent='SEARCHING FOR A FACE';trackState='search'}}return}
  let face;
  if(selectedFace){
    const sorted=[...faces].sort((a,b)=>Math.hypot((a.x+a.w/2)/vw-selectedFace.x,(a.y+a.h/2)/vh-selectedFace.y)-Math.hypot((b.x+b.w/2)/vw-selectedFace.x,(b.y+b.h/2)/vh-selectedFace.y));
    const candidate=sorted[0];const distance=Math.hypot((candidate.x+candidate.w/2)/vw-selectedFace.x,(candidate.y+candidate.h/2)/vh-selectedFace.y);
    if(distance<.33)face=candidate;
  }
  if(!face)face=[...faces].sort((a,b)=>b.w*b.h-a.w*a.h)[0];
  selectedFace={x:(face.x+face.w/2)/vw,y:(face.y+face.h/2)/vh};
  target={x:Math.max(-1,Math.min(1,(.5-selectedFace.x)*2.5)),y:Math.max(-1,Math.min(1,(selectedFace.y-.5)*2.5))};
  lastSeen=performance.now();
  if(trackState!=='face'){setStatus('SUBJECT IN SIGHT');trackState='face'}
  $('preview-label').textContent=`FACE TRACKED · ${Math.round(face.score*100)}%`;
  const x=vw-face.x-face.w,y=face.y,w=face.w,h=face.h,k=w*.18;
  c.strokeStyle='#dfba7e';c.lineWidth=3;c.beginPath();
  for(const [px,py,sx,sy] of [[x,y,1,1],[x+w,y,-1,1],[x,y+h,1,-1],[x+w,y+h,-1,-1]]){c.moveTo(px+sx*k,py);c.lineTo(px,py);c.lineTo(px,py+sy*k)}c.stroke();
}
async function capture(t){
  if(!ready||busy||mode!=='camera'||video.readyState<2||video.currentTime===lastVideoTime||t-lastCapture<80)return;
  const currentSession=session,activeWorker=worker;lastCapture=t;lastVideoTime=video.currentTime;busy=true;
  try{const bitmap=await createImageBitmap(video);if(currentSession!==session){bitmap.close();return}activeWorker.postMessage({type:'frame',bitmap,timestamp:performance.now()},[bitmap])}
  catch{if(currentSession===session){chooseMode('pointer');message('This browser couldn’t read camera frames. Your camera is off. Try opening the site in Chrome or Edge.')}}
}
function tick(t){
  requestAnimationFrame(tick);const delta=Math.min((t-(lastTime||t))/1000,.1);lastTime=t;
  if(mode==='demo'||(mode==='camera'&&t-lastSeen>1300)){
    target={x:reducedMotion?0:Math.sin(t*.00032)*.65,y:reducedMotion?0:Math.sin(t*.00021+.7)*.36};
  }else if(mode==='pointer'&&t-pointerAt>7000){target={x:0,y:0}}
  const easing=1-Math.exp(-delta*(2+response*1.4));gaze.x+=(target.x-gaze.x)*easing;gaze.y+=(target.y-gaze.y)*easing;
  capture(t);
  if(t-lastDraw<32)return;lastDraw=t;draw(t);fpsFrames++;
  if(t-fpsTime>1000){$('fps').textContent=`${Math.round(fpsFrames*1000/(t-fpsTime))} FPS`;fpsFrames=0;fpsTime=t;$('coordinates').innerHTML=`X ${gaze.x>=0?'+':''}${gaze.x.toFixed(2)} <b>/</b> Y ${gaze.y>=0?'+':''}${gaze.y.toFixed(2)}`}
}
document.addEventListener('visibilitychange',()=>{if(document.hidden&&(stream||starting)){chooseMode('pointer');message('Camera turned off while this tab was in the background. Enable it again when you’re ready.')}});
window.addEventListener('pagehide',()=>stopCamera());
resize();updateModes();requestAnimationFrame(tick);
