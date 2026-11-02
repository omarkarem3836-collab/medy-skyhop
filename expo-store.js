// One supervised event on one browser. No names or scores leave this device.
export const cleanLabel = value => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim().replace(/\s+/g, ' ').slice(0, 24);
const count = value => Number.isSafeInteger(value) && value >= 0;

export function createExpoStore(storage, event) {
  const key = `medsky.skyhop.expo.v1:${event}`;
  let data = {version:1, players:[], flights:[]};
  let error = '';
  let corrupt = false;
  try {
    const raw = storage.getItem(key);
    if (raw) {
      const saved = JSON.parse(raw);
      if (saved.version !== 1 || !Array.isArray(saved.players) || !Array.isArray(saved.flights)
        || saved.players.some(p => !count(p.id) || p.id < 1 || !cleanLabel(p.label))
        || new Set(saved.players.map(p=>p.id)).size !== saved.players.length
        || saved.flights.some(f => typeof f.id !== 'string' || !saved.players.some(p=>p.id===f.playerId)
          || !count(f.score) || !count(f.coins) || !Number.isFinite(Date.parse(f.at)))) throw new Error('Invalid event data');
      data = saved;
    }
  } catch {
    corrupt = true;
    error = 'Saved event data could not be opened. Ask staff to use a different event link; existing data has not been overwritten.';
  }
  function persist() {
    if (corrupt) return false;
    try { storage.setItem(key, JSON.stringify(data)); error=''; return true; }
    catch { error='This browser could not save the scores. Export a backup now and ask staff to check browser storage before continuing.'; return false; }
  }
  if (!corrupt) persist();
  function standings() {
    const rows = data.players.map(p => {
      const flights = data.flights.filter(f=>f.playerId===p.id);
      const best = flights.reduce((top,f)=>!top || f.score>top.score ? f : top, null);
      return {...p, best:best?.score ?? null, attempts:flights.length, at:best?.at ?? ''};
    }).filter(p=>p.best!==null).sort((a,b)=>b.best-a.best || a.at.localeCompare(b.at) || a.id-b.id);
    let rank=0, previous=null;
    return rows.map((p,index)=>{if(p.best!==previous)rank=index+1;previous=p.best;return {...p,rank};});
  }
  return {
    get error(){return error;},
    nextLabel(){return `P${String(Math.max(0,...data.players.map(p=>p.id))+1).padStart(3,'0')}`;},
    register(label) {
      if (error && !persist()) throw new Error(error);
      label=cleanLabel(label);
      if (!label) throw new Error('Enter a nickname or ticket number.');
      let player=data.players.find(p=>p.label.normalize('NFKC').toLowerCase()===label.normalize('NFKC').toLowerCase());
      if (!player) {player={id:Math.max(0,...data.players.map(p=>p.id))+1,label};data.players.push(player);}
      if (!persist()) throw new Error(error);
      return {...player};
    },
    record({id,playerId,score,coins,at=new Date().toISOString()}) {
      if (corrupt) return false;
      if (data.flights.some(f=>f.id===id)) return !error;
      if (typeof id!=='string' || !id || !data.players.some(p=>p.id===playerId) || !count(score) || !count(coins)
        || !Number.isFinite(Date.parse(at))) throw new Error('Invalid flight result');
      data.flights.push({id,playerId,score,coins,at});
      return persist();
    },
    standings,
    exportCSV() {
      // Quote every cell and neutralize spreadsheet formulas in participant labels.
      const cell = value => {let s=String(value ?? '');if(/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
      const rows=[['Event','Rank','Player','Best gates','Completed flights','Best achieved (UTC)'],
        ...standings().map(p=>[event,p.rank,p.label,p.best,p.attempts,p.at])];
      return '\uFEFF'+rows.map(row=>row.map(cell).join(',')).join('\r\n');
    },
  };
}
