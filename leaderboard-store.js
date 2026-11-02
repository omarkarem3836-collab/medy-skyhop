export const LEADERBOARD_KEY = 'medsky.skyhop.leaderboard.v1';
const PREVIOUS_KEY = 'medsky.skyhop.expo.v1:2026-11-03';
export const cleanName = value => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim().replace(/\s+/g, ' ').slice(0,24);
const nameKey = value => cleanName(value).normalize('NFKC').toLowerCase();
const count = value => Number.isSafeInteger(value) && value >= 0;

export function createLeaderboardStore(storage) {
  let data={version:1,players:[],flights:[]}, error='', damaged=false;
  try {
    // Preserve previously recorded named scores without retaining a separate mode.
    const raw=storage.getItem(LEADERBOARD_KEY) ?? storage.getItem(PREVIOUS_KEY);
    if(raw) {
      const saved=JSON.parse(raw);
      if(saved.version!==1 || !Array.isArray(saved.players) || !Array.isArray(saved.flights)
        || saved.players.some(p=>!count(p.id)||p.id<1||typeof p.label!=='string'||!cleanName(p.label))
        || new Set(saved.players.map(p=>p.id)).size!==saved.players.length
        || saved.flights.some(f=>typeof f.id!=='string'||!saved.players.some(p=>p.id===f.playerId)
          || !count(f.score)||!count(f.coins)||!Number.isFinite(Date.parse(f.at)))) throw Error('Invalid scores');
      data=saved;
    }
  } catch {
    damaged=true;error='Saved rankings could not be opened. Your existing scores have not been changed.';
  }
  function save() {
    if(damaged)return false;
    try{storage.setItem(LEADERBOARD_KEY,JSON.stringify(data));error='';return true;}
    catch{error='Scores could not be saved on this device. Keep the game open and check browser storage.';return false;}
  }
  if(!damaged)save();
  function standings() {
    const rows=data.players.map(p=>{
      const flights=data.flights.filter(f=>f.playerId===p.id);
      const top=flights.reduce((best,f)=>!best||f.score>best.score?f:best,null);
      return {...p,best:top?.score??null,at:top?.at??'',attempts:flights.length};
    }).filter(p=>p.best!==null).sort((a,b)=>b.best-a.best||a.at.localeCompare(b.at)||a.id-b.id);
    let rank=0,last=null;
    return rows.map((p,i)=>{if(p.best!==last)rank=i+1;last=p.best;return {...p,rank};});
  }
  return {
    get error(){return error;},
    save,
    standings,
    register(name) {
      if(error&&!save())throw Error(error);
      const label=cleanName(name);
      if(!label)throw Error('Please type your name.');
      let player=data.players.find(p=>nameKey(p.label)===nameKey(label));
      if(!player){player={id:data.players.reduce((max,p)=>Math.max(max,p.id),0)+1,label};data.players.push(player);}
      if(!save())throw Error(error);
      return {...player};
    },
    record({id,playerId,score,coins,at=new Date().toISOString()}) {
      if(damaged)return false;
      if(data.flights.some(f=>f.id===id))return save();
      if(typeof id!=='string'||!id||!data.players.some(p=>p.id===playerId)||!count(score)||!count(coins)
        ||!Number.isFinite(Date.parse(at)))throw Error('Invalid flight result');
      data.flights.push({id,playerId,score,coins,at});return save();
    },
  };
}
