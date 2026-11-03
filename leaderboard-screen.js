import {api} from './online-api.js';
const $=id=>document.getElementById(id);let running=false,received=false;
async function refresh(){
  if(running||document.hidden)return;running=true;
  try{const data=await api('leaderboard'),rows=data.rows.slice(0,10);$('screen-rows').replaceChildren();
    for(const row of rows){const tr=document.createElement('tr');if(row.rank===1)tr.className='first';
      const rank=document.createElement('td');rank.textContent=row.rank;
      const name=document.createElement('td');name.dir='auto';name.append(document.createTextNode(row.label));const code=document.createElement('small');code.textContent=row.code;name.append(code);
      const score=document.createElement('td');score.textContent=row.best;tr.append(rank,name,score);$('screen-rows').append(tr);
    }
    received=true;$('screen-empty').hidden=rows.length>0;$('player-count').textContent=`${data.players} ${data.players===1?'player':'players'}`;$('screen-status').classList.remove('error');
    $('screen-status').textContent=`Live · Updated ${new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'})} · Refreshes every 10 seconds`;
  }catch{$('screen-status').textContent=received?'Reconnecting… Showing the last received scores.':'Connecting… Check this screen’s internet connection.';$('screen-status').classList.add('error');}finally{running=false;}
}
void refresh();setInterval(refresh,10000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refresh();});
