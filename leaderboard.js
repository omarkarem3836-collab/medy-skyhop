import {createLeaderboardStore} from './leaderboard-store.js';

export function setupLeaderboard({onStart,onOpen}) {
  const $=id=>document.getElementById(id);
  let storage;
  try{storage=localStorage;}catch{storage={getItem(){throw Error('Unavailable');},setItem(){throw Error('Unavailable');}};}
  const store=createLeaderboardStore(storage);
  let player=null, flightId=null;
  const result=document.createElement('p');result.id='player-result';result.className='player-result';
  document.querySelector('.coin-receipt').after(result);
  const resultButton=document.createElement('button');resultButton.className='text-button open-leaderboard';resultButton.textContent='Leaderboard';
  document.querySelector('.result-secondary .home-button').before(resultButton);
  const entry=$('player-dialog'),board=$('leaderboard-dialog');
  function openBoard() {
    onOpen();
    const rows=store.standings();
    $('leaderboard-rows').replaceChildren();
    for(const row of rows) {
      const tr=document.createElement('tr');if(row.rank===1)tr.className='leaderboard-first';
      if(row.id===player?.id)tr.setAttribute('aria-current','true');
      for(const value of [row.rank,row.label,row.best]) {
        const td=document.createElement('td');td.textContent=value;td.dir='auto';tr.append(td);
      }
      $('leaderboard-rows').append(tr);
    }
    $('leaderboard-empty').hidden=rows.length>0;
    $('leaderboard-status').textContent=store.error||'Best flight per player. Equal scores share a rank. Saved on this device.';
    $('leaderboard-status').classList.toggle('ranking-error',!!store.error);
    board.showModal();
  }
  document.querySelectorAll('.open-leaderboard').forEach(button=>button.addEventListener('click',openBoard));
  $('close-leaderboard').addEventListener('click',()=>board.close());
  $('leaderboard-done').addEventListener('click',()=>board.close());
  $('cancel-player').addEventListener('click',()=>entry.close());
  $('player-form').addEventListener('submit',event=>{
    event.preventDefault();
    try {
      player=store.register($('player-name').value);
      $('player-badge').textContent=player.label;
      $('player-badge').hidden=false;
      entry.close();onStart();
    }catch(error){$('player-error').textContent=error.message;}
  });
  return {
    requestStart() {
      if(player && !store.error)return false;
      $('player-name').value=player?.label||'';
      $('player-error').textContent=store.error;
      entry.showModal();$('player-name').focus();return true;
    },
    begin() {
      flightId=crypto.randomUUID();$('player-result').textContent='';
      $('player-badge').hidden=false;
    },
    best(){return player?store.standings().find(p=>p.id===player.id)?.best??0:null;},
    finish(game) {
      if(!player||!flightId)return;
      const saved=store.record({id:flightId,playerId:player.id,score:game.score,coins:game.coins});
      flightId=null;
      const rows=store.standings(),row=rows.find(p=>p.id===player.id);
      const tied=rows.filter(p=>p.best===row.best).length>1;
      $('player-result').textContent=saved?`${player.label} · ${tied?'Joint rank':'Rank'} #${row.rank}`:store.error;
      $('player-result').classList.toggle('ranking-error',!saved);
      $('result-best').textContent=row.best;
      $('announcer').textContent=`${player.label}: ${game.score} gates. Rank ${row.rank}. ${saved?'Score saved.':store.error}`;
    },
    home(){player=null;flightId=null;$('player-badge').hidden=true;$('player-result').textContent='';},
  };
}
