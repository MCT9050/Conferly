import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Loader2 } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  isLoading: boolean;
  loadingTooLong: boolean;
}

export class MobileErrorBoundary extends Component<Props, State> {
  private loadingTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      isLoading: true,
      loadingTooLong: false
    };
  }

  componentDidMount() {
    // Guard: check if navigator is available
    if (typeof navigator === 'undefined') return;
    
    // Detect if we're on mobile
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    if (isMobile) {
      console.log('Mobile device detected, setting up loading timeout');
      // Set a timeout for mobile loading
      this.loadingTimeout = setTimeout(() => {
        this.setState({ loadingTooLong: true });
        console.warn('Mobile app loading taking too long');
      }, 10000); // 10 seconds
    }

    // Clear loading state after component mounts
    setTimeout(() => {
      this.setState({ isLoading: false });
      if (this.loadingTimeout) {
        clearTimeout(this.loadingTimeout);
        this.loadingTimeout = null;
      }
    }, 1000);
  }

  componentWillUnmount() {
    if (this.loadingTimeout) {
      clearTimeout(this.loadingTimeout);
    }
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      isLoading: false,
      loadingTooLong: false
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Mobile Error Boundary caught an error:', error, errorInfo);
    
    // Guard: check if navigator is available
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown';
    const memory = typeof performance !== 'undefined' ? {
      used: (performance as any).memory?.usedJSHeapSize,
      total: (performance as any).memory?.totalJSHeapSize,
      limit: (performance as any).memory?.jsHeapSizeLimit
    } : null;
    
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      userAgent,
      timestamp: new Date().toISOString(),
      memory
    });
    
    // Report to error tracking service if available
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      // Could add Sentry/trackJS here
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    // Show loading state for mobile
    if (this.state.isLoading) {
      return (
        <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-900 rounded-2xl p-6 text-center">
            <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
            </div>

            <h1 className="text-xl font-bold text-white mb-2">
              Loading Conferly
            </h1>

            <p className="text-slate-400 mb-6 text-sm">
              Please wait while we set up your experience...
            </p>
          </div>
        </div>
      );
    }

    // Show loading too long warning
    if (this.state.loadingTooLong) {
      return (
        <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-900 rounded-2xl p-6 text-center">
            <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-amber-400" />
            </div>

            <h1 className="text-xl font-bold text-white mb-2">
              Taking longer than expected
            </h1>

            <p className="text-slate-400 mb-6 text-sm">
              The app is taking longer to load than usual. This might be due to a slow connection or mobile browser optimization.
            </p>

            <button
              onClick={() => window.location.reload()}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh Page
            </button>

            <div className="mt-4 text-xs text-slate-500">
              Mobile troubleshooting tips:
              <ul className="mt-2 space-y-1 text-left">
                <li>• Check your internet connection</li>
                <li>• Close other browser tabs</li>
                <li>• Try refreshing the page</li>
                <li>• Use Chrome/Safari for best experience</li>
              </ul>
            </div>
          </div>
        </div>
      );
    }

    // Show error state
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-900 rounded-2xl p-6 text-center">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>

            <h1 className="text-xl font-bold text-white mb-2">
              Something went wrong
            </h1>

            <p className="text-slate-400 mb-4 text-sm">
              We're having trouble loading the app on your device. Please try refreshing the page.
            </p>

            {/* Error details for debugging */}
            {this.state.error && (
              <details className="mb-4 text-left">
                <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-400">
                  Error Details (tap to expand)
                </summary>
                <div className="mt-2 p-2 bg-slate-800 rounded text-xs text-red-400 font-mono break-all">
                  <div className="font-bold">Error:</div>
                  <div>{this.state.error.message}</div>
                  {this.state.error.stack && (
                    <div className="mt-2">
                      <div className="font-bold">Stack:</div>
                      <div className="text-xs text-slate-400">{this.state.error.stack.slice(0, 500)}...</div>
                    </div>
                  )}
                </div>
              </details>
            )}

            <button
              onClick={this.handleRetry}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </button>

            <div className="mt-4 text-xs text-slate-500">
              If this continues, please try:
              <ul className="mt-2 space-y-1 text-left">
                <li>• Clear your browser cache</li>
                <li>• Try a different browser</li>
                <li>• Check your internet connection</li>
                <li>• Check console for more details</li>
              </ul>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default MobileErrorBoundary;
