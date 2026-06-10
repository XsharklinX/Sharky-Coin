import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MobileTopBar } from '@/mobile/MobileTopBar'
import { monthKeys } from '@/data/helpers'
import type { Transaction } from '@/types'

vi.mock('@/components/ui/Icon', () => ({
  Icon: ({ name }: { name: string }) => <span>{name}</span>
}))
vi.mock('@/i18n', () => ({
  useT: () => (key: string) => key
}))

describe('MobileTopBar date navigation', () => {
  it('should enable and disable prev/next month buttons correctly', () => {
    const keys = ['2026-03', '2026-04', '2026-05', '2026-06']
    
    // Step 0: at 2026-06 (index 3)
    let mkey = '2026-06'
    let mIdx = keys.indexOf(mkey)
    
    const onPrev = vi.fn()
    const onNext = vi.fn()
    
    const { rerender } = render(
      <MobileTopBar
        route="home"
        mkey={mkey}
        canGoBack={mIdx > 0}
        canGoForward={mIdx >= 0 && mIdx < keys.length - 1}
        onPrevMonth={onPrev}
        onNextMonth={onNext}
        onSettings={vi.fn()}
        onCurrency={vi.fn()}
        onSearch={vi.fn()}
      />
    )
    
    const prevBtn = screen.getByRole('button', { name: /Mes anterior/i })
    const nextBtn = screen.getByRole('button', { name: /Mes siguiente/i })
    
    expect(prevBtn).not.toBeDisabled()
    expect(nextBtn).toBeDisabled()
    
    // Step 1: navigate to 2026-05 (index 2)
    mkey = '2026-05'
    mIdx = keys.indexOf(mkey)
    rerender(
      <MobileTopBar
        route="home"
        mkey={mkey}
        canGoBack={mIdx > 0}
        canGoForward={mIdx >= 0 && mIdx < keys.length - 1}
        onPrevMonth={onPrev}
        onNextMonth={onNext}
        onSettings={vi.fn()}
        onCurrency={vi.fn()}
        onSearch={vi.fn()}
      />
    )
    expect(prevBtn).not.toBeDisabled()
    expect(nextBtn).not.toBeDisabled()

    // Step 2: navigate to 2026-03 (index 0)
    mkey = '2026-03'
    mIdx = keys.indexOf(mkey)
    rerender(
      <MobileTopBar
        route="home"
        mkey={mkey}
        canGoBack={mIdx > 0}
        canGoForward={mIdx >= 0 && mIdx < keys.length - 1}
        onPrevMonth={onPrev}
        onNextMonth={onNext}
        onSettings={vi.fn()}
        onCurrency={vi.fn()}
        onSearch={vi.fn()}
      />
    )
    expect(prevBtn).toBeDisabled()
    expect(nextBtn).not.toBeDisabled()
  })

  it('should generate all months in between oldest tx and current month', () => {
    const txns: Transaction[] = [
      { id: '1', type: 'expense', amount: 10, date: '2026-03-01', note: 'a', categoryId: 'cat', accountId: 'acc' },
      { id: '2', type: 'expense', amount: 10, date: '2026-06-01', note: 'a', categoryId: 'cat', accountId: 'acc' },
    ]
    // Mock currentMonthKey to return '2026-06'
    const keys = monthKeys(txns)
    expect(keys).toContain('2026-03')
    expect(keys).toContain('2026-04')
    expect(keys).toContain('2026-05')
    expect(keys).toContain('2026-06')
  })
})
