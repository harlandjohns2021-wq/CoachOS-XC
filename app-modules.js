function cleanMessage(error) {
  return String(error?.message || error || 'Unknown startup error')
    .replace(/[<>]/g, '')
    .slice(0, 220);
}

function showCloudStartupFailure(error) {
  if (document.getElementById('cloudAccountButton')) return;

  const securityCard = [...document.querySelectorAll('#settings .card')]
    .find((card) => card.querySelector('h3')?.textContent.trim() === 'Account security');

  if (securityCard) {
    securityCard.dataset.cloudStartupFailure = 'true';
    securityCard.innerHTML = `
      <div class="card-head">
        <div>
          <h3>XC Command account</h3>
          <div class="sub">Firebase authentication and cloud synchronization</div>
        </div>
        <span class="pill warn">Cloud module unavailable</span>
      </div>
      <div class="insight">
        <strong>Device saving is still active.</strong>
        <p id="xcCloudStartupError"></p>
      </div>
      <div class="toolbar" style="margin-top:14px">
        <button type="button" class="secondary" id="xcRetryCloudStartup">Retry cloud startup</button>
      </div>
    `;
    const message = document.getElementById('xcCloudStartupError');
    if (message) {
      message.textContent = `The cloud account controls could not start. ${cleanMessage(error)}`;
    }
    document.getElementById('xcRetryCloudStartup')?.addEventListener('click', () => {
      window.location.reload();
    });
  }

  const diagnostic = document.getElementById('xcSyncDiagnosticText');
  if (diagnostic) {
    diagnostic.textContent = `Online • Cloud module did not start • ${cleanMessage(error)}`;
  }
}

function reportModuleFailure(label, error) {
  console.error(`XC Command ${label} failed to start.`, error);
  window.dispatchEvent(new CustomEvent('xccommand:module-error', {
    detail: { label, message: cleanMessage(error) }
  }));
  if (label === 'cloud account') showCloudStartupFailure(error);
}

async function startCoachOsModules() {
  try {
    await import('./startup-reconcile.js');
    if (window.XC_STARTUP_RELOAD_PENDING) return;
  } catch (error) {
    reportModuleFailure('startup reconciliation', error);
  }

  try {
    await import('./roster-profile.js');
    if (window.XC_STARTUP_RELOAD_PENDING) return;
  } catch (error) {
    reportModuleFailure('roster profile', error);
  }

  try {
    await import('./data-integrity-fixes.js');
  } catch (error) {
    reportModuleFailure('data integrity tools', error);
  }

  const modules = [
    ['cloud account', './firebase-cloud.js'],
    ['distance tools', './distance-enhancements.js'],
    ['practice workflow interface', './workflow-ui.js'],
    ['AI coach', './ai-coach.js'],
    ['individual science engine', './individual-science-engine.js']
  ];

  const results = await Promise.allSettled(
    modules.map(([, path]) => import(path))
  );

  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      reportModuleFailure(modules[index][0], result.reason);
    }
  });

  setTimeout(() => {
    if (!document.getElementById('cloudAccountButton')) {
      showCloudStartupFailure('Firebase loaded without creating its account controls.');
    }
  }, 2500);
}

startCoachOsModules().catch((error) => {
  reportModuleFailure('feature loader', error);
});
