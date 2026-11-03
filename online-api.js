export const API_BASE=['localhost','127.0.0.1'].includes(location.hostname)?'http://127.0.0.1:4186/api':'https://medy-skyhop.omarkarem3836.chatgpt.site/api';
export async function api(path,data,token) {
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
  try{
    const response=await fetch(`${API_BASE}/${path}`,{method:data?'POST':'GET',headers:{...(data?{'Content-Type':'application/json'}:{}),...(token?{Authorization:`Bearer ${token}`}:{})},body:data?JSON.stringify(data):undefined,signal:controller.signal,cache:'no-store',credentials:'omit'});
    const result=await response.json();if(!response.ok){const error=new Error(result.error||'Please try again.');error.permanent=response.status>=400&&response.status<500;throw error;}return result;
  }catch(error){if(error.name==='AbortError'||error instanceof TypeError)throw Error('Check your internet connection and try again.');throw error;}finally{clearTimeout(timer);}
}
export const nameKey=name=>name.trim().replace(/\s+/g,' ').normalize('NFKC').toLowerCase();
const key='medsky.skyhop.online.players.v1';
let profiles=[];
try{profiles=JSON.parse(localStorage.getItem(key)||'[]');if(!Array.isArray(profiles))profiles=[];}catch{}
export async function registerPlayer(label){
  label=label.trim().replace(/\s+/g,' ').slice(0,24);
  const existing=profiles.find(p=>nameKey(p.label)===nameKey(label));
  const result=await api('players',{label:existing?.label||label,...(existing?{playerId:existing.id}:{})},existing?.token);
  const profile={...result.player,token:result.token||existing.token};
  profiles=profiles.filter(p=>p.id!==profile.id);profiles.push(profile);try{localStorage.setItem(key,JSON.stringify(profiles));}catch{}
  return profile;
}
const prefix='medsky.skyhop.pending.';
const memory=new Map();
export function queueScore(item){memory.set(item.body.runId,item);try{localStorage.setItem(prefix+item.body.runId,JSON.stringify(item));}catch{}}
function clearScore(id){memory.delete(id);try{localStorage.removeItem(prefix+id);}catch{}}
export async function sendScore(item){
  try{const result=await api('scores',item.body,item.token);clearScore(item.body.runId);return result;}
  catch(error){if(error.permanent)clearScore(item.body.runId);throw error;}
}
let flushing;
export function flushScores(){
  if(flushing)return flushing;
  flushing=(async()=>{try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k.startsWith(prefix)){try{const v=JSON.parse(localStorage.getItem(k));memory.set(v.body.runId,v);}catch{}}}}catch{}
    for(const item of [...memory.values()]){try{await sendScore(item);}catch{}}
  })().finally(()=>{flushing=null;});return flushing;
}
window.addEventListener('online',()=>void flushScores());
