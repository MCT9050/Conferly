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
  private loadingTimeout: NodeJS.Timeout | null = null;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      isLoading: true,
      loadingTooLong: false
    };
  }

  componentDidMount() {
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

            <p className="text-slate-400 mb-6 text-sm">
              We're having trouble loading the app on your device. Please try refreshing the page.
            </p>

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
