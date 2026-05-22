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
  });
}

export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}
