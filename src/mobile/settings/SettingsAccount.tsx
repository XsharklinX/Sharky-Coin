import { useState } from 'react'
import { toast } from '@/components/ui/Toast'
import { useAuth } from '@/store/auth'
import { GoogleButton, SettingsRow } from './shared'

export function SettingsAccount() {
  const auth = useAuth()
  const [googleBusy, setGoogleBusy] = useState(false)

  if (!auth.cloudAvailable) return null

  return (
    <div className="mset-section">
      <span className="mset-section-title">Cuenta</span>
      {auth.user?.mode === 'cloud' ? (
        <div className="mset-card">
          <div className="mset-google-profile">
            <div className="mset-google-avatar initials">{auth.user.name.slice(0, 1).toUpperCase()}</div>
            <div className="mset-google-info">
              <strong>{auth.user.name}</strong>
              <small>{auth.user.email}</small>
            </div>
          </div>
          <SettingsRow icon="logout" iconColor="#ff6b8a" label="Cerrar sesión" danger
            onClick={async () => {
              try {
                await auth.logout()
                toast('Sesión cerrada', { icon: 'check' })
              } catch (error) {
                toast(error instanceof Error ? error.message : 'No se pudo cerrar la sesión.', { icon: 'alert' })
              }
            }} />
        </div>
      ) : (
        <div className="mset-card">
          <div className="mset-google-signin-wrap">
            <p className="mset-google-desc">Conecta una cuenta de Google para sincronizar tus datos en todos tus dispositivos.</p>
            <GoogleButton busy={googleBusy} onClick={async () => {
              setGoogleBusy(true)
              try {
                await auth.loginWithGoogle()
              } catch (error) {
                toast(error instanceof Error ? error.message : 'No se pudo conectar con Google.', { icon: 'alert' })
              } finally {
                setGoogleBusy(false)
              }
            }} />
          </div>
        </div>
      )}
    </div>
  )
}
