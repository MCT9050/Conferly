"use client";

import { Loader2, Wifi, WifiOff, RotateCcw } from 'lucide-react';

interface ReconnectingUIProps {
  isReconnecting: boolean;
  progress: number;
  attempt?: number;
  maxAttempts?: number;
  onRetry?: () => void;
  onCancel?: () => void;
}

/**
 * UI component shown during reconnection
 */
export function ReconnectingUI({
  isReconnecting,
  progress,
  attempt = 1,
  maxAttempts = 5,
  onRetry,
  onCancel,
}: ReconnectingUIProps) {
  if (!isReconnecting && progress === 0) {
    return null;
  }

  const isError = progress === 100 && attempt >= maxAttempts;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 max-w-md w-full mx-4">
        {/* Icon */}
        <div className="flex justify-center mb-4">
          {isError ? (
            <WifiOff className="w-12 h-12 text-red-400" />
          ) : (
            <Loader2 className="w-12 h-12 text-blue-400 animate-spin" />
          )}
        </div>

        {/* Title */}
        <h2 className="text-center font-semibold text-lg text-white mb-2">
          {isError
            ? 'Connection Lost'
            : isReconnecting
            ? 'Reconnecting...'
            : 'Connection Interrupted'}
        </h2>

        {/* Message */}
        <p className="text-center text-sm text-slate-400 mb-4">
          {isError ? (
            "We've tried multiple times to reconnect. Please check your connection and refresh the page."
          ) : isReconnecting ? (
            `Attempting reconnection... (Attempt ${attempt}/${maxAttempts})`
          ) : (
            'Your connection was interrupted. Waiting to reconnect...'
          )}
        </p>

        {/* Progress Bar */}
        {!isError && (
          <div className="mb-4">
            <div className="w-full bg-slate-800 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${Math.max(10, Math.min(90, progress))}%` }}
              />
            </div>
            <p className="text-xs text-slate-500 mt-2 text-center">
              {Math.round(progress)}%
            </p>
          </div>
        )}

        {/* Helpful Info */}
        <div className="mb-4 p-3 rounded-md bg-slate-800/50 border border-slate-700">
          <p className="text-xs text-slate-400">
            {isError ? (
              <>
                <strong>Troubleshooting:</strong>
                <ul className="mt-1 space-y-1 list-disc list-inside">
                  <li>Check your internet connection</li>
                  <li>Try reloading the page</li>
                  <li>Switch to a different network if available</li>
                </ul>
              </>
            ) : (
              <>
                <strong>Temporary outage detected.</strong> We're working to restore your
                connection.
              </>
            )}
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {isError ? (
            <>
              <button
                onClick={onRetry}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Retry
              </button>
              <button
                onClick={() => window.location.href = '/'}
                className="flex-1 px-4 py-2 rounded-lg border border-slate-700 hover:border-slate-600 text-slate-300 font-medium transition-colors"
              >
                Home
              </button>
            </>
          ) : isReconnecting ? (
            <>
              <button
                onClick={onCancel}
                disabled={attempt >= maxAttempts - 1}
                className="flex-1 px-4 py-2 rounded-lg border border-slate-700 hover:border-slate-600 text-slate-300 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={onRetry}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Retry Now
              </button>
            </>
          ) : null}
        </div>

        {/* Debug Info */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-4 pt-4 border-t border-slate-700">
            <p className="text-xs text-slate-600 font-mono">
              Attempt: {attempt}/{maxAttempts} | Progress: {Math.round(progress)}%
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Offline indicator badge (non-blocking)
 */
export function OfflineIndicator() {
  return (
    <div className="fixed bottom-4 right-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-950/80 border border-amber-800 text-amber-300 text-sm z-40">
      <WifiOff className="w-4 h-4" />
      <span>You're offline</span>
    </div>
  );
}

/**
 * Connected badge (shown briefly after reconnect)
 */
export function ReconnectedIndicator() {
  return (
    <div className="fixed bottom-4 right-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-green-950/80 border border-green-800 text-green-300 text-sm z-40 animate-pulse">
      <Wifi className="w-4 h-4" />
      <span>Reconnected</span>
    </div>
  );
}
