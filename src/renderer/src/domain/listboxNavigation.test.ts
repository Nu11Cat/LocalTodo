import { describe, expect, it } from 'vitest'
import {
  advanceListboxTypeahead,
  createListboxTypeaheadState,
  findTypeaheadMatchIndex,
  nextListboxIndex
} from './listboxNavigation'

describe('nextListboxIndex', () => {
  it('returns no index for an empty list', () => {
    expect(nextListboxIndex(0, -1, 'down')).toBe(-1)
  })

  it('enters an unselected list from the natural end for the direction', () => {
    expect(nextListboxIndex(4, -1, 'down')).toBe(0)
    expect(nextListboxIndex(4, -1, 'pagedown', 3)).toBe(0)
    expect(nextListboxIndex(4, -1, 'up')).toBe(3)
    expect(nextListboxIndex(4, -1, 'pageup', 3)).toBe(3)
  })

  it('clamps arrow and page movement to the list bounds', () => {
    expect(nextListboxIndex(5, 1, 'down')).toBe(2)
    expect(nextListboxIndex(5, 0, 'up')).toBe(0)
    expect(nextListboxIndex(5, 1, 'pagedown', 10)).toBe(4)
    expect(nextListboxIndex(5, 3, 'pageup', 10)).toBe(0)
  })

  it('moves directly to home and end', () => {
    expect(nextListboxIndex(5, 3, 'home')).toBe(0)
    expect(nextListboxIndex(5, 1, 'end')).toBe(4)
  })

  it('normalizes an invalid page size to one row', () => {
    expect(nextListboxIndex(5, 2, 'pagedown', 0)).toBe(3)
    expect(nextListboxIndex(5, 2, 'pageup', Number.NaN)).toBe(1)
  })
})

describe('listbox type-ahead', () => {
  it('builds a query within the timeout and restarts it after the timeout', () => {
    const initial = createListboxTypeaheadState()
    const first = advanceListboxTypeahead(initial, 'b', 100, 700)
    const second = advanceListboxTypeahead(first, 'u', 500, 700)
    const expired = advanceListboxTypeahead(second, 'g', 1_500, 700)

    expect(first).toEqual({ query: 'b', lastInputAt: 100 })
    expect(second).toEqual({ query: 'bu', lastInputAt: 500 })
    expect(expired).toEqual({ query: 'g', lastInputAt: 1_500 })
  })

  it('restarts the query if the clock moves backwards', () => {
    const state = { query: 'bu', lastInputAt: 500 }

    expect(advanceListboxTypeahead(state, 'g', 400, 700)).toEqual({
      query: 'g',
      lastInputAt: 400
    })
  })

  it('finds the next prefix match and wraps around', () => {
    const labels = ['Build release', 'Fix login', 'Bug bash', 'Write docs']

    expect(findTypeaheadMatchIndex(labels, 0, 'b')).toBe(2)
    expect(findTypeaheadMatchIndex(labels, 2, 'b')).toBe(0)
    expect(findTypeaheadMatchIndex(labels, -1, 'w')).toBe(3)
  })

  it('uses a multi-character query and ignores case, accents, and leading whitespace', () => {
    const labels = ['  R\u00e9sum\u00e9 parser', 'Release notes', 'Review PR']

    expect(findTypeaheadMatchIndex(labels, -1, 'resume')).toBe(0)
    expect(findTypeaheadMatchIndex(labels, -1, 'RELEASE')).toBe(1)
    expect(findTypeaheadMatchIndex(labels, -1, 'rev')).toBe(2)
  })

  it('cycles matches when the same character is typed repeatedly', () => {
    const labels = ['Build release', 'Bug bash', 'Backfill tests']

    expect(findTypeaheadMatchIndex(labels, 0, 'bb')).toBe(1)
    expect(findTypeaheadMatchIndex(labels, 1, 'bbb')).toBe(2)
  })

  it('returns no match for empty or unmatched queries', () => {
    expect(findTypeaheadMatchIndex(['Build'], 0, '')).toBe(-1)
    expect(findTypeaheadMatchIndex(['Build'], 0, 'x')).toBe(-1)
  })
})
