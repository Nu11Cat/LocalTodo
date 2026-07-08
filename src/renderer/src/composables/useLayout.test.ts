import { beforeEach, describe, expect, it, vi } from 'vitest'

// useLayout is a module-level singleton that reads localStorage at import time,
// so each test seeds storage first and re-imports via vi.resetModules — the same
// pattern useLocale.test.ts / useTheme.test.ts use.

const storage = new Map<string, string>()

beforeEach(() => {
  storage.clear()
  vi.resetModules()
  vi.stubGlobal('localStorage', {
    getItem: vi.fn((key: string) => storage.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => storage.set(key, value)),
    removeItem: vi.fn((key: string) => storage.delete(key)),
    clear: vi.fn(() => storage.clear())
  })
})

async function loadUseLayout() {
  const module = await import('@renderer/composables/useLayout')
  return module
}

describe('useLayout', () => {
  it('starts with defaults when nothing is stored', async () => {
    const { useLayout, navWidthDefault, detailWidthDefault } = await loadUseLayout()
    const layout = useLayout()

    expect(layout.navWidth.value).toBe(navWidthDefault)
    expect(layout.detailWidth.value).toBe(detailWidthDefault)
    expect(layout.navCollapsed.value).toBe(false)
  })

  it('falls back to defaults when the persisted payload is invalid JSON', async () => {
    storage.set('localtodo.layout', 'this is not json')

    const { useLayout, navWidthDefault, detailWidthDefault } = await loadUseLayout()
    const layout = useLayout()

    expect(layout.navWidth.value).toBe(navWidthDefault)
    expect(layout.detailWidth.value).toBe(detailWidthDefault)
    expect(layout.navCollapsed.value).toBe(false)
  })

  it('clamps out-of-range persisted widths to the min/max bounds', async () => {
    storage.set(
      'localtodo.layout',
      JSON.stringify({ navWidth: 5, detailWidth: 5000, navCollapsed: true })
    )

    const {
      useLayout,
      navWidthMin,
      detailWidthMax
    } = await loadUseLayout()
    const layout = useLayout()

    expect(layout.navWidth.value).toBe(navWidthMin)
    expect(layout.detailWidth.value).toBe(detailWidthMax)
    expect(layout.navCollapsed.value).toBe(true)
  })

  it('persists mutations back to localStorage', async () => {
    const { useLayout } = await loadUseLayout()
    const layout = useLayout()

    layout.setNavWidth(260)
    layout.setDetailWidth(500)
    layout.toggleNavCollapsed()

    // watch() writes async on the next microtask; await one to let it flush.
    await Promise.resolve()

    const raw = storage.get('localtodo.layout')
    expect(raw).toBeDefined()

    const parsed = JSON.parse(raw as string)
    expect(parsed).toEqual({ navWidth: 260, detailWidth: 500, navCollapsed: true })
  })

  it('clamps setter arguments to the configured bounds', async () => {
    const {
      useLayout,
      navWidthMin,
      navWidthMax,
      detailWidthMin,
      detailWidthMax
    } = await loadUseLayout()
    const layout = useLayout()

    layout.setNavWidth(1)
    expect(layout.navWidth.value).toBe(navWidthMin)

    layout.setNavWidth(9999)
    expect(layout.navWidth.value).toBe(navWidthMax)

    layout.setDetailWidth(1)
    expect(layout.detailWidth.value).toBe(detailWidthMin)

    layout.setDetailWidth(9999)
    expect(layout.detailWidth.value).toBe(detailWidthMax)
  })

  it('round-trips a persisted snapshot back to identical values on reload', async () => {
    storage.set(
      'localtodo.layout',
      JSON.stringify({ navWidth: 300, detailWidth: 480, navCollapsed: true })
    )

    const { useLayout } = await loadUseLayout()
    const layout = useLayout()

    expect(layout.navWidth.value).toBe(300)
    expect(layout.detailWidth.value).toBe(480)
    expect(layout.navCollapsed.value).toBe(true)
  })
})
