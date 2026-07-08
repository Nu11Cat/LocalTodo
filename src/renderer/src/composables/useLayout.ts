import { ref, watch } from 'vue'

// Persisted three-column workspace preferences. The renderer reads this at
// import time to hydrate the nav/detail column widths and the collapsed state,
// so a reload restores the exact layout the user last dragged into place.
// Mirrors the useLocale / useTheme singleton + localStorage + defensive parse
// pattern; nothing here talks to Node/fs/IPC.

const layoutStorageKey = 'localtodo.layout'

// Column-width bounds. clamp() below folds user-supplied numbers back into these
// so a bad localStorage payload or a runaway pointer drag cannot leave a column
// off-screen. Defaults land in the middle-ish of a comfortable IDE workspace.
export const navWidthDefault = 240
export const navWidthMin = 180
export const navWidthMax = 420
export const navWidthCollapsed = 56

export const detailWidthDefault = 420
export const detailWidthMin = 320
export const detailWidthMax = 720

interface LayoutSnapshot {
  navWidth: number
  detailWidth: number
  navCollapsed: boolean
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min
  }

  return Math.min(Math.max(value, min), max)
}

function defaultSnapshot(): LayoutSnapshot {
  return {
    navWidth: navWidthDefault,
    detailWidth: detailWidthDefault,
    navCollapsed: false
  }
}

// Defensive parse: any missing / non-number / out-of-range field silently falls
// back to its default. Never throws — a corrupt payload just yields defaults.
function parseSnapshot(raw: unknown): LayoutSnapshot {
  const snapshot = defaultSnapshot()

  if (!raw || typeof raw !== 'object') {
    return snapshot
  }

  const value = raw as Record<string, unknown>

  if (typeof value.navWidth === 'number') {
    snapshot.navWidth = clamp(value.navWidth, navWidthMin, navWidthMax)
  }

  if (typeof value.detailWidth === 'number') {
    snapshot.detailWidth = clamp(value.detailWidth, detailWidthMin, detailWidthMax)
  }

  if (typeof value.navCollapsed === 'boolean') {
    snapshot.navCollapsed = value.navCollapsed
  }

  return snapshot
}

function loadSnapshot(): LayoutSnapshot {
  try {
    const raw = localStorage.getItem(layoutStorageKey)

    if (!raw) {
      return defaultSnapshot()
    }

    return parseSnapshot(JSON.parse(raw))
  } catch {
    return defaultSnapshot()
  }
}

const initial = loadSnapshot()

const navWidth = ref<number>(initial.navWidth)
const detailWidth = ref<number>(initial.detailWidth)
const navCollapsed = ref<boolean>(initial.navCollapsed)

function persist(): void {
  try {
    localStorage.setItem(
      layoutStorageKey,
      JSON.stringify({
        navWidth: navWidth.value,
        detailWidth: detailWidth.value,
        navCollapsed: navCollapsed.value
      })
    )
  } catch {
    // Ignore localStorage persistence errors — the layout is a UI preference,
    // not a source of truth, so a full-disk / private-mode failure is harmless.
  }
}

watch([navWidth, detailWidth, navCollapsed], persist)

function setNavWidth(next: number): void {
  navWidth.value = clamp(next, navWidthMin, navWidthMax)
}

function setDetailWidth(next: number): void {
  detailWidth.value = clamp(next, detailWidthMin, detailWidthMax)
}

function setNavCollapsed(next: boolean): void {
  navCollapsed.value = next
}

function toggleNavCollapsed(): void {
  navCollapsed.value = !navCollapsed.value
}

export function useLayout(): {
  navWidth: typeof navWidth
  detailWidth: typeof detailWidth
  navCollapsed: typeof navCollapsed
  setNavWidth: typeof setNavWidth
  setDetailWidth: typeof setDetailWidth
  setNavCollapsed: typeof setNavCollapsed
  toggleNavCollapsed: typeof toggleNavCollapsed
} {
  return {
    navWidth,
    detailWidth,
    navCollapsed,
    setNavWidth,
    setDetailWidth,
    setNavCollapsed,
    toggleNavCollapsed
  }
}
