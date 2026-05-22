"use client";

import { ReactNode, Component, ReactElement, ErrorInfo } from 'react';
import { trackEvent } from '../lib/monitoring';
import { AlertCircle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactElement;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  name?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary for graceful error handling
 * Prevents entire app crash from component errors
 * Provides fallback UI and error recovery
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[ErrorBoundary${this.props.name ? ` - ${this.props.name}` : ''}]`, error, errorInfo);
    // Monitoring integration
    trackEvent({
      type: 'error',
      errorType: error.name,
      component: this.props.name || 'Unknown',
      stack: error.stack,
      timestamp: Date.now(),
    });
    this.props.onError?.(error, errorInfo);
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset);
      }

      return (
        <div className="flex flex-col items-center justify-center gap-4 p-6 rounded-lg border border-red-900/30 bg-red-950/20">
          <AlertCircle className="w-8 h-8 text-red-400" />
          <div>
            <h3 className="font-semibold text-red-300 mb-1">
              {this.props.name ? `${this.props.name} Error` : 'Something went wrong'}
            </h3>
            <p className="text-sm text-red-400/80 mb-3">{this.state.error.message}</p>
          </div>
          <button
            onClick={this.reset}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-red-900/40 hover:bg-red-900/60 text-red-300 text-sm font-medium transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
