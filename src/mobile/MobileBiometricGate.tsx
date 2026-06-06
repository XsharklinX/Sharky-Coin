import { useEffect, useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { authenticateBiometric, checkBiometric } from '@/lib/biometric'

type GateState = 'checking' | 'prompting' | 'error' | 'done'

export function MobileBiometricGate({ onUnlocked }: { onUnlocked: () => void }) {
  const [state, setState]   = useState<GateState>('checking')
  const [error, setError]   = useState('')
  const [icon,  setIcon]    = useState<'fingerprint' | 'faceId'>('fingerprint')

  const tryAuth = async () => {
    setState('prompting')
    setError('')
    try {
      await authenticateBiometric('Unlock $harky')
      setState('done')
      onUnlocked()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed')
      setState('error')
    }
  }

  useEffect(() => {
    checkBiometric().then(status => {
      if (!status.available) {
        onUnlocked()
        return
      }
      setIcon(status.biometryType === 'faceId' ? 'faceId' : 'fingerprint')
      void tryAuth()
    })
  }, [])

  if (state === 'checking' || state === 'done') return null

  return (
    <div className="mbio-root">
      <div className="mbio-card">
        <div className="mbio-icon">
          <Icon name={icon === 'faceId' ? 'user' : 'lock'} size={48} />
        </div>
        <h2>$harky</h2>
        <p>{state === 'error' ? error : 'Verifying identity…'}</p>
        {state === 'error' && (
          <button className="mbio-retry" onClick={tryAuth}>
            <Icon name="refresh" size={16} /> Try again
          </button>
        )}
      </div>
    </div>
  )
}
