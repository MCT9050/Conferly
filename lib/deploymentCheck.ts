// lib/deploymentCheck.ts
// Deployment readiness validation utility for Conferly

import { getServerEnv } from './serverEnv';

export interface DeploymentCheckResult {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
  critical: boolean;
}

export interface DeploymentReport {
  overallStatus: 'ready' | 'not-ready' | 'degraded';
  checks: DeploymentCheckResult[];
  timestamp: number;
  environment: string;
}

/**
 * Run all deployment readiness checks
 */
export async function runDeploymentChecks(): Promise<DeploymentReport> {
  const checks: DeploymentCheckResult[] = [];
  
  // Environment validation
  checks.push(await checkEnvironmentVariables());
  
  // Supabase configuration
  checks.push(await checkSupabaseConfig());
  
  // Monitoring configuration (optional)
  checks.push(await checkMonitoringConfig());
  
  // Build integrity
  checks.push(await checkBuildIntegrity());
  
  // Runtime compatibility
  checks.push(await checkRuntimeCompatibility());
  
  // Calculate overall status
  const criticalFailures = checks.filter(c => c.critical && c.status === 'fail');
  const warnings = checks.filter(c => c.status === 'warn');
  
  let overallStatus: 'ready' | 'not-ready' | 'degraded';
  if (criticalFailures.length > 0) {
    overallStatus = 'not-ready';
  } else if (warnings.length > 0) {
    overallStatus = 'degraded';
  } else {
    overallStatus = 'ready';
  }
  
  return {
    overallStatus,
    checks,
    timestamp: Date.now(),
    environment: process.env.NODE_ENV || 'unknown',
  };
}

/**
 * Check required environment variables
 */
async function checkEnvironmentVariables(): Promise<DeploymentCheckResult> {
  try {
    const env = getServerEnv();
    return {
      name: 'Environment Variables',
      status: 'pass',
      message: 'All required environment variables are set',
      critical: true,
    };
  } catch (error) {
    return {
      name: 'Environment Variables',
      status: 'fail',
      message: error instanceof Error ? error.message : 'Missing required environment variables',
      critical: true,
    };
  }
}

/**
 * Check Supabase configuration
 */
async function checkSupabaseConfig(): Promise<DeploymentCheckResult> {
  try {
    const env = getServerEnv();
    
    // Validate URL format
    try {
      new URL(env.SUPABASE_URL);
    } catch {
      return {
        name: 'Supabase Configuration',
        status: 'fail',
        message: 'SUPABASE_URL is not a valid URL',
        critical: true,
      };
    }
    
    // Validate key format (basic check)
    if (!env.SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY.length < 20) {
      return {
        name: 'Supabase Configuration',
        status: 'fail',
        message: 'SUPABASE_ANON_KEY appears invalid (too short)',
        critical: true,
      };
    }
    
    return {
      name: 'Supabase Configuration',
      status: 'pass',
      message: 'Supabase configuration is valid',
      critical: true,
    };
  } catch (error) {
    return {
      name: 'Supabase Configuration',
      status: 'fail',
      message: error instanceof Error ? error.message : 'Supabase configuration check failed',
      critical: true,
    };
  }
}

/**
 * Check monitoring configuration (optional)
 */
async function checkMonitoringConfig(): Promise<DeploymentCheckResult> {
  try {
    const env = getServerEnv();
    
    if (!env.MONITORING_ENDPOINT || !env.MONITORING_KEY) {
      return {
        name: 'Monitoring Configuration',
        status: 'warn',
        message: 'Monitoring is not configured (optional for development)',
        critical: false,
      };
    }
    
    // Validate URL format
    try {
      new URL(env.MONITORING_ENDPOINT);
    } catch {
      return {
        name: 'Monitoring Configuration',
        status: 'warn',
        message: 'MONITORING_ENDPOINT is not a valid URL',
        critical: false,
      };
    }
    
    return {
      name: 'Monitoring Configuration',
      status: 'pass',
      message: 'Monitoring configuration is valid',
      critical: false,
    };
  } catch (error) {
    return {
      name: 'Monitoring Configuration',
      status: 'warn',
      message: 'Monitoring configuration check failed (optional)',
      critical: false,
    };
  }
}

/**
 * Check build integrity
 */
async function checkBuildIntegrity(): Promise<DeploymentCheckResult> {
  // In a real implementation, this could check:
  // - Build hash consistency
  // - Asset integrity
  // - Version consistency
  
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (isProduction) {
    return {
      name: 'Build Integrity',
      status: 'pass',
      message: 'Production build detected',
      critical: true,
    };
  }
  
  return {
    name: 'Build Integrity',
    status: 'warn',
    message: 'Running in development mode (not production build)',
    critical: false,
  };
}

/**
 * Check runtime compatibility
 */
async function checkRuntimeCompatibility(): Promise<DeploymentCheckResult> {
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
  
  // Next.js 16 requires Node.js 18.17 or later
  if (majorVersion < 18) {
    return {
      name: 'Runtime Compatibility',
      status: 'fail',
      message: `Node.js ${nodeVersion} is not supported. Requires Node.js 18.17+`,
      critical: true,
    };
  }
  
  return {
    name: 'Runtime Compatibility',
    status: 'pass',
    message: `Node.js ${nodeVersion} is compatible`,
    critical: true,
  };
}

/**
 * Assert deployment readiness - throws if not ready
 */
export async function assertDeploymentReady(): Promise<void> {
  const report = await runDeploymentChecks();
  
  if (report.overallStatus === 'not-ready') {
    const criticalFailures = report.checks
      .filter(c => c.critical && c.status === 'fail')
      .map(c => `- ${c.name}: ${c.message}`)
      .join('\n');
    
    throw new Error(
      `Deployment is not ready:\n${criticalFailures}`
    );
  }
}

/**
 * Format deployment report for logging
 */
export function formatDeploymentReport(report: DeploymentReport): string {
  const lines = [
    `=== Deployment Readiness Report ===`,
    `Status: ${report.overallStatus.toUpperCase()}`,
    `Environment: ${report.environment}`,
    `Timestamp: ${new Date(report.timestamp).toISOString()}`,
    ``,
    `Checks:`,
  ];
  
  for (const check of report.checks) {
    const statusIcon = check.status === 'pass' ? '✓' : check.status === 'fail' ? '✗' : '⚠';
    const criticalMarker = check.critical ? ' [CRITICAL]' : '';
    lines.push(`  ${statusIcon} ${check.name}${criticalMarker}: ${check.message}`);
  }
  
  return lines.join('\n');
}
