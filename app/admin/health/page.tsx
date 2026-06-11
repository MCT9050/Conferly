'use client';

// app/admin/health/page.tsx
// Hidden health dashboard — accessible only in development mode.
// Displays the 6-pillar heartbeat status with green/red indicators
// plus system load and circuit breaker state metrics.

import { useEffect, useState, useCallback } from 'react';

interface PillarResult {
  name: string;
  status: 'pass' | 'fail';
  detail: string;
}

interface SystemLoad {
  globalUsage: number;
  globalMax: number;
  circuitState: string;
  totalKeys: number;
}

interface CircuitBreakerState {
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  retryAfter?: number;
  openedAt?: number;
}

interface HeartbeatResponse {
  timestamp: number;
  overall: 'healthy' | 'degraded' | 'error';
  summary: string;
  pillars: PillarResult[];
  systemLoad?: SystemLoad;
  circuitBreakerState?: CircuitBreakerState;
}

type PageState =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'dev-guard'; reason: string }
  | { phase: 'loaded'; data: HeartbeatResponse };

const PILLAR_ICONS: Record<string, string> = {
  'Infrastructure (LiveKit)': '📡',
  'Business (Lemon Squeezy)': '💼',
  'Intelligence (Hugging Face)': '🧠',
  'Database (Supabase)': '🗄️',
  'Routing (API Endpoints)': '🌐',
  'Resilience (Circuit Breaker)': '🛡️',
};

function PillarCard({ result }: { result: PillarResult }) {
  const isPass = result.status === 'pass';
  const icon = PILLAR_ICONS[result.name] ?? '🔌';

  return (
    <div
      className={`rounded-lg border-2 p-5 transition-all ${
        isPass
          ? 'border-emerald-500/50 bg-emerald-500/10'
          : 'border-red-500/50 bg-red-500/10'
      }`}
    >
      <div className="flex items-start gap-4">
        {/* Status indicator */}
        <div
          className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg font-bold ${
            isPass
              ? 'bg-emerald-500/20 text-emerald-400'
              : 'bg-red-500/20 text-red-400'
          }`}
        >
          {icon}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold text-white">{result.name}</span>
            <span
              className={`inline-flex h-4 w-4 shrink-0 rounded-full ${
                isPass ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]' : 'bg-red-400 shadow-[0_0_8px_rgba(239,68,68,0.5)]'
              }`}
            />
          </div>
          <p className="mt-1 text-sm text-slate-400 break-words">{result.detail}</p>
        </div>

        {/* Pass/Fail badge */}
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${
            isPass
              ? 'bg-emerald-500/20 text-emerald-400'
              : 'bg-red-500/20 text-red-400'
          }`}
        >
          {isPass ? 'PASS' : 'FAIL'}
        </span>
      </div>
    </div>
  );
}

function SystemLoadCard({ load }: { load: SystemLoad }) {
  const usagePct = Math.round((load.globalUsage / load.globalMax) * 100);
  const barColor =
    usagePct > 80 ? 'bg-red-500' :
    usagePct > 50 ? 'bg-amber-500' :
    'bg-emerald-500';

  return (
    <div className="rounded-lg border-2 border-slate-600/30 bg-slate-800/40 p-5">
      <div className="flex items-start gap-4">
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-lg font-bold text-blue-400">
          📊
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold text-white">System Load</span>
            <span className={`inline-flex h-4 w-4 shrink-0 rounded-full ${
              usagePct > 80 ? 'bg-red-400 shadow-[0_0_8px_rgba(239,68,68,0.5)]' :
              usagePct > 50 ? 'bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.5)]' :
              'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]'
            }`} />
          </div>
          {/* Bar chart */}
          <div className="mt-3 h-3 w-full rounded-full bg-slate-700/50 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${barColor}`}
              style={{ width: `${Math.min(usagePct, 100)}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between text-xs text-slate-400">
            <span>AI Rate Limit: {load.globalUsage} / {load.globalMax} requests</span>
            <span>{usagePct}%</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Active rate-limit keys: {load.totalKeys}
          </p>
        </div>
      </div>
    </div>
  );
}

function CircuitBreakerCard({ cb }: { cb: CircuitBreakerState }) {
  const stateConfig = {
    CLOSED: {
      label: 'CLOSED',
      color: 'text-emerald-400',
      border: 'border-emerald-500/50',
      bg: 'bg-emerald-500/10',
      dot: 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]',
      icon: '🔒',
    },
    HALF_OPEN: {
      label: 'HALF_OPEN',
      color: 'text-amber-400',
      border: 'border-amber-500/50',
      bg: 'bg-amber-500/10',
      dot: 'bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.5)]',
      icon: '⚠️',
    },
    OPEN: {
      label: 'OPEN',
      color: 'text-red-400',
      border: 'border-red-500/50',
      bg: 'bg-red-500/10',
      dot: 'bg-red-400 shadow-[0_0_8px_rgba(239,68,68,0.5)]',
      icon: '🚫',
    },
  };

  const config = stateConfig[cb.state] ?? stateConfig.CLOSED;

  return (
    <div className={`rounded-lg border-2 ${config.border} ${config.bg} p-5`}>
      <div className="flex items-start gap-4">
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-700/50 text-lg font-bold">
          {config.icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold text-white">Circuit Breaker</span>
            <span className={`inline-flex h-4 w-4 shrink-0 rounded-full ${config.dot}`} />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className={`text-sm font-bold uppercase tracking-wider ${config.color}`}>
              {config.label}
            </span>
            {cb.retryAfter && (
              <span className="text-xs text-slate-400">
                (retry in {cb.retryAfter}s)
              </span>
            )}
          </div>
          {cb.openedAt && (
            <p className="mt-1 text-xs text-slate-500">
              Opened at: {new Date(cb.openedAt).toLocaleTimeString()}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function DashboardContent({ data }: { data: HeartbeatResponse }) {
  const isHealthy = data.overall === 'healthy';

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-white">System Heartbeat</h1>
        <p className="mt-1 text-sm text-slate-500">
          Last checked: {new Date(data.timestamp).toLocaleTimeString()}
        </p>
      </div>

      {/* Overall status banner */}
      <div
        className={`rounded-xl border-2 p-6 text-center ${
          isHealthy
            ? 'border-emerald-500/50 bg-emerald-500/10'
            : 'border-red-500/50 bg-red-500/10'
        }`}
      >
        <div className="text-5xl">{isHealthy ? '✅' : '❌'}</div>
        <div
          className={`mt-2 text-2xl font-bold ${
            isHealthy ? 'text-emerald-400' : 'text-red-400'
          }`}
        >
          {isHealthy ? 'ALL SYSTEMS NOMINAL' : 'DEGRADED'}
        </div>
        <p className="mt-1 text-sm text-slate-400">{data.summary}</p>
      </div>

      {/* System Load + Circuit Breaker row */}
      {(data.systemLoad || data.circuitBreakerState) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {data.systemLoad && <SystemLoadCard load={data.systemLoad} />}
          {data.circuitBreakerState && <CircuitBreakerCard cb={data.circuitBreakerState} />}
        </div>
      )}

      {/* Pillar cards */}
      <div className="space-y-3">
        {data.pillars.map((pillar) => (
          <PillarCard key={pillar.name} result={pillar} />
        ))}
      </div>

      {/* Footer note */}
      <p className="text-center text-xs text-slate-600">
        This dashboard is only visible in development mode.
      </p>
    </div>
  );
}

export default function AdminHealthPage() {
  const [state, setState] = useState<PageState>({ phase: 'loading' });

  const fetchHeartbeat = useCallback(async () => {
    try {
      const response = await fetch('/api/heartbeat');
      if (!response.ok && response.status !== 503) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data: HeartbeatResponse = await response.json();
      setState({ phase: 'loaded', data });
    } catch {
      setState({
        phase: 'error',
        message:
          'Failed to connect to /api/heartbeat. Ensure the dev server is running.',
      });
    }
  }, []);

  useEffect(() => {
    // Check if we're in development by looking at the hostname
    const isDev =
      typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname.includes('.local'));

    if (!isDev) {
      setState({
        phase: 'dev-guard',
        reason: 'Health dashboard is only available in development mode.',
      });
      return;
    }

    fetchHeartbeat();
    const interval = setInterval(fetchHeartbeat, 30_000);
    return () => clearInterval(interval);
  }, [fetchHeartbeat]);

  // — Render states —

  if (state.phase === 'dev-guard') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-8">
        <div className="max-w-md text-center">
          <div className="text-6xl">🔒</div>
          <h1 className="mt-4 text-2xl font-bold text-white">Restricted</h1>
          <p className="mt-2 text-slate-400">{state.reason}</p>
        </div>
      </div>
    );
  }

  if (state.phase === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-8">
        <div className="max-w-md text-center">
          <div className="text-6xl">⚠️</div>
          <h1 className="mt-4 text-2xl font-bold text-white">Heartbeat Error</h1>
          <p className="mt-2 text-slate-400">{state.message}</p>
          <button
            onClick={fetchHeartbeat}
            className="mt-4 rounded-lg bg-slate-800 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (state.phase === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-8">
        <div className="text-center">
          <div className="text-5xl animate-pulse">⏳</div>
          <p className="mt-4 text-lg text-slate-400">Probing 6 pillars...</p>
        </div>
      </div>
    );
  }

  // Loaded
  return (
    <div className="min-h-screen bg-slate-950 p-8">
      <DashboardContent data={state.data} />
    </div>
  );
}