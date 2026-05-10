/**
 * OptionalComponentWrapper
 * Wraps optional components to prevent runtime crashes
 * If component fails, renders fallback silently
 */

import { Component, ReactNode } from 'react';

interface OptionalComponentWrapperProps {
  children: ReactNode;
  fallback?: ReactNode;
  componentName: string;
  silent?: boolean;
}

interface OptionalComponentWrapperState {
  hasError: boolean;
}

export default class OptionalComponentWrapper extends Component<
  OptionalComponentWrapperProps,
  OptionalComponentWrapperState
> {
  constructor(props: OptionalComponentWrapperProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): OptionalComponentWrapperState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Log error in development only
    if (import.meta.env.DEV) {
      console.warn(
        `[OptionalComponentWrapper] ${this.props.componentName} failed:`,
        error.message
      );
    }
    // In production, silently fail - this is an optional component
  }

  render() {
    if (this.state.hasError) {
      // Silently render fallback or nothing
      if (this.props.silent === false && this.props.fallback) {
        return this.props.fallback;
      }
      // Default: render nothing (optional component)
      return null;
    }

    return this.props.children;
  }
}