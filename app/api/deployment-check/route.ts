import { NextResponse } from 'next/server';
import { runDeploymentChecks, formatDeploymentReport } from '@/lib/deploymentCheck';

/**
 * Deployment readiness check endpoint
 * GET /api/deployment-check
 * 
 * Returns deployment readiness status for monitoring and CI/CD
 */
export async function GET(request: Request) {
  // In production, you might want to add authentication here
  // to prevent unauthorized access to deployment status
  
  try {
    const report = await runDeploymentChecks();
    
    const acceptHeader = request.headers.get('accept');
    const isJson = acceptHeader?.includes('application/json');
    
    if (isJson) {
      return NextResponse.json(report, {
        status: report.overallStatus === 'not-ready' ? 503 : 200,
      });
    }
    
    // Plain text format for simple monitoring
    return new Response(formatDeploymentReport(report), {
      status: report.overallStatus === 'not-ready' ? 503 : 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  } catch (error) {
    return NextResponse.json(
      {
        overallStatus: 'not-ready',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now(),
      },
      { status: 503 }
    );
  }
}
