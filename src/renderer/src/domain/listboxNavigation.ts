export type ListboxNavigationDirection =
  | 'up'
  | 'down'
  | 'home'
  | 'end'
  | 'pageup'
  | 'pagedown'

export interface ListboxTypeaheadState {
  query: string
  lastInputAt: number | null
}

export function createListboxTypeaheadState(): ListboxTypeaheadState {
  return { query: '', lastInputAt: null }
}

export function advanceListboxTypeahead(
  state: ListboxTypeaheadState,
  key: string,
  inputAt: number,
  timeoutMs: number
): ListboxTypeaheadState {
  const elapsed = state.lastInputAt === null ? Number.POSITIVE_INFINITY : inputAt - state.lastInputAt
  const query = elapsed < 0 || elapsed > timeoutMs ? key : `${state.query}${key}`

  return { query, lastInputAt: inputAt }
}

export function nextListboxIndex(
  itemCount: number,
  currentIndex: number,
  direction: ListboxNavigationDirection,
  pageSize = 1
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

  if (currentIndex < 0 || currentIndex >= itemCount) {
    return direction === 'down' || direction === 'pagedown' ? 0 : itemCount - 1
  }

  const safePageSize = Number.isFinite(pageSize) ? Math.max(1, Math.floor(pageSize)) : 1

  if (direction === 'down') {
    return Math.min(currentIndex + 1, itemCount - 1)
  }

  if (direction === 'up') {
    return Math.max(currentIndex - 1, 0)
  }

  if (direction === 'pagedown') {
    return Math.min(currentIndex + safePageSize, itemCount - 1)
  }

  return Math.max(currentIndex - safePageSize, 0)
}

function normalizeForTypeahead(value: string): string {
  return value
    .trimStart()
    .normalize('NFKD')
    .replace(/\p{Mark}/gu, '')
    .toLocaleLowerCase()
}

function collapseRepeatedQuery(query: string): string {
  const characters = Array.from(query)

  if (characters.length > 1 && characters.every((character) => character === characters[0])) {
    return characters[0]
  }

  return query
}

export function findTypeaheadMatchIndex(
  labels: readonly string[],
  currentIndex: number,
  query: string
): number {
  if (labels.length === 0) {
    return -1
  }

  const normalizedQuery = collapseRepeatedQuery(normalizeForTypeahead(query))

  if (!normalizedQuery) {
    return -1
  }

  const startIndex = currentIndex >= 0 && currentIndex < labels.length ? currentIndex : -1

  for (let offset = 1; offset <= labels.length; offset += 1) {
    const index = (startIndex + offset) % labels.length

    if (normalizeForTypeahead(labels[index]).startsWith(normalizedQuery)) {
      return index
    }
  }

  return -1
}
