import { beforeEach, describe, expect, it, vi } from 'vitest'

const storage = new Map<string, string>()

let documentAttributes: Map<string, string>
let mediaMatches: boolean
let mediaListeners: ((event: { matches: boolean }) => void)[]

beforeEach(() => {
  storage.clear()
  documentAttributes = new Map<string, string>()
  mediaMatches = false
  mediaListeners = []
  vi.resetModules()

  vi.stubGlobal('localStorage', {
    getItem: vi.fn((key: string) => storage.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => storage.set(key, value)),
    removeItem: vi.fn((key: string) => storage.delete(key)),
    clear: vi.fn(() => storage.clear())
  })

  // Minimal document stub so applyTheme can reflect the resolved theme onto <html>.
  // createElement is required because importing 'vue' pulls in runtime-dom, which
  // calls document.createElement at module-eval time when a document is present.
  vi.stubGlobal('document', {
    documentElement: {
      setAttribute: vi.fn((name: string, value: string) => documentAttributes.set(name, value)),
      getAttribute: vi.fn((name: string) => documentAttributes.get(name) ?? null)
    },
    createElement: vi.fn(() => ({ content: {}, innerHTML: '' }))
  })

  vi.stubGlobal('window', {
    matchMedia: vi.fn((query: string) => ({
      matches: query.includes('dark') ? mediaMatches : false,
      addEventListener: vi.fn((_event: string, listener: (event: { matches: boolean }) => void) => {
        mediaListeners.push(listener)
      }),
      removeEventListener: vi.fn()
    }))
  })
})

// useTheme is a module-level singleton that reads localStorage at import time, so
// each test imports it fresh (vi.resetModules above) after seeding storage/media.
async function loadUseTheme() {
  const module = await import('@renderer/composables/useTheme')
  return module.useTheme()
}

describe('useTheme', () => {
  it('defaults to system when nothing is stored', async () => {
    const { theme } = await loadUseTheme()

    expect(theme.value).toBe('system')
  })

  it('prefers a persisted theme over the default', async () => {
    storage.set('localtodo.theme', 'dark')

    const { theme } = await loadUseTheme()

    expect(theme.value).toBe('dark')
  })

  it('ignores an invalid persisted value and falls back to system', async () => {
    storage.set('localtodo.theme', 'neon')

    const { theme } = await loadUseTheme()

    expect(theme.value).toBe('system')
  })

  it('resolves system to dark when the OS prefers dark', async () => {
    mediaMatches = true

    const { theme, resolvedTheme } = await loadUseTheme()

    expect(theme.value).toBe('system')
    expect(resolvedTheme.value).toBe('dark')
  })

  it('resolves system to light when the OS prefers light', async () => {
    mediaMatches = false

    const { resolvedTheme } = await loadUseTheme()

    expect(resolvedTheme.value).toBe('light')
  })

  it('forced dark resolves to dark regardless of OS preference', async () => {
    mediaMatches = false
    storage.set('localtodo.theme', 'dark')

    const { resolvedTheme } = await loadUseTheme()

    expect(resolvedTheme.value).toBe('dark')
  })

  it('setTheme switches, persists, and reflects onto the document', async () => {
    const { theme, setTheme } = await loadUseTheme()

    setTheme('dark')

    expect(theme.value).toBe('dark')
    expect(storage.get('localtodo.theme')).toBe('dark')
    expect(documentAttributes.get('data-theme')).toBe('dark')
  })

  it('applyTheme reflects the current resolved theme onto the document', async () => {
    storage.set('localtodo.theme', 'light')

    const { applyTheme } = await loadUseTheme()
    applyTheme()

    expect(documentAttributes.get('data-theme')).toBe('light')
  })

  it('reacts to an OS color-scheme change while on system', async () => {
    mediaMatches = false

    const { resolvedTheme } = await loadUseTheme()
    expect(resolvedTheme.value).toBe('light')

    // Simulate the OS flipping to dark while the theme is still 'system'.
    mediaListeners.forEach((listener) => listener({ matches: true }))

    expect(resolvedTheme.value).toBe('dark')
    expect(documentAttributes.get('data-theme')).toBe('dark')
  })
})
