import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Icon } from './Icon'
import { APP_VERSION } from '@/data/release'
import { captureErrorReport } from '@/data/telemetry'

interface Props {
  children: ReactNode
}

interface State {
  failed: boolean
  diagnostic: string | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false, diagnostic: null }

  static getDerivedStateFromError(): State {
    return { failed: true, diagnostic: null }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const diagnostic = makeDiagnostic('APP')
    this.setState({ diagnostic })
    captureErrorReport({
      scope: 'app',
      diagnostic,
      error,
      componentStack: info.componentStack ?? undefined,
      appVersion: APP_VERSION,
    })
    console.error('Unhandled application error', error, info)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return <main className="fatal-error">
      <span className="empty-ico"><Icon name="shark" size={30} /></span>
      <h1>No pudimos cargar $harky</h1>
      <p>Ocurrió un error inesperado. Recarga la aplicación para volver a intentarlo.</p>
      {this.state.diagnostic && <small className="diagnostic-code">Diagnóstico: {this.state.diagnostic}</small>}
      <button className="btn-primary lg" onClick={() => window.location.reload()}>Recargar</button>
    </main>
  }
}

export class ViewErrorBoundary extends Component<Props & { resetKey: string }, State> {
  state: State = { failed: false, diagnostic: null }

  static getDerivedStateFromError(): State {
    return { failed: true, diagnostic: null }
  }

  componentDidUpdate(previous: Props & { resetKey: string }) {
    if (this.state.failed && previous.resetKey !== this.props.resetKey) {
      this.setState({ failed: false, diagnostic: null })
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const diagnostic = makeDiagnostic('VIEW')
    this.setState({ diagnostic })
    captureErrorReport({
      scope: 'view',
      diagnostic,
      error,
      componentStack: info.componentStack ?? undefined,
      appVersion: APP_VERSION,
    })
    console.error('Unhandled view error', error, info)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return <section className="card view-error">
      <Icon name="alert" size={20} />
      <div>
        <h2>No pudimos cargar esta sección</h2>
        <p>El resto de la app sigue disponible. Puedes reintentar esta sección o cambiar de apartado.</p>
        {this.state.diagnostic && <small className="diagnostic-code">Diagnóstico: {this.state.diagnostic}</small>}
        <button className="btn-ghost" onClick={() => this.setState({ failed: false, diagnostic: null })}>Reintentar sección</button>
      </div>
    </section>
  }
}

function makeDiagnostic(scope: string): string {
  return `${scope}-${Date.now().toString(36).toUpperCase()}`
}
