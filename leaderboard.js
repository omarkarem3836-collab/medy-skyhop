import {api,registerPlayer,queueScore,sendScore,flushScores} from './online-api.js';
export function setupLeaderboard({onStart,onOpen,onSeed}) {
  const $=id=>document.getElementById(id);
  let player=null,pendingRun=null,activeRun=null,taps=[],busy=false,resultRun=null,generation=0;
  const result=document.createElement('p');result.id='player-result';result.className='player-result';document.querySelector('.coin-receipt').after(result);
  const resultButton=document.createElement('button');resultButton.className='text-button open-leaderboard';resultButton.textContent='Leaderboard';document.querySelector('.result-secondary .home-button').before(resultButton);
  const entry=$('player-dialog'),board=$('leaderboard-dialog'),form=$('player-form'),submit=form.querySelector('[type=submit]');
  function setBusy(value){busy=value;submit.disabled=value;$('retry-button').disabled=value;$('play-button').disabled=value;submit.textContent=value?'Joining…':'Let’s fly';}
  async function openBoard(){
    onOpen();board.showModal();$('leaderboard-status').textContent='Loading shared rankings…';
    await flushScores();
    try{
      const {rows,players}=await api('leaderboard');$('leaderboard-rows').replaceChildren();
      for(const row of rows){const tr=document.createElement('tr');if(row.rank===1)tr.className='leaderboard-first';if(row.id===player?.id)tr.setAttribute('aria-current','true');
        for(const value of [row.rank,`${row.label} · ${row.code}`,row.best]){const td=document.createElement('td');td.textContent=value;td.dir='auto';tr.append(td);}$('leaderboard-rows').append(tr);
      }
      $('leaderboard-empty').hidden=rows.length>0;$('leaderboard-status').classList.remove('ranking-error');
      $('leaderboard-status').textContent=`Shared across all devices · ${players} players · Top 100. Best flight per player; equal scores share a rank.`;
    }catch(error){$('leaderboard-status').textContent=error.message;$('leaderboard-status').classList.add('ranking-error');}
  }
  document.querySelectorAll('.open-leaderboard').forEach(button=>button.addEventListener('click',()=>void openBoard()));
  $('close-leaderboard').addEventListener('click',()=>board.close());$('leaderboard-done').addEventListener('click',()=>board.close());
  $('cancel-player').addEventListener('click',()=>{generation++;entry.close();});
  entry.addEventListener('cancel',()=>{generation++;});
  function showEntry(error=''){$('player-name').value=player?.label||'';$('player-error').textContent=error;if(!entry.open)entry.showModal();$('player-name').focus();}
  async function prepare(){
    if(busy)return;const attempt=++generation;setBusy(true);
    try{const {run}=await api('runs',{playerId:player.id},player.token);if(attempt!==generation)return;
      pendingRun=run;onSeed(run.seed);$('player-badge').textContent=`${player.label} · ${player.code}`;entry.close();setBusy(false);onStart();
    }catch(error){if(attempt===generation)showEntry(error.message);}finally{setBusy(false);}
  }
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(busy)return;const attempt=++generation;setBusy(true);$('player-error').textContent='';
    try{const p=await registerPlayer($('player-name').value);if(attempt!==generation)return;player=p;setBusy(false);await prepare();}
    catch(error){$('player-error').textContent=error.message;}finally{setBusy(false);}
  });
  void flushScores();
  return {
    requestStart(){if(pendingRun)return false;if(!player)showEntry();else void prepare();return true;},
    begin(){activeRun=pendingRun;pendingRun=null;taps=[0];resultRun=null;result.textContent='';$('player-badge').hidden=false;},
    flap(time){if(activeRun)taps.push(Math.round(time*120));},
    best(){return player?player.best??0:null;},
    async finish(game){
      if(!player||!activeRun)return;const run=activeRun,pilot={...player};activeRun=null;resultRun=run.id;
      const item={token:pilot.token,body:{playerId:pilot.id,runId:run.id,taps:[...taps],ticks:Math.round(game.time*120),score:game.score}};
      queueScore(item);result.classList.remove('ranking-error');result.textContent='Saving your shared score…';
      try{const response=await sendScore(item);if(player?.id===pilot.id)player={...player,...response.player};if(resultRun!==run.id)return;
        result.textContent=`${pilot.label} · ${pilot.code} · Rank #${response.player.rank}`;$('result-best').textContent=response.player.best;
        $('announcer').textContent=`${pilot.label}: ${game.score} gates. Shared rank ${response.player.rank}. Score saved.`;
      }catch(error){if(resultRun!==run.id)return;result.textContent=error.permanent?error.message:'Score waiting to upload. Reconnect, then open Leaderboard.';result.classList.add('ranking-error');}
    },
    home(){generation++;player=null;activeRun=null;pendingRun=null;resultRun=null;$('player-badge').hidden=true;result.textContent='';},
  };
}
