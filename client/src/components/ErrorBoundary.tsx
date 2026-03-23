import { Component } from "react";

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  errorMsg: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, errorMsg: "" };
  private retryTimer: any = null;

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMsg: error?.message || "Unknown error" };
  }

  componentDidCatch(error: Error, info: any) {
    console.error("[ErrorBoundary] Caught:", error.message, error.stack);
    if (info?.componentStack) console.error("[ErrorBoundary] Component stack:", info.componentStack);
    if (!this.retryTimer) {
      this.retryTimer = setTimeout(() => {
        this.retryTimer = null;
        this.setState({ hasError: false, errorMsg: "" });
      }, 2000);
    }
  }

  componentWillUnmount() {
    if (this.retryTimer) clearTimeout(this.retryTimer);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || null;
    }
    return this.props.children;
  }
}
