(() => {
  'use strict';

  const BUILD_ID = '2026.08.02.11';
  const RELOAD_GUARD = `xccommand_build_reload_${BUILD_ID}`;

  function cleanMessage(error) {
    return String(error?.message || error || 'Unknown startup error')
      .replace(/[<>]/g, '')
      .slice(0, 220);
  }

  function showStartupFailure(error) {
    console.error('XC Command application startup failed.', error);

    const securityCard = [...document.querySelectorAll('#settings .card')]
      .find((card) => card.querySelector('h3')?.textContent.trim() === 'Account security');

    if (securityCard && !document.getElementById('cloudAccountButton')) {
      securityCard.innerHTML = `
        <div class="card-head">
          <div>
            <h3>XC Command startup</h3>
            <div class="sub">Application modules did not finish loading</div>
          </div>
          <span class="pill warn">Reload required</span>
        </div>
        <div class="insight">
          <strong>Your device data remains saved.</strong>
          <p id="xcLegacyStartupError"></p>
        </div>
        <div class="toolbar" style="margin-top:14px">
          <button type="button" class="secondary" id="xcLegacyReload">Reload current version</button>
        </div>
      `;
      const message = document.getElementById('xcLegacyStartupError');
      if (message) message.textContent = cleanMessage(error);
      document.getElementById('xcLegacyReload')?.addEventListener('click', () => {
        window.location.reload();
      });
    }
  }

  function installControllerReload() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (sessionStorage.getItem(RELOAD_GUARD)) return;
      sessionStorage.setItem(RELOAD_GUARD, '1');
      window.location.reload();
    });
  }

  async function refreshServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    installControllerReload();
    const registration = await navigator.serviceWorker.register(`./sw.js?build=${BUILD_ID}`);
    await registration.update();
  }

  async function startCurrentApp() {
    await refreshServiceWorker().catch((error) => {
      console.warn('XC Command could not refresh its offline cache.', error);
    });

    await import(`./season-bootstrap.js?build=${BUILD_ID}`);
    if (window.XC_SEASON_RESET_APPLIED) return;

    // Keep this literal import for static QA while the cache-busted import below forces freshness.
    const stableLoader = () => import('./app-modules.js');
    void stableLoader;
    await import(`./app-modules.js?build=${BUILD_ID}`);
  }

  startCurrentApp().catch(showStartupFailure);
})();
