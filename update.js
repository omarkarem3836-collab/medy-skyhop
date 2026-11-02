export function waitForWorker(worker, states, timeout=120000) {
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>finish(new Error('The update is taking too long. Check your connection and try again.')),timeout);
    function finish(error){clearTimeout(timer);worker.removeEventListener('statechange',check);error?reject(error):resolve(worker);}
    function check(){if(states.includes(worker.state))finish();else if(worker.state==='redundant')finish(new Error('The download could not finish. Check your connection and try again.'));}
    worker.addEventListener('statechange',check);check();
  });
}

function waitForController(container, worker) {
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>finish(new Error('Please close the other game tabs, then try again.')),15000);
    function finish(error){clearTimeout(timer);container.removeEventListener('controllerchange',check);error?reject(error):resolve();}
    function check(){if(container.controller===worker)finish();}
    container.addEventListener('controllerchange',check);check();
  });
}

export async function refreshInstallation(container, report=()=>{}) {
  report('Checking for the latest game…');
  const registration=await container.register('./sw.js',{scope:'./',updateViaCache:'none'});
  await registration.update();
  const worker=registration.installing||registration.waiting||registration.active;
  if(!worker)throw new Error('The game could not start updating. Please try again.');
  if(worker.state!=='activated') {
    report('Downloading the latest game. Keep this page open…');
    await waitForWorker(worker,['installed','activating','activated']);
    if(worker.state==='installed')worker.postMessage({type:'MEDY_UPDATE_NOW'});
    await waitForWorker(worker,['activated']);
  }
  await waitForController(container,worker);
  report('Updated. Opening the game…');
}

if(typeof document!=='undefined') {
  const button=document.getElementById('update-game');
  const status=document.getElementById('update-status');
  button.addEventListener('click',async()=>{
    button.disabled=true;status.dataset.error='false';
    try {
      if(!('serviceWorker' in navigator))throw new Error('Open this link in Safari or Chrome to update the saved game.');
      await refreshInstallation(navigator.serviceWorker,message=>{status.textContent=message;});
      location.replace(new URL('./',location.href).href);
    }catch(error){
      status.textContent=error.message||'The update could not finish. Please check your connection and try again.';
      status.dataset.error='true';button.disabled=false;button.textContent='Try update again';
    }
  });
}
