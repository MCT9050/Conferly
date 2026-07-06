import { NextResponse } from 'next/server';
import { getServerEnv } from '@/lib/serverEnv';
import packageJson from '../../../package.json';

function getHealthEnvironment() {
  try {
    return getServerEnv().NODE_ENV;
  } catch {
    return process.env.NODE_ENV ?? 'development';
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    version: packageJson.version,
    environment: getHealthEnvironment(),
    timestamp: Date.now(),
    datadog: {
      enabled: true,
      service: process.env.DD_SERVICE || 'conferly-next',
      env: process.env.DD_ENV || 'dev',
      site: process.env.DD_SITE || 'us5.datadoghq.com',
      rum: process.env.DD_RUM_ENABLED === 'true',
      apm: process.env.DD_APM_INSTRUMENTATION_ENABLED === 'host',
    },
  }, {
    headers: {
      'Cache-Control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=300',
    },
  });
}

export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}
