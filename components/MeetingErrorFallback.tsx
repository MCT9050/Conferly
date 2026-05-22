"use client";

import { AlertCircle, Video, Mic, Wifi, RefreshCw } from 'lucide-react';

interface MeetingErrorFallbackProps {
  error: Error;
  resetError: () => void;
}

/**
 * Fallback UI for meeting runtime errors
 * Provides actionable error messages and recovery options
 */
export function MeetingErrorFallback({ error, resetError }: MeetingErrorFallbackProps) {
  const errorMessage = error?.message || 'An unexpected error occurred';
  
  // Categorize error type for better UX
  const isMediaError = errorMessage.includes('camera') || 
                      errorMessage.includes('microphone') || 
                      errorMessage.includes('media') ||
                      errorMessage.includes('Permission denied');
  
  const isNetworkError = errorMessage.includes('network') ||
                        errorMessage.includes('connection') ||
                        errorMessage.includes('timeout');
  
  const isScreenShareError = errorMessage.includes('screen') ||
                            errorMessage.includes('display');

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-gradient-to-br from-slate-950 to-slate-900">
      <div className="max-w-md w-full">
        <div className="p-6 rounded-lg border border-red-900/30 bg-red-950/20 backdrop-blur">
          {/* Error Icon */}
          <div className="flex justify-center mb-4">
            {isMediaError && <Video className="w-12 h-12 text-red-400" />}
            {isNetworkError && <Wifi className="w-12 h-12 text-red-400" />}
            {isScreenShareError && <AlertCircle className="w-12 h-12 text-red-400" />}
            {!isMediaError && !isNetworkError && !isScreenShareError && (
              <AlertCircle className="w-12 h-12 text-red-400" />
            )}
          </div>

          {/* Error Message */}
          <h2 className="text-center font-semibold text-lg text-red-300 mb-2">
            {isMediaError && "Camera/Microphone Error"}
            {isNetworkError && "Connection Error"}
            {isScreenShareError && "Screen Share Error"}
            {!isMediaError && !isNetworkError && !isScreenShareError && "Meeting Error"}
          </h2>

          <p className="text-center text-sm text-red-400/80 mb-4">
            {errorMessage}
          </p>

          {/* Helpful Hints */}
          <div className="mb-6 p-3 rounded-md bg-slate-900/50 border border-slate-800">
            <h3 className="text-xs font-semibold text-slate-400 mb-2">What you can try:</h3>
            <ul className="text-xs text-slate-400 space-y-1">
              {isMediaError && (
                <>
                  <li>• Check that camera/microphone permissions are granted</li>
                  <li>• Ensure no other app is using your camera/microphone</li>
                  <li>• Try joining with audio-only mode</li>
                </>
              )}
              {isNetworkError && (
                <>
                  <li>• Check your internet connection</li>
                  <li>• Try moving closer to your WiFi router</li>
                  <li>• Refresh the page to reconnect</li>
                </>
              )}
              {isScreenShareError && (
                <>
                  <li>• Ensure you have screen sharing permission</li>
                  <li>• Try selecting a different window or monitor</li>
                  <li>• Disable and re-enable screen sharing</li>
                </>
              )}
              {!isMediaError && !isNetworkError && !isScreenShareError && (
                <>
                  <li>• Try refreshing the page</li>
                  <li>• Clear browser cache and cookies</li>
                  <li>• Try a different browser</li>
                </>
              )}
            </ul>
          </div>

          {/* Recovery Buttons */}
          <div className="flex flex-col gap-2">
            <button
              onClick={resetError}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-red-900/40 hover:bg-red-900/60 text-red-300 font-medium transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </button>
            <button
              onClick={() => window.location.href = '/'}
              className="px-4 py-2.5 rounded-lg border border-slate-700 hover:border-slate-600 text-slate-300 font-medium transition-colors"
            >
              Return to Dashboard
            </button>
          </div>

          {/* Debug Info (Development Only) */}
          {process.env.NODE_ENV === 'development' && (
            <div className="mt-4 p-2 rounded-md bg-slate-900/50 border border-slate-800">
              <p className="text-xs font-mono text-slate-500 break-all">
                {error?.stack?.split('\n')[1] || 'No stack trace available'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Fallback UI for media stage errors
 * Shows UI options to continue without media
 */
export function MediaErrorFallback({ error, resetError }: MeetingErrorFallbackProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 p-6 rounded-lg border border-amber-900/30 bg-amber-950/20">
      <div className="flex items-center gap-3">
        <Video className="w-6 h-6 text-amber-400" />
        <div>
          <h3 className="font-semibold text-amber-300">Media Unavailable</h3>
          <p className="text-sm text-amber-400/80 mt-1">{error.message}</p>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={resetError}
          className="px-3 py-1.5 rounded-md bg-amber-900/40 hover:bg-amber-900/60 text-amber-300 text-sm font-medium transition-colors"
        >
          Retry
        </button>
        <button
          onClick={() => window.location.reload()}
          className="px-3 py-1.5 rounded-md border border-amber-700 hover:border-amber-600 text-amber-300 text-sm font-medium transition-colors"
        >
          Reload
        </button>
      </div>
    </div>
  );
}

/**
 * Fallback UI for panel errors
 * Allows continuing meeting despite panel failure
 */
export function PanelErrorFallback({ error, resetError }: MeetingErrorFallbackProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 p-4 rounded-lg border border-orange-900/30 bg-orange-950/20">
      <div className="flex items-center gap-2">
        <AlertCircle className="w-5 h-5 text-orange-400" />
        <p className="text-sm text-orange-300">Panel failed to load</p>
      </div>
      <button
        onClick={resetError}
        className="px-3 py-1 rounded-md bg-orange-900/40 hover:bg-orange-900/60 text-orange-300 text-xs font-medium transition-colors"
      >
        Retry
      </button>
    </div>
  );
}
