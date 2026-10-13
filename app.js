import {createGame, resetGame, flap, updateGame, pauseGame, resumeGame} from './engine.js';
import {createRenderer} from './renderer.js';
import {DESTINATIONS, getJourney} from './destinations.js';
import {setupInstall} from './install.js';

const $ = id => document.getElementById(id);
const stage = $('game-stage');
const storageKey = 'medsky.skyhop.v1';
const validCount = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;
let storageAvailable = true;
function readRecord() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
    return {classic:validCount(saved.classic),relaxed:validCount(saved.relaxed),flights:validCount(saved.flights),coins:validCount(saved.coins),sound:saved.sound !== false};
  } catch { storageAvailable = false; return {classic:0,relaxed:0,flights:0,coins:0,sound:true}; }
}
const record = readRecord();
function saveRecord() {
  try { localStorage.setItem(storageKey,JSON.stringify(record)); }
  catch { storageAvailable = false; }
  if (!storageAvailable) document.querySelector('.saved-note').textContent = 'Scores are available for this visit. Your browser has disabled saving.';
}
const game = createGame();
for (const city of DESTINATIONS) {
  const stop=document.createElement('li');
  stop.dataset.destination=city.id;stop.textContent=city.name;
  $('city-list').append(stop);
}
let renderer;
let loaded = false;
let ended = false;
let audioContext;
let flightNumber = 0;
let lastTime = performance.now();
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

function unlockAudio() {
  if (!record.sound) return;
  try {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    audioContext ||= new Audio();
    if (audioContext.state === 'suspended') audioContext.resume().catch(()=>{});
  } catch { /* Sound is optional when a browser restricts audio. */ }
}
function tone(frequency, duration, type='sine', volume=.07, delay=0, endFrequency=frequency) {
  if (!record.sound || !audioContext || audioContext.state !== 'running') return;
  try {
    const time = audioContext.currentTime + delay;
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency,time);
    osc.frequency.exponentialRampToValueAtTime(Math.max(endFrequency,20),time+duration);
    gain.gain.setValueAtTime(0,time);
    gain.gain.linearRampToValueAtTime(volume,time+.012);
    gain.gain.exponentialRampToValueAtTime(.001,time+duration);
    osc.connect(gain); gain.connect(audioContext.destination);
    osc.start(time); osc.stop(time+duration+.02);
    osc.onended=()=>{osc.disconnect();gain.disconnect();};
  } catch { /* Gameplay remains usable without audio. */ }
}
function sound(type) {
  if (type === 'flap') tone(510,.09,'sine',.035,0,790);
  if (type === 'score') {tone(660,.1);tone(880,.14,'sine',.05,.09);}
  if (type === 'coin') {tone(1047,.1,'sine',.06);tone(1568,.18,'sine',.04,.06);}
  if (type === 'crash') tone(170,.26,'triangle',.075,0,65);
}
function renderRecords() {
  $('personal-best').textContent=String(record.classic).padStart(2,'0');
  $('ready-best').textContent=`BEST FLIGHT ${String(record.classic).padStart(2,'0')}`;
  $('total-flights').textContent=record.flights;
  $('total-coins').textContent=record.coins;
  const best = record.classic;
  $('pilot-rank').textContent=best>=30?'Sky legend':best>=15?'Sky captain':best>=5?'Frequent flyer':record.flights?'Finding your wings':'Ready for takeoff';
}
function renderSound() {
  $('sound-button').setAttribute('aria-label',record.sound ? 'Mute sound' : 'Enable sound');
  $('sound-button').setAttribute('aria-pressed',String(record.sound));
  $('sound-button').querySelector('use').setAttribute('href',record.sound?'#i-sound':'#i-muted');
}
function renderJourney() {
  const journey=getJourney(game.score,game.startDestination);
  $('destination-name').textContent=journey.destination.name;
  $('game-canvas').setAttribute('aria-label',`Medy faces right, flying above ${journey.destination.name} through blue and gold gates.`);
  for (const stop of $('city-list').children) {
    const active=stop.dataset.destination===journey.destination.id;
    stop.classList.toggle('current',active);
    if(active)stop.setAttribute('aria-current','step');else stop.removeAttribute('aria-current');
  }
}
function resetFlight() {
  resetGame(game);
  $('share-status').textContent='';
}
function renderState() {
  $('ready-screen').hidden=game.state!=='ready';
  $('hud').hidden=game.state==='ready'||game.state==='over';
  $('destination-hud').hidden=game.state!=='playing';
  $('pause-screen').hidden=game.state!=='paused';
  $('over-screen').hidden=game.state!=='over';
  stage.dataset.state=game.state;
  $('score').textContent=game.score;
  $('coins').textContent=game.coins;
  renderJourney();
}
function performFlap() {
  if (!loaded || document.querySelector('dialog[open]')) return;
  const starting=game.state==='ready';
  unlockAudio();
  if (flap(game)) {
    if (starting) {ended=false;flightNumber++;record.flights++;saveRecord();renderRecords();$('share-status').textContent='';}
    sound('flap');renderer.burst(game.bird.x-17,game.bird.y+7,'flap');
    renderState();
  }
}
function restart() { resetFlight();ended=false;performFlap();stage.focus({preventScroll:true}); }
function bankFlight() {
  if (ended || game.state === 'ready') return false;
  ended=true;
  const personalBest=game.score>record.classic;
  record.classic=Math.max(record.classic,game.score);
  record.coins+=game.coins;
  saveRecord();renderRecords();
  return personalBest;
}
function home() {bankFlight();resetFlight();ended=false;renderState();renderRecords();$('play-button').focus({preventScroll:true});}
function pause() {
  if (pauseGame(game)) {renderState();$('announcer').textContent='Flight paused.';$('resume-button').focus({preventScroll:true});}
}
function resume() {
  if (resumeGame(game)) {lastTime=performance.now();performFlap();renderState();stage.focus({preventScroll:true});}
}
function endFlight() {
  if (ended) return;
  const personalBest=bankFlight();
  $('result-score').textContent=game.score;
  $('result-best').textContent=record.classic;
  $('result-coins').textContent=game.coins;
  $('result-destination').textContent=`Flying over ${getJourney(game.score,game.startDestination).destination.name}`;
  $('result-title').textContent=personalBest?'A new personal best!':game.score>=10?'Now that’s flying.':'One more flight?';
  $('result-tag').textContent=personalBest?'YOUR SKY. YOUR NEW RECORD.':'FLIGHT COMPLETE';
  $('result-message').textContent=game.score===0?'Find a gentle tapping rhythm. You’ve got this.':personalBest?'A little higher. A little further. All you.':'There’s always a little more sky to explore.';
  $('announcer').textContent=`Flight complete. ${game.score} gates, ${game.coins} coins. Personal best ${record.classic}.`;
  renderState();
  const currentFlight=flightNumber;
  setTimeout(()=>{if(game.state==='over' && currentFlight===flightNumber)$('retry-button').focus({preventScroll:true});},200);
}

stage.addEventListener('pointerdown',event=>{
  if(event.target.closest('button,a,dialog,select,option,label')||!loaded)return;
  if(game.state==='ready'||game.state==='playing'){event.preventDefault();performFlap();stage.focus({preventScroll:true});}
});
$('play-button').addEventListener('click',()=>{performFlap();stage.focus({preventScroll:true});});
$('retry-button').addEventListener('click',restart);
$('pause-button').addEventListener('click',pause);
$('resume-button').addEventListener('click',resume);
document.querySelectorAll('.home-button').forEach(button=>button.addEventListener('click',home));
$('sound-button').addEventListener('click',()=>{record.sound=!record.sound;saveRecord();renderSound();unlockAudio();if(record.sound)tone(880,.1);});
document.addEventListener('keydown',event=>{
  if(document.querySelector('dialog[open]')||event.repeat||event.ctrlKey||event.metaKey||event.altKey)return;
  if(event.target.closest('input,select,textarea'))return;
  if(event.key==='Escape'||event.key.toLowerCase()==='p'){
    event.preventDefault();game.state==='paused'?resume():pause();return;
  }
  if(event.code==='Space'||event.code==='ArrowUp'||event.code==='KeyW'){
    if(event.target.closest('button,a,input,select,textarea'))return;
    event.preventDefault();
    if(game.state==='paused')resume();
    else if(game.state==='over')restart();
    else performFlap();
  }
});
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();lastTime=performance.now();});
window.addEventListener('blur',pause);
window.addEventListener('pagehide',pause);
$('help-button').addEventListener('click',()=>{pause();$('help-dialog').showModal();});
const closeHelp=()=>{$('help-dialog').close();if(game.state==='paused')$('resume-button').focus();};
$('close-help').addEventListener('click',closeHelp);
$('got-it-button').addEventListener('click',closeHelp);
$('help-dialog').addEventListener('click',event=>{if(event.target===$('help-dialog')){const box=$('help-dialog').getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)closeHelp();}});
$('reload-button').addEventListener('click',()=>location.reload());
setupInstall({onOpen:pause});
$('share-button').addEventListener('click',async()=>{
  const sharedFlight=flightNumber;
  const shareStatus=message=>{if(game.state==='over'&&flightNumber===sharedFlight)$('share-status').textContent=message;};
  $('share-status').textContent='';
  const text=`I cleared ${game.score} gates with Medy, flying over ${getJourney(game.score,game.startDestination).destination.name}! Can you beat my flight?`;
  const url=new URL('./',location.href).href;
  try {
    if(navigator.share) await navigator.share({title:'Medy Skyhop',text,url});
    else if(navigator.clipboard){await navigator.clipboard.writeText(`${text}\n${url}`);shareStatus('Score and game link copied.');}
    else shareStatus(`Your score: ${game.score} gates. Copy the address to share.`);
  } catch(error){if(error.name!=='AbortError')shareStatus('Sharing isn’t available here. Copy the game address to share.');}
});

renderRecords();renderSound();renderState();
if(!storageAvailable)saveRecord();
try {
  renderer=await createRenderer($('game-canvas'));
  loaded=true;
  $('play-button').disabled=false;
  $('play-button').querySelector('span').textContent='Let’s fly';
  const observer=new ResizeObserver(()=>renderer.resize());observer.observe(stage);
  window.addEventListener('resize',()=>renderer.resize());
  lastTime=performance.now();
  function frame(now) {
    const dt=Math.min((now-lastTime)/1000,.08);lastTime=now;
    if(!document.hidden){
      updateGame(game,dt);
      for(const event of game.events){
        if(event.type==='coin'){sound('coin');renderer.burst(event.x,event.y,'coin');}
        if(event.type==='score'){
          sound('score');
          renderJourney();
        }
        if(event.type==='crash'){sound('crash');renderer.burst(event.x,event.y,'crash');endFlight();}
      }
      if(game.state==='playing'){$('score').textContent=game.score;$('coins').textContent=game.coins;}
      renderer.draw(game,dt,{reducedMotion:reducedMotion.matches});
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
} catch(error) {
  console.error('Game initialization failed:',error);
  $('ready-screen').hidden=true;$('loading-error').hidden=false;
}
