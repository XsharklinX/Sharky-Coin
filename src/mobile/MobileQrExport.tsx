import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { createBackup } from '@/data/backup'
import { buildTransferFrames } from '@/data/qrTransfer'
import { useFinance } from '@/store/finance'
import { useT } from '@/i18n'
import { useMobileBackDismiss } from './useMobileBackDismiss'
import { useDialogA11y } from './useDialogA11y'
import { SheetPortal } from './SheetPortal'

const FRAME_INTERVAL_MS = [700, 400, 220] as const
const CHUNK_SIZE = 120

export function MobileQrExport({ onClose }: { onClose: () => void }) {
  const t = useT()
  const finance = useFinance()
  const [qrImg, setQrImg] = useState<string | null>(null)
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [speed, setSpeed] = useState<0 | 1 | 2>(1)

  useMobileBackDismiss(true, onClose)
  const dialogRef = useDialogA11y<HTMLDivElement>(onClose)

  const frames = useMemo(() => {
    const payload = JSON.stringify(createBackup(finance))
    const transferId = Math.random().toString(36).slice(2, 8)
    return buildTransferFrames(payload, CHUNK_SIZE, transferId)
  }, [finance])

  useEffect(() => {
    if (!playing || frames.length <= 1) return
    const id = setInterval(() => setIndex(i => (i + 1) % frames.length), FRAME_INTERVAL_MS[speed])
    return () => clearInterval(id)
  }, [playing, speed, frames.length])

  const generation = useRef(0)
  useEffect(() => {
    let cancelled = false
    const myGen = ++generation.current
    void (async () => {
      const QRCode = (await import('qrcode')).default
      const dataUrl = await QRCode.toDataURL(frames[index], { errorCorrectionLevel: 'L', margin: 1, width: 288 })
      if (!cancelled && generation.current === myGen) setQrImg(dataUrl)
    })()
    return () => { cancelled = true }
  }, [frames, index])

  return (
    <SheetPortal>
      <div ref={dialogRef} className="mobile-detail-sheet" role="dialog" aria-modal="true" aria-label={t('qrExportTitle')} onClick={onClose}>
        <section className="mqr-sheet" onClick={e => e.stopPropagation()}>
          <header>
            <span>{t('qrExportTitle')}</span>
            <button aria-label={t('close')} onClick={onClose}><Icon name="close" size={18} /></button>
          </header>

          <div className="mqr-body">
            <p className="mqr-hint">{t('qrExportHint')}</p>

            <div className="mqr-frame">
              {qrImg
                ? <img src={qrImg} alt={t('qrExportPartLabel').replace('{current}', String(index + 1)).replace('{total}', String(frames.length))} />
                : <div className="mqr-frame-loading" />}
            </div>

            <div className="mqr-progress-track">
              <div className="mqr-progress-fill" style={{ width: `${((index + 1) / frames.length) * 100}%` }} />
            </div>
            <span className="mqr-part-label">{t('qrExportPartLabel').replace('{current}', String(index + 1)).replace('{total}', String(frames.length))}</span>

            <div className="mqr-controls">
              <button className="mqr-play-btn" onClick={() => setPlaying(p => !p)}>
                <Icon name={playing ? 'eyeOff' : 'play'} size={18} />
                {playing ? t('qrExportPause') : t('qrExportPlay')}
              </button>
              <div className="mqr-speed-row">
                <span>{t('qrExportSpeedLabel')}</span>
                {([0, 1, 2] as const).map(level => (
                  <button
                    key={level}
                    className={`mqr-speed-chip${speed === level ? ' on' : ''}`}
                    onClick={() => setSpeed(level)}
                  >
                    {level === 0 ? '1×' : level === 1 ? '2×' : '3×'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </SheetPortal>
  )
}
