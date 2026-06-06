import { useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { toast } from '@/components/ui/Toast'
import { createBackup } from '@/data/backup'
import { useFinance } from '@/store/finance'
import { useSettings } from '@/store/settings'
import type { ViewId } from '@/types'

function downloadJson(data: object, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function MobileProfile({
  userName,
  onSettings,
  goto,
}: {
  userName?: string
  onSettings: () => void
  goto: (view: ViewId) => void
}) {
  const { displayName, setDisplayName } = useSettings()
  const financeState = useFinance()
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState(displayName || userName || '')
  const effectiveName = displayName || userName || ''

  const saveName = () => {
    const trimmed = nameInput.trim()
    setDisplayName(trimmed)
    setEditingName(false)
    if (trimmed) toast(`Nombre actualizado a "${trimmed}"`, { icon: 'check', type: 'ok' })
  }

  const handleBackup = () => {
    try {
      const backup = createBackup(financeState)
      const date = new Date().toISOString().slice(0, 10)
      downloadJson(backup, `sharky-backup-${date}.json`)
      toast('Backup descargado', { icon: 'download', type: 'ok' })
    } catch {
      toast('No se pudo generar el backup.', { icon: 'alert' })
    }
  }

  const initial = effectiveName ? effectiveName.slice(0, 1).toUpperCase() : '$'

  return (
    <div className="mobile-profile">
      {/* Tarjeta de perfil */}
      <section className="mobile-profile-card">
        <div className="mobile-profile-avatar">{initial}</div>
        {editingName ? (
          <div className="mobile-name-editor">
            <input
              autoFocus
              type="text"
              value={nameInput}
              placeholder="Tu nombre"
              autoCapitalize="words"
              enterKeyHint="done"
              onChange={e => setNameInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveName() }}
            />
            <div className="mobile-name-editor-actions">
              <button onClick={() => setEditingName(false)}>Cancelar</button>
              <button className="primary" onClick={saveName}>Guardar</button>
            </div>
          </div>
        ) : (
          <>
            <h2>{effectiveName || 'Mi cuenta'}</h2>
            <button className="mobile-profile-edit-btn" onClick={() => { setNameInput(effectiveName); setEditingName(true) }}>
              <Icon name="edit" size={14} />
              {effectiveName ? 'Editar nombre' : 'Agregar nombre'}
            </button>
          </>
        )}
      </section>

      {/* Herramientas */}
      <section className="mobile-section-card mobile-internal-sections">
        <header>
          <div>
            <h2>Herramientas</h2>
            <p>Vistas y navegación</p>
          </div>
        </header>
        <button onClick={onSettings}><Icon name="settings" size={20} />Configuración</button>
        <button onClick={() => goto('annual')}><Icon name="shark" size={20} />Reporte anual</button>
        <button onClick={() => goto('calendar')}><Icon name="calendar" size={20} />Calendario</button>
      </section>

      {/* Datos */}
      <section className="mobile-section-card mobile-internal-sections">
        <header>
          <div>
            <h2>Datos</h2>
            <p>Backup y exportación</p>
          </div>
        </header>
        <button onClick={handleBackup}><Icon name="download" size={20} />Descargar backup JSON</button>
        <button onClick={onSettings}><Icon name="upload" size={20} />Restaurar backup</button>
        <button onClick={onSettings}><Icon name="fileJson" size={20} />Importar CSV bancario</button>
      </section>
    </div>
  )
}
