export type AppShortcutAction = 'new-task' | 'search'

export interface AppShortcutEvent {
  key: string
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
  shiftKey: boolean
  repeat: boolean
  isComposing: boolean
}

export function resolveAppShortcut(
  event: AppShortcutEvent,
  isMacPlatform: boolean
): AppShortcutAction | null {
  if (event.repeat || event.isComposing || event.altKey || event.shiftKey) {
    return null
  }

  const hasPrimaryModifier = isMacPlatform
    ? event.metaKey && !event.ctrlKey
    : event.ctrlKey && !event.metaKey

  if (!hasPrimaryModifier) {
    return null
  }

  const key = event.key.toLocaleLowerCase()

  if (key === 'n') {
    return 'new-task'
  }

  if (key === 'f') {
    return 'search'
  }

  return null
}
