// Install controls are user initiated; no banners, prompts, or reloads during a flight.
export function setupInstall({onOpen = () => {}} = {}) {
  const byId = id => document.getElementById(id);
  const dialog = byId('install-dialog');
  const button = byId('install-button');
  const nativeButton = byId('native-install-button');
  const status = byId('install-status');
  const offlineStatus = byId('offline-status');
  const displayMode = window.matchMedia('(display-mode: standalone)');
  let installPrompt = null;
  let installed = displayMode.matches || navigator.standalone === true;
  const updateControls = () => {
    button.hidden = installed;
    nativeButton.hidden = installed || !installPrompt;
  };
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    installPrompt = event;
    updateControls();
  });
  window.addEventListener('appinstalled', () => {
    installed = true;
    installPrompt = null;
    status.textContent = 'Installed. Look for Medy Skyhop on your home screen.';
    updateControls();
  });
  displayMode.addEventListener('change', () => {
    installed = displayMode.matches || navigator.standalone === true;
    updateControls();
  });
  button.addEventListener('click', () => {
    onOpen();
    status.textContent = '';
    dialog.showModal();
  });
  const close = () => dialog.close();
  byId('close-install').addEventListener('click', close);
  byId('done-install').addEventListener('click', close);
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close();
  });
  nativeButton.addEventListener('click', async () => {
    if (!installPrompt) return;
    const prompt = installPrompt;
    installPrompt = null;
    nativeButton.disabled = true;
    try {
      await prompt.prompt();
      const result = await prompt.userChoice;
      status.textContent = result.outcome === 'accepted'
        ? 'Installation requested. Your browser will finish adding the app.'
        : 'You can keep playing here and install from your browser menu later.';
    } catch {
      status.textContent = 'Use your browser menu to add Medy to your home screen.';
    } finally {
      nativeButton.disabled = false;
      updateControls();
    }
  });
  updateControls();
  if ('serviceWorker' in navigator && window.isSecureContext) {
    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register('./sw.js', {scope:'./', updateViaCache:'none'});
        const markReady = () => {offlineStatus.textContent = 'Ready for offline play on this browser. Your device may clear saved game files if storage is needed.';};
        if (registration.active) markReady();
        else {
          const worker = registration.installing || registration.waiting;
          worker?.addEventListener('statechange', () => {
            if (worker.state === 'activated') markReady();
            if (worker.state === 'redundant') offlineStatus.textContent = 'Offline setup could not finish. Reopen the game with an internet connection to try again.';
          });
          if (worker?.state === 'activated') markReady();
        }
      } catch {
        offlineStatus.textContent = 'This browser could not save the game for offline play. You can still play with an internet connection.';
      }
    };
    if (document.readyState === 'complete') void register();
    else window.addEventListener('load', register, {once:true});
  } else {
    offlineStatus.textContent = 'Offline saving isn’t available in this browser. Play with an internet connection.';
  }
}
