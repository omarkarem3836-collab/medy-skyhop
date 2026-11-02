import {createExpoStore} from './expo-store.js';

export function setupExpo({onStart, onPause}) {
  const event = new URLSearchParams(location.search).get('expo');
  const noop = {requestStart:()=>false, begin:()=>{}, finish:()=>{}, home:()=>{}, best:()=>null};
  if (!event || !/^[a-zA-Z0-9_-]{1,40}$/.test(event)) return noop;
  document.body.dataset.expo='true';
  document.querySelector('.brand').href=location.href;
  document.querySelector('.game-title .pill').textContent='MEDSKY EXPO CHALLENGE';
  document.querySelector('.game-title p').textContent='Your flight. Your place on the board.';
  document.querySelector('.tap-hint').textContent='Clear the most gates. Become our sky champion.';
  document.querySelector('.header-caption').textContent='MEDSKY EXPO CHALLENGE';
  document.querySelector('#install-button').hidden=true;
  document.querySelectorAll('.home-button').forEach(button=>button.textContent='Next player');
  document.querySelector('#share-button').hidden=true;
  document.querySelector('#retry-button').firstChild.textContent='Same player · fly again ';
  let storage;
  try { storage=localStorage; } catch { storage={getItem(){throw Error('Unavailable');},setItem(){throw Error('Unavailable');}}; }
  const store=createExpoStore(storage,event);
  let player=null, flightId=null;
  const boardButton=document.createElement('button');
  boardButton.id='expo-board-button';boardButton.className='text-button';boardButton.textContent='Leaderboard';
  document.querySelector('.header-actions').prepend(boardButton);
  const badge=document.createElement('span');badge.id='expo-player-badge';badge.className='expo-player-badge';badge.hidden=true;
  document.querySelector('#game-stage').append(badge);
  const result=document.createElement('p');result.id='expo-result';result.className='expo-result';
  document.querySelector('.coin-receipt').after(result);
  const readyBoard=document.createElement('button');readyBoard.id='expo-ready-board';readyBoard.className='text-button expo-ready-board';readyBoard.textContent='View leaderboard';
  document.querySelector('.ready-actions').append(readyBoard);
  const formDialog=document.createElement('dialog');formDialog.id='expo-player-dialog';formDialog.className='expo-dialog';
  formDialog.setAttribute('aria-labelledby','expo-player-title');
  formDialog.innerHTML=`<form id="expo-player-form"><span class="eyebrow">READY, PILOT?</span><h2 id="expo-player-title">Your turn to fly.</h2><p>Use a ticket number or a unique nickname. Remember it to claim your place on the board.</p><label for="expo-player-name">Nickname or ticket number</label><input id="expo-player-name" name="player" maxlength="24" required autocomplete="off" autocapitalize="off" spellcheck="false" dir="auto"><p class="expo-form-note">Returning player? Enter the same name or number. Please don’t enter a full name or phone number.</p><p id="expo-entry-error" class="expo-error" role="status"></p><button type="submit" class="primary-button">Let’s fly <span aria-hidden="true">→</span></button><button type="button" id="expo-cancel" class="text-button">Back</button></form>`;
  document.body.append(formDialog);
  const board=document.createElement('dialog');board.id='expo-board';board.className='expo-dialog expo-board';
  board.setAttribute('aria-labelledby','expo-board-title');
  board.innerHTML=`<button id="expo-close-board" class="icon-button dialog-close" aria-label="Close leaderboard">×</button><span class="eyebrow">THE MEDSKY EXPO CHALLENGE</span><h2 id="expo-board-title">Our sky champions.</h2><p>Most gates in a single flight wins. Equal scores share a rank; staff can arrange a tie-break flight.</p><p id="expo-board-event" class="expo-event"></p><div class="expo-table-wrap"><table><thead><tr><th scope="col">Rank</th><th scope="col">Pilot</th><th scope="col">Best gates</th></tr></thead><tbody id="expo-board-rows"></tbody></table><p id="expo-empty">The sky is open. Be the first pilot on the board!</p></div><p id="expo-board-status" class="expo-storage-note" role="status"></p><button id="expo-export" class="primary-button">Export scores (CSV)</button><p class="expo-form-note">Staff: keep a backup during the event. These scores are saved only in this browser on this screen. Use one game tab, keep this event link, and don’t clear browser data.</p><button id="expo-board-done" class="text-button">Back to the game</button>`;
  document.body.append(board);
  const $=id=>document.getElementById(id);
  function updateSummary() {
    const leader=store.standings()[0];
    $('ready-best').textContent=leader?`TOP FLIGHT ${leader.best} GATES`:'EXPO · FIRST FLIGHT AWAITS';
  }
  function openBoard() {
    onPause();
    const rows=store.standings();
    $('expo-board-event').textContent=`Event ${event} · ${rows.length} ${rows.length===1?'pilot':'pilots'}`;
    $('expo-board-rows').replaceChildren();
    for (const row of rows) {
      const tr=document.createElement('tr');if(row.rank===1)tr.className='expo-leader';
      for(const value of [row.rank,row.label,row.best]){const td=document.createElement('td');td.textContent=value;td.dir='auto';tr.append(td);}
      $('expo-board-rows').append(tr);
    }
    $('expo-empty').hidden=rows.length>0;
    $('expo-export').disabled=!rows.length;
    $('expo-board-status').textContent=store.error||'Scores saved on this screen.';
    $('expo-board-status').classList.toggle('expo-error',!!store.error);
    board.showModal();
  }
  boardButton.addEventListener('click',openBoard);readyBoard.addEventListener('click',openBoard);
  $('expo-close-board').addEventListener('click',()=>board.close());
  $('expo-board-done').addEventListener('click',()=>board.close());
  $('expo-cancel').addEventListener('click',()=>formDialog.close());
  $('expo-player-form').addEventListener('submit',event=>{
    event.preventDefault();
    try {
      player=store.register($('expo-player-name').value);
      badge.textContent=`PILOT · ${player.label}`;badge.hidden=false;
      formDialog.close();onStart();
    } catch(error){$('expo-entry-error').textContent=error.message;}
  });
  $('expo-export').addEventListener('click',()=>{
    const url=URL.createObjectURL(new Blob([store.exportCSV()],{type:'text/csv;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download=`medsky-expo-${event}-scores.csv`;
    document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
    $('expo-board-status').textContent='Backup download requested. Check this device’s Downloads folder.';
  });
  updateSummary();
  return {
    requestStart() {
      if(player && !store.error) return false;
      $('expo-player-name').value=player?.label || store.nextLabel();$('expo-entry-error').textContent=store.error;
      formDialog.showModal();$('expo-player-name').focus();$('expo-player-name').select();return true;
    },
    begin(){flightId=crypto.randomUUID();result.textContent='';badge.hidden=false;},
    finish(game) {
      if(!player||!flightId) return;
      const saved=store.record({id:flightId,playerId:player.id,score:game.score,coins:game.coins});
      flightId=null;
      const row=store.standings().find(p=>p.id===player.id);
      const tied=store.standings().filter(p=>p.best===row.best).length>1;
      result.textContent=saved?`${player.label} · ${tied?'Joint rank':'Rank'} #${row.rank} · Best ${row.best} gates · Saved`:store.error;
      result.classList.toggle('expo-error',!saved);
      $('result-best').textContent=row.best;
      $('announcer').textContent=`${player.label}: ${game.score} gates. Rank ${row.rank}. ${saved?'Score saved.':store.error}`;
      updateSummary();
    },
    home(){player=null;flightId=null;badge.hidden=true;updateSummary();},
    best(){return player ? store.standings().find(p=>p.id===player.id)?.best ?? 0 : null;},
  };
}
