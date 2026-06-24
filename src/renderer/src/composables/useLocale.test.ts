import { beforeEach, describe, expect, it, vi } from 'vitest'
import { en } from '@renderer/locales/en'
import { zh } from '@renderer/locales/zh'

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
  vi.stubGlobal('navigator', { language: 'en-US' })
})

// useLocale is a module-level singleton that reads localStorage at import time, so
// each test imports it fresh (vi.resetModules above) after seeding storage/navigator.
async function loadUseLocale() {
  const module = await import('@renderer/composables/useLocale')
  return module.useLocale()
}

describe('locale dictionaries', () => {
  it('zh provides exactly the same keys as en', () => {
    const enKeys = Object.keys(en).sort()
    const zhKeys = Object.keys(zh).sort()

    expect(zhKeys).toEqual(enKeys)
  })

  it('has no empty translations', () => {
    for (const [key, value] of Object.entries(zh)) {
      expect(value, `zh.${key} should not be empty`).not.toBe('')
    }
  })

  it('each zh value carries the same {placeholder} tokens as en', () => {
    const tokensOf = (value: string): string[] =>
      (value.match(/\{(\w+)\}/g) ?? []).sort()

    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(tokensOf(zh[key]), `placeholder mismatch in "${key}"`).toEqual(tokensOf(en[key]))
    }
  })

  it('each zh value has a plural "|" form exactly when en does', () => {
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(zh[key].includes('|'), `plural-form mismatch in "${key}"`).toBe(en[key].includes('|'))
    }
  })

  it('only count.* keys use the "|" plural separator', () => {
    // interpolate() treats any "|" in a value (with params) as a plural split, so
    // restrict the separator to the dedicated count.* fragments to avoid surprises.
    for (const [key, value] of Object.entries(en)) {
      if (value.includes('|')) {
        expect(key.startsWith('count.'), `unexpected "|" in "${key}"`).toBe(true)
      }
    }
  })
})

describe('useLocale', () => {
  it('defaults to English when nothing is stored and system is en', async () => {
    const { locale, t } = await loadUseLocale()

    expect(locale.value).toBe('en')
    expect(t('form.add')).toBe('Add')
  })

  it('detects Chinese from the system language on first run', async () => {
    vi.stubGlobal('navigator', { language: 'zh-CN' })

    const { locale } = await loadUseLocale()

    expect(locale.value).toBe('zh')
  })

  it('prefers a persisted locale over system detection', async () => {
    storage.set('localtodo.locale', 'zh')
    vi.stubGlobal('navigator', { language: 'en-US' })

    const { locale, t } = await loadUseLocale()

    expect(locale.value).toBe('zh')
    expect(t('form.add')).toBe('添加')
  })

  it('setLocale switches translations and persists the choice', async () => {
    const { t, setLocale } = await loadUseLocale()

    expect(t('form.add')).toBe('Add')

    setLocale('zh')

    expect(t('form.add')).toBe('添加')
    expect(storage.get('localtodo.locale')).toBe('zh')
  })

  it('interpolates named placeholders', async () => {
    const { t } = await loadUseLocale()

    expect(t('panel.shown', { shown: 3, total: 10 })).toBe('3 of 10 shown')
  })

  it('leaves unknown placeholders untouched', async () => {
    const { t } = await loadUseLocale()

    expect(t('msg.savedTo', { path: '/tmp/x' })).toBe('Saved to /tmp/x.{excluded}')
  })

  it('chooses the singular plural form on count === 1', async () => {
    const { t } = await loadUseLocale()

    expect(t('count.task', { n: 1 })).toBe('1 task')
    expect(t('count.task', { n: 2 })).toBe('2 tasks')
    expect(t('count.task', { n: 0 })).toBe('0 tasks')
  })

  it('falls back to the raw key for a missing translation', async () => {
    const { t } = await loadUseLocale()

    // Cast to bypass the typed key set and simulate a lookup miss.
    expect(t('does.not.exist' as never)).toBe('does.not.exist')
  })
})
