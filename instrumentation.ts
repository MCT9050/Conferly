// instrumentation.ts
import tracer from 'dd-trace';

export function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // 1. Initialize the tracer globally
    tracer.init({
      logInjection: true,
      runtimeMetrics: true,
      plugins: true, // This must be a boolean, NOT an object
    });

    // 2. Explicitly configure your explicit plugins using tracer.use()
    tracer.use('http', {
      server: true,
      client: true,
      headers: ['User-Agent', 'Content-Type'],
    });

    tracer.use('next', {
      enabled: true,
    });

    tracer.use('pg', {
      enabled: true,
      service: 'conferly-postgres',
    });

    tracer.use('ioredis', {
      enabled: true,
    });

    tracer.use('fetch', {
      enabled: true,
    });
  }
}
