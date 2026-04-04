import { Component, type ErrorInfo, type ReactNode } from "react";
import { warnLog } from "../lib/logger";

type AppErrorBoundaryProps = {
  children: ReactNode;
};

type AppErrorBoundaryState = {
  hasError: boolean;
  message: string;
};

export class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = {
    hasError: false,
    message: "",
  };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return {
      hasError: true,
      message:
        error.message ||
        "The preview workspace hit an unexpected problem and was safely paused.",
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    warnLog("ui", "AppErrorBoundary caught a render error", {
      error: error.message,
      componentStack: errorInfo.componentStack,
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      message: "",
    });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="app-shell">
        <div className="error-boundary-card">
          <p className="eyebrow">Workspace paused safely</p>
          <h1>Lithophane Studio</h1>
          <p className="subtitle">
            A screen update failed, but the app stayed open so you do not lose
            the whole window.
          </p>
          <p className="callout warning">{this.state.message}</p>
          <div className="button-row">
            <button
              className="primary-button"
              onClick={this.handleReset}
              type="button"
            >
              Try to recover the workspace
            </button>
          </div>
        </div>
      </div>
    );
  }
}
