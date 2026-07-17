export type CommandPaletteCommandId =
  | 'new-task'
  | 'search-tasks'
  | 'clear-filters'
  | 'toggle-sidebar'

export interface CommandPaletteItem {
  id: CommandPaletteCommandId
  label: string
  keywords?: readonly string[]
  shortcut?: string
}

export type CommandPaletteNavigationDirection = 'next' | 'previous' | 'home' | 'end'

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{Mark}/gu, '')
    .toLocaleLowerCase()
    .trim()
}

export function filterCommandPaletteItems(
  items: readonly CommandPaletteItem[],
  query: string
): CommandPaletteItem[] {
  const normalizedQuery = normalizeSearchText(query)

  if (!normalizedQuery) {
    return [...items]
  }

  return items.filter((item) =>
    [item.label, item.id, ...(item.keywords ?? [])]
      .map(normalizeSearchText)
      .some((candidate) => candidate.includes(normalizedQuery))
  )
}

export function nextCommandPaletteIndex(
  itemCount: number,
  currentIndex: number,
  direction: CommandPaletteNavigationDirection
): number {
  if (itemCount <= 0) {
    return -1
  }

  if (direction === 'home') {
    return 0
  }

  if (direction === 'end') {
    return itemCount - 1
  }

  const safeCurrentIndex = currentIndex >= 0 && currentIndex < itemCount ? currentIndex : 0

  if (direction === 'next') {
    return (safeCurrentIndex + 1) % itemCount
  }

  return (safeCurrentIndex - 1 + itemCount) % itemCount
}
