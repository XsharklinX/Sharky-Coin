import { useState } from 'react'
import { toast } from '@/components/ui/Toast'
import { useAuth } from '@/store/auth'
import { useCloudSync } from '@/data/cloudSync'
import { useT } from '@/i18n'
import { GoogleButton, SettingsRow, type SheetProps } from './shared'

export function SettingsAccount({ onOpen }: Pick<SheetProps, 'onOpen'>) {
  const auth = useAuth()
  const conflicts = useCloudSync(s => s.conflicts)
  const [googleBusy, setGoogleBusy] = useState(false)
  const t = useT()

  if (!auth.cloudAvailable) return null

  return (
    <div className="mset-section">
      <span className="mset-section-title">{t('accountSection')}</span>
      {auth.user?.mode === 'cloud' ? (
        <div className="mset-card">
          <div className="mset-google-profile">
            <div className="mset-google-avatar initials">{auth.user.name.slice(0, 1).toUpperCase()}</div>
            <div className="mset-google-info">
              <strong>{auth.user.name}</strong>
              <small>{auth.user.email}</small>
            </div>
          </div>
          {conflicts.length > 0 && (
            <SettingsRow icon="alert" iconColor="#f59e0b" label={t('syncConflictsLabel')}
              value={String(conflicts.length)}
              onClick={() => onOpen('syncConflicts')} />
          )}
          <SettingsRow icon="logout" iconColor="#ff6b8a" label={t('logout')} danger
            onClick={async () => {
              try {
                await auth.logout()
                toast(t('sessionClosed'), { icon: 'check' })
              } catch (error) {
                toast(error instanceof Error ? error.message : t('couldNotLogout'), { icon: 'alert' })
              }
            }} />
        </div>
      ) : (
        <div className="mset-card">
          <div className="mset-google-signin-wrap">
            <p className="mset-google-desc">{t('googleSyncDesc')}</p>
            <GoogleButton busy={googleBusy} onClick={async () => {
              setGoogleBusy(true)
              try {
                await auth.loginWithGoogle()
              } catch (error) {
                toast(error instanceof Error ? error.message : t('couldNotConnectGoogle'), { icon: 'alert' })
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
