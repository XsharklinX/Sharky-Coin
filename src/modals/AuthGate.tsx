import { type FormEvent, useState } from 'react'
import { BrandMark } from '@/components/ui/BrandMark'
import { useAuth } from '@/store/auth'

type AuthMode = 'cloud' | 'local'
type AuthIntent = 'login' | 'register'

export function AuthGate() {
  const auth = useAuth()
  const [mode, setMode] = useState<AuthMode>(auth.cloudAvailable ? 'cloud' : 'local')
  const [intent, setIntent] = useState<AuthIntent>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  if (auth.recoveryMode) return <PasswordRecovery busy={busy} setBusy={setBusy} />

  const localNeedsRegistration = mode === 'local' && !auth.hasLocalAccount
  const isRegister = intent === 'register' || localNeedsRegistration

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode)
    setIntent(nextMode === 'local' && !auth.hasLocalAccount ? 'register' : 'login')
    setError('')
    setNotice('')
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setNotice('')
    if (isRegister && name.trim().length < 2) return setError('Escribe tu nombre.')
    if (!email.includes('@')) return setError('Escribe un correo válido.')
    if (password.length < 8) return setError('La contraseña debe tener al menos 8 caracteres.')
    setBusy(true)
    try {
      if (mode === 'cloud') {
        if (isRegister) {
          const result = await auth.registerCloud({ name, email, password })
          if (result === 'confirm-email') setNotice('Cuenta creada. Revisa tu correo y confirma el enlace antes de ingresar.')
        } else {
          await auth.loginCloud({ email, password })
        }
      } else if (isRegister) {
        await auth.registerLocal({ name, email, password })
      } else {
        await auth.loginLocal({ email, password })
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible continuar.')
    } finally {
      setBusy(false)
    }
  }

  const recover = async () => {
    setError('')
    setNotice('')
    if (!email.includes('@')) return setError('Escribe tu correo para recuperar el acceso.')
    setBusy(true)
    try {
      await auth.requestPasswordReset(email)
      setNotice('Enviamos el enlace de recuperación si existe una cuenta con ese correo.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible enviar el enlace.')
    } finally {
      setBusy(false)
    }
  }

  return <div className="auth-shell">
    <section className="auth-card">
      <span className="welcome-mark"><BrandMark size={58} /></span>
      <div>
        <h1><span>$</span>harky</h1>
        <p>{mode === 'cloud'
          ? 'Accede a tus finanzas con una cuenta sincronizable.'
          : 'Protege tus datos únicamente en este dispositivo.'}</p>
      </div>

      {auth.cloudAvailable && <div className="auth-mode-tabs">
        <button type="button" className={mode === 'cloud' ? 'on' : ''} onClick={() => switchMode('cloud')}>Cuenta cloud</button>
        <button type="button" className={mode === 'local' ? 'on' : ''} onClick={() => switchMode('local')}>Solo este equipo</button>
      </div>}

      <form onSubmit={submit}>
        {isRegister && <label>Nombre completo<input autoComplete="name" value={name} onChange={event => setName(event.target.value)} placeholder="Tu nombre" /></label>}
        <label>Correo electrónico<input autoComplete="email" type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="tu@correo.com" /></label>
        <label>Contraseña<input autoComplete={isRegister ? 'new-password' : 'current-password'} type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Mínimo 8 caracteres" /></label>
        {error && <p className="auth-error" role="alert">{error}</p>}
        {notice && <p className="auth-notice" role="status">{notice}</p>}
        <button className="btn-primary lg" disabled={busy}>{busy ? 'Procesando...' : isRegister ? 'Crear cuenta' : 'Ingresar'}</button>
      </form>

      {mode === 'cloud' && <div className="auth-links">
        <button type="button" onClick={() => setIntent(isRegister ? 'login' : 'register')}>
          {isRegister ? 'Ya tengo una cuenta' : 'Crear una cuenta cloud'}
        </button>
        {!isRegister && <button type="button" onClick={recover}>Recuperar contraseña</button>}
      </div>}

      <small>{mode === 'cloud'
        ? 'La cuenta cloud usa Supabase Auth. Debes confirmar tu correo antes de sincronizar.'
        : 'El modo local no sincroniza entre dispositivos. La contraseña se guarda como hash PBKDF2.'}</small>
    </section>
  </div>
}

function PasswordRecovery({ busy, setBusy }: { busy: boolean; setBusy: (value: boolean) => void }) {
  const updatePassword = useAuth(state => state.updatePassword)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    if (password.length < 8) return setError('La contraseña debe tener al menos 8 caracteres.')
    setBusy(true)
    try {
      await updatePassword(password)
      setNotice('Contraseña actualizada correctamente.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible actualizar la contraseña.')
    } finally {
      setBusy(false)
    }
  }

  return <div className="auth-shell">
    <section className="auth-card">
      <span className="welcome-mark"><BrandMark size={58} /></span>
      <div><h1><span>$</span>harky</h1><p>Define una nueva contraseña para tu cuenta cloud.</p></div>
      <form onSubmit={submit}>
        <label>Nueva contraseña<input autoComplete="new-password" type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Mínimo 8 caracteres" /></label>
        {error && <p className="auth-error" role="alert">{error}</p>}
        {notice && <p className="auth-notice" role="status">{notice}</p>}
        <button className="btn-primary lg" disabled={busy}>{busy ? 'Actualizando...' : 'Guardar nueva contraseña'}</button>
      </form>
    </section>
  </div>
}
