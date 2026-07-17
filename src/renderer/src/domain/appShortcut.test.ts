import { describe, expect, it } from 'vitest'
import { resolveAppShortcut, type AppShortcutEvent } from './appShortcut'

function keyboardEvent(overrides: Partial<AppShortcutEvent> = {}): AppShortcutEvent {
  return {
    key: 'n',
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    repeat: false,
    isComposing: false,
    ...overrides
  }
}

describe('resolveAppShortcut', () => {
  it('maps Ctrl+N, Ctrl+F, and Ctrl+K on non-Mac platforms', () => {
    expect(resolveAppShortcut(keyboardEvent({ key: 'n', ctrlKey: true }), false)).toBe(
      'new-task'
    )
    expect(resolveAppShortcut(keyboardEvent({ key: 'F', ctrlKey: true }), false)).toBe('search')
    expect(resolveAppShortcut(keyboardEvent({ key: 'k', ctrlKey: true }), false)).toBe(
      'command-palette'
    )
  })

  it('maps Command+N, Command+F, and Command+K on Mac platforms', () => {
    expect(resolveAppShortcut(keyboardEvent({ key: 'N', metaKey: true }), true)).toBe('new-task')
    expect(resolveAppShortcut(keyboardEvent({ key: 'f', metaKey: true }), true)).toBe('search')
    expect(resolveAppShortcut(keyboardEvent({ key: 'K', metaKey: true }), true)).toBe(
      'command-palette'
    )
  })

  it('does not treat the non-platform modifier as primary', () => {
    expect(resolveAppShortcut(keyboardEvent({ ctrlKey: true }), true)).toBeNull()
    expect(resolveAppShortcut(keyboardEvent({ metaKey: true }), false)).toBeNull()
  })

  it('ignores extra modifiers, key repeats, and IME composition', () => {
    expect(resolveAppShortcut(keyboardEvent({ ctrlKey: true, shiftKey: true }), false)).toBeNull()
    expect(resolveAppShortcut(keyboardEvent({ ctrlKey: true, altKey: true }), false)).toBeNull()
    expect(resolveAppShortcut(keyboardEvent({ ctrlKey: true, metaKey: true }), false)).toBeNull()
    expect(resolveAppShortcut(keyboardEvent({ ctrlKey: true, repeat: true }), false)).toBeNull()
    expect(resolveAppShortcut(keyboardEvent({ ctrlKey: true, isComposing: true }), false)).toBeNull()
  })

  it('ignores unrelated primary-modifier shortcuts', () => {
    expect(resolveAppShortcut(keyboardEvent({ key: 'p', ctrlKey: true }), false)).toBeNull()
  })
})
