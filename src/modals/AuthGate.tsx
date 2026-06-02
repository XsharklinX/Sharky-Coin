import { type FormEvent, useState } from 'react'
import { BrandMark } from '@/components/ui/BrandMark'
import { useAuth } from '@/store/auth'

export function AuthGate() {
  const { hasAccount, login, register } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    if (!hasAccount && name.trim().length < 2) return setError('Escribe tu nombre.')
    if (!email.includes('@')) return setError('Escribe un correo válido.')
    if (password.length < 8) return setError('La contraseña debe tener al menos 8 caracteres.')
    setBusy(true)
    try {
      await (hasAccount ? login({ email, password }) : register({ name, email, password }))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible continuar.')
    } finally {
      setBusy(false)
    }
  }

  return <div className="auth-shell">
    <section className="auth-card">
      <span className="welcome-mark"><BrandMark size={58} /></span>
      <div><h1><span>$</span>harky</h1><p>{hasAccount ? 'Inicia sesión para acceder a tus finanzas.' : 'Crea el usuario propietario de este dispositivo.'}</p></div>
      <form onSubmit={submit}>
        {!hasAccount && <label>Nombre completo<input autoComplete="name" value={name} onChange={e => setName(e.target.value)} placeholder="Tu nombre" /></label>}
        <label>Correo electrónico<input autoComplete="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@correo.com" /></label>
        <label>Contraseña<input autoComplete={hasAccount ? 'current-password' : 'new-password'} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 8 caracteres" /></label>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button className="btn-primary lg" disabled={busy}>{busy ? 'Procesando...' : hasAccount ? 'Ingresar' : 'Crear usuario'}</button>
      </form>
      <small>Las credenciales se guardan localmente con hash PBKDF2. Esta versión aún no sincroniza entre dispositivos.</small>
    </section>
  </div>
}
