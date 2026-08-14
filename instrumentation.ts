export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initializeServerMonitoring } = await import('./lib/monitoring.server');
    await initializeServerMonitoring();
  }
}
