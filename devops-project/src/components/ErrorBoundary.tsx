import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle, RefreshCcw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-bg flex items-center justify-center p-6">
          <div className="bg-card border border-white/10 p-8 rounded-3xl max-w-md w-full text-center space-y-6 shadow-2xl">
            <div className="mx-auto w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center text-red-500">
              <AlertCircle size={32} />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-white">Упс! Что-то пошло не так</h2>
              <p className="text-white/60 text-sm">
                Произошла непредвиденная ошибка в приложении.
              </p>
            </div>
            <div className="p-4 bg-black/50 rounded-xl text-left overflow-auto max-h-32">
              <code className="text-xs text-red-400 font-mono">
                {this.state.error?.message || "Неизвестная ошибка"}
              </code>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-accent text-white py-3 rounded-2xl font-medium flex items-center justify-center gap-2 hover:bg-accent/90 transition-colors"
            >
              <RefreshCcw size={18} />
              Перезагрузить
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
