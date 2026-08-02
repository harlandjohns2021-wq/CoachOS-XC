async function startCoachOsModules() {
  await import('./startup-reconcile.js');
  await import('./data-integrity-fixes.js');
  await import('./firebase-cloud.js');
  await import('./distance-enhancements.js');
  await Promise.all([
    import('./ai-coach.js'),
    import('./individual-science-engine.js')
  ]);
}

startCoachOsModules().catch((error) => {
  console.error('XC Command feature modules failed to start.', error);
  window.dispatchEvent(new CustomEvent('xccommand:module-error', {
    detail: { message: error?.message || 'Feature modules failed to start.' }
  }));
});
