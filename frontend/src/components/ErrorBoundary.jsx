import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    this.setState({
      error,
      errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-red-50 flex items-center justify-center p-8">
          <div className="bg-white rounded-lg shadow-xl p-8 max-w-2xl">
            <h1 className="text-2xl font-bold text-red-600 mb-4">
              ⚠️ Something went wrong
            </h1>
            <div className="bg-gray-100 p-4 rounded font-mono text-sm overflow-auto">
              <p className="text-red-600 font-bold mb-2">Error:</p>
              <pre>{this.state.error && this.state.error.toString()}</pre>

              {this.state.errorInfo && (
                <>
                  <p className="text-red-600 font-bold mt-4 mb-2">Stack Trace:</p>
                  <pre className="text-xs">{this.state.errorInfo.componentStack}</pre>
                </>
              )}
            </div>
            <button
              onClick={() => window.location.reload()}
              className="mt-6 bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
