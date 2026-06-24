import { computed, ref } from 'vue'

// User's theme preference. 'system' follows the OS via prefers-color-scheme;
// 'light'/'dark' force a fixed theme regardless of the OS.
export type Theme = 'light' | 'dark' | 'system'

// The concrete theme actually applied to the DOM (system resolves to one of these).
export type ResolvedTheme = 'light' | 'dark'

export const availableThemes: { value: Theme; labelKey: 'theme.light' | 'theme.dark' | 'theme.system' }[] =
  [
    { value: 'light', labelKey: 'theme.light' },
    { value: 'dark', labelKey: 'theme.dark' },
    { value: 'system', labelKey: 'theme.system' }
  ]

const themeStorageKey = 'localtodo.theme'

function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark' || value === 'system'
}

// Persisted choice wins; otherwise default to 'system' so first run follows the OS.
function detectInitialTheme(): Theme {
  try {
    const stored = localStorage.getItem(themeStorageKey)

    if (isTheme(stored)) {
      return stored
    }
  } catch {
    // Ignore localStorage read errors and fall back to system.
  }

  return 'system'
}

function prefersDark(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  )
}

// Reactive mirror of the OS color-scheme preference, so resolvedTheme recomputes
// when the OS flips while the selected theme is 'system'.
const systemDark = ref<boolean>(prefersDark())

function resolveTheme(value: Theme): ResolvedTheme {
  if (value === 'system') {
    return systemDark.value ? 'dark' : 'light'
  }

  return value
}

// Reflect the resolved theme onto the document so [data-theme="dark"] overrides
// take effect. Guarded for the node test environment where document is absent.
function applyTheme(value: Theme): void {
  if (typeof document === 'undefined') {
    return
  }

  document.documentElement.setAttribute('data-theme', resolveTheme(value))
}

// Module-level singleton so every component shares one reactive theme.
const theme = ref<Theme>(detectInitialTheme())

// Keep the DOM in sync when 'system' is active and the OS preference changes.
if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
  const media = window.matchMedia('(prefers-color-scheme: dark)')

  media.addEventListener('change', (event) => {
    systemDark.value = event.matches

    if (theme.value === 'system') {
      applyTheme('system')
    }
  })
}

function setTheme(next: Theme): void {
  theme.value = next
  applyTheme(next)

  try {
    localStorage.setItem(themeStorageKey, next)
  } catch {
    // Ignore localStorage persistence errors.
  }
}

const resolvedTheme = computed(() => resolveTheme(theme.value))

export function useTheme(): {
  theme: typeof theme
  resolvedTheme: typeof resolvedTheme
  setTheme: typeof setTheme
  applyTheme: () => void
} {
  return { theme, resolvedTheme, setTheme, applyTheme: () => applyTheme(theme.value) }
}
