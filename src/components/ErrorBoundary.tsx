import { Component, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Table crashed:', error, errorInfo)
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="glass-panel p-8 text-center border border-red-300 dark:border-red-500/20">
          <AlertTriangle className="w-8 h-8 text-red-500 dark:text-red-400 mx-auto mb-3" />
          <h3 className="text-red-600 dark:text-red-400 font-bold mb-2">Something went wrong</h3>
          <p className="text-gray-500 text-sm mb-4">
            {this.state.error?.message || 'The option chain table encountered an error.'}
          </p>
          <button
            onClick={this.handleReload}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 border border-red-300 dark:border-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-500/20 transition-colors text-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Reload Page
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
