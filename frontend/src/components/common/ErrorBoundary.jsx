/**
 * ErrorBoundary - Catches React errors and displays fallback UI
 */

import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
    this.setState({ errorInfo });
    
    // Optional: Send to error tracking service
    // sendToErrorTracking(error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[400px] flex items-center justify-center p-8">
          <div className="max-w-lg w-full bg-dark-800 border border-red-500/30 rounded-xl p-6 text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <AlertTriangle className="text-red-500" size={32} />
              <h2 className="text-xl font-bold text-white">Something went wrong</h2>
            </div>
            
            <p className="text-gray-400 mb-4">
              An unexpected error occurred. This has been logged for review.
            </p>
            
            {this.state.error && (
              <div className="bg-dark-900 rounded-lg p-3 mb-4 text-left overflow-auto max-h-32">
                <code className="text-red-400 text-sm break-all">
                  {this.state.error.message}
                </code>
              </div>
            )}
            
            <div className="flex gap-3 justify-center flex-wrap">
              <button
                onClick={this.handleReset}
                className="flex items-center gap-2 px-4 py-2 bg-accent text-black rounded-lg font-medium hover:bg-accent/80 transition-colors"
              >
                <RefreshCw size={16} /> Try Again
              </button>
              <button
                onClick={this.handleReload}
                className="flex items-center gap-2 px-4 py-2 bg-dark-700 text-white rounded-lg hover:bg-dark-600 transition-colors"
              >
                Reload Page
              </button>
              <button
                onClick={this.handleGoHome}
                className="flex items-center gap-2 px-4 py-2 bg-dark-700 text-white rounded-lg hover:bg-dark-600 transition-colors"
              >
                <Home size={16} /> Go Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
