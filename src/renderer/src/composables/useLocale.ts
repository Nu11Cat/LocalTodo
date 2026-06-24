import { computed, ref } from 'vue'
import { en, type MessageKey } from '@renderer/locales/en'
import { zh } from '@renderer/locales/zh'

export type Locale = 'en' | 'zh'

export const availableLocales: { value: Locale; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'zh', label: '中文' }
]

const dictionaries: Record<Locale, Record<MessageKey, string>> = { en, zh }

const localeStorageKey = 'localtodo.locale'

function isLocale(value: unknown): value is Locale {
  return value === 'en' || value === 'zh'
}

// Persisted choice wins; otherwise fall back to the browser/system language so a
// Chinese-locale machine opens in Chinese on first run.
function detectInitialLocale(): Locale {
  try {
    const stored = localStorage.getItem(localeStorageKey)

    if (isLocale(stored)) {
      return stored
    }
  } catch {
    // Ignore localStorage read errors and fall back to system detection.
  }

  const navigatorLanguage = typeof navigator !== 'undefined' ? navigator.language : ''

  return navigatorLanguage.toLowerCase().startsWith('zh') ? 'zh' : 'en'
}

// Module-level singleton so every component shares one reactive locale.
const locale = ref<Locale>(detectInitialLocale())

function setLocale(next: Locale): void {
  locale.value = next

  try {
    localStorage.setItem(localeStorageKey, next)
  } catch {
    // Ignore localStorage persistence errors.
  }
}

type InterpolationParams = Record<string, string | number>

// Replace {token} placeholders with params. Choose a "singular|plural" form by the
// numeric `count` (or `n`) param: exactly 1 picks the left side, everything else
// the right. Missing params leave the placeholder so gaps are visible, not silent.
function interpolate(template: string, params?: InterpolationParams): string {
  let text = template

  if (params && text.includes('|')) {
    const [singular, plural] = text.split('|')
    const count = Number(params.count ?? params.n)
    text = count === 1 ? singular : plural
  }

  if (!params) {
    return text
  }

  return text.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in params ? String(params[key]) : match
  )
}

export function useLocale(): {
  locale: typeof locale
  setLocale: typeof setLocale
  t: (key: MessageKey, params?: InterpolationParams) => string
} {
  const t = (key: MessageKey, params?: InterpolationParams): string => {
    const dictionary = dictionaries[locale.value]
    // Fall back to English, then to the raw key, so a missing translation degrades
    // gracefully instead of rendering nothing.
    const template = dictionary[key] ?? en[key] ?? key

    return interpolate(template, params)
  }

  return { locale, setLocale, t }
}

// Standalone helper for non-component modules that need a one-off translation
// without holding a composable instance.
export function translate(key: MessageKey, params?: InterpolationParams): string {
  const template = dictionaries[locale.value][key] ?? en[key] ?? key

  return interpolate(template, params)
}

export const currentLocale = computed(() => locale.value)
