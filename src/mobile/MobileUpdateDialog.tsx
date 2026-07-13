import { BrandMark } from '@/components/ui/BrandMark'
import { Icon } from '@/components/ui/Icon'
import { useT } from '@/i18n'
import { isTauri } from '@/hooks/useTauri'
import type { AvailableUpdate } from '@/hooks/useUpdateCheck'
import { useMobileBackDismiss } from './useMobileBackDismiss'
import { useDialogA11y } from './useDialogA11y'
import { SheetPortal } from './SheetPortal'

export function MobileUpdateDialog({ update, onDismiss }: { update: AvailableUpdate; onDismiss: () => void }) {
  const t = useT()

  useMobileBackDismiss(true, onDismiss)
  const dialogRef = useDialogA11y<HTMLDivElement>(onDismiss, true)

  const openStore = async () => {
    if (isTauri()) {
      const { openUrl } = await import('@tauri-apps/plugin-opener')
      await openUrl(update.url)
    } else {
      window.open(update.url, '_blank', 'noopener')
    }
    onDismiss()
  }

  return (
    <SheetPortal>
    <div className="mobile-detail-sheet centered" role="dialog" aria-modal="true" aria-label={t('updateAvailableTitle')} onClick={onDismiss}>
      <section ref={dialogRef} className="mup-card" onClick={e => e.stopPropagation()}>
        <button className="mup-close" aria-label={t('close')} onClick={onDismiss}>
          <Icon name="close" size={16} />
        </button>
        <BrandMark size={56} className="mup-brand" />
        <h2>{t('updateAvailableTitle')}</h2>
        <p>{t('updateAvailableDesc').replace('{version}', update.version)}</p>
        <button className="mup-cta" onClick={() => void openStore()}>
          <Icon name="download" size={16} />
          {t('updateNow')}
        </button>
        <button className="mup-later" onClick={onDismiss}>{t('remindLater')}</button>
      </section>
    </div>
    </SheetPortal>
  )
}
