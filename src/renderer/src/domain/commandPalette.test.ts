import { describe, expect, it } from 'vitest'
import {
  filterCommandPaletteItems,
  nextCommandPaletteIndex,
  type CommandPaletteItem
} from './commandPalette'

const items: CommandPaletteItem[] = [
  { id: 'new-task', label: 'New task', keywords: ['create'] },
  { id: 'search-tasks', label: 'Search tasks', keywords: ['find'] },
  { id: 'clear-filters', label: 'Clear filters' }
]

describe('filterCommandPaletteItems', () => {
  it('returns all items for a blank query without sharing the array', () => {
    const filtered = filterCommandPaletteItems(items, '  ')

    expect(filtered).toEqual(items)
    expect(filtered).not.toBe(items)
  })

  it('matches labels, ids, and keywords case-insensitively', () => {
    expect(filterCommandPaletteItems(items, 'SEARCH').map((item) => item.id)).toEqual([
      'search-tasks'
    ])
    expect(filterCommandPaletteItems(items, 'clear-f').map((item) => item.id)).toEqual([
      'clear-filters'
    ])
    expect(filterCommandPaletteItems(items, 'create').map((item) => item.id)).toEqual([
      'new-task'
    ])
  })

  it('ignores accents when matching', () => {
    const accented: CommandPaletteItem[] = [{ id: 'search-tasks', label: 'R\u00e9sum\u00e9 search' }]

    expect(filterCommandPaletteItems(accented, 'resume')).toEqual(accented)
  })

  it('returns an empty array when nothing matches', () => {
    expect(filterCommandPaletteItems(items, 'unrelated')).toEqual([])
  })
})

describe('nextCommandPaletteIndex', () => {
  it('returns no selection for an empty result list', () => {
    expect(nextCommandPaletteIndex(0, 0, 'next')).toBe(-1)
  })

  it('wraps next and previous navigation', () => {
    expect(nextCommandPaletteIndex(3, 2, 'next')).toBe(0)
    expect(nextCommandPaletteIndex(3, 0, 'previous')).toBe(2)
  })

  it('moves directly to home and end', () => {
    expect(nextCommandPaletteIndex(4, 2, 'home')).toBe(0)
    expect(nextCommandPaletteIndex(4, 1, 'end')).toBe(3)
  })
})
