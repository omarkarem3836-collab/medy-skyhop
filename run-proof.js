import {createGame,flap,updateGame} from './engine.js';
export const MAX_RUN_TICKS=120*60*30;
export function seededRandom(seed) {
  let a=seed>>>0;
  return ()=>{a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return ((t^(t>>>14))>>>0)/4294967296;};
}
export function verifyFlight({seed,taps,ticks,score},wallMilliseconds) {
  if(!Number.isInteger(ticks)||ticks<1||ticks>MAX_RUN_TICKS||!Array.isArray(taps)||taps.length<1||taps.length>18000||taps[0]!==0)throw Error('Invalid flight recording.');
  if(wallMilliseconds+1500<ticks/120*1000)throw Error('Flight submitted too early.');
  let previous=-1;
  for(const tick of taps){if(!Number.isInteger(tick)||tick<0||tick>=ticks||tick<previous)throw Error('Invalid flap timing.');previous=tick;}
  const game=createGame({random:seededRandom(seed)});let tap=0;
  for(let tick=0;tick<ticks;tick++) {
    while(taps[tap]===tick){flap(game);tap++;}
    updateGame(game,1/120);
    if(game.state==='over'&&tick!==ticks-1)throw Error('Flight ended before the submitted result.');
  }
  if(game.state!=='over'||game.score!==score||tap!==taps.length)throw Error('The score does not match the flight.');
  return {score:game.score,coins:game.coins};
}
