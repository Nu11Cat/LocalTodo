import { describe, expect, it } from 'vitest'
import { createEmptyTaskFilterState, type TaskFilterState } from './taskFilter'
import { createDefaultTaskSortState, type TaskSortState } from './taskSort'
import {
  createSavedView,
  parseSavedViews,
  removeSavedView,
  serializeSavedViews,
  upsertSavedView,
  type SavedView
} from './savedView'

function filter(overrides: Partial<TaskFilterState> = {}): TaskFilterState {
  return { ...createEmptyTaskFilterState(), ...overrides }
}

function sort(overrides: Partial<TaskSortState> = {}): TaskSortState {
  return { ...createDefaultTaskSortState(), ...overrides }
}

function view(overrides: Partial<SavedView> = {}): SavedView {
  return {
    id: 'view-1',
    name: 'A',
    filter: filter(),
    sort: sort(),
    ...overrides
  }
}

describe('createSavedView', () => {
  it('trims the name, assigns an id, and clones filter/sort', () => {
    const source = filter({ statuses: ['todo'], tags: ['x'] })
    const sortSource = sort({ key: 'priority', direction: 'asc' })
    const created = createSavedView('  My view  ', source, sortSource)

    expect(created.name).toBe('My view')
    expect(created.id).toBeTruthy()
    expect(created.filter).toEqual(source)
    expect(created.sort).toEqual(sortSource)

    // Mutating the source must not leak into the stored view.
    source.statuses.push('done')
    source.tags.push('y')
    expect(created.filter.statuses).toEqual(['todo'])
    expect(created.filter.tags).toEqual(['x'])
  })
})

describe('upsertSavedView', () => {
  it('appends a view with a new name', () => {
    const views = [view({ id: 'a', name: 'Alpha' })]
    const next = upsertSavedView(views, view({ id: 'b', name: 'Beta' }))

    expect(next.map((v) => v.name)).toEqual(['Alpha', 'Beta'])
  })

  it('overwrites a same-name view case-insensitively, keeping the original id', () => {
    const views = [view({ id: 'a', name: 'Alpha', filter: filter({ keyword: 'old' }) })]
    const next = upsertSavedView(views, view({ id: 'b', name: 'ALPHA', filter: filter({ keyword: 'new' }) }))

    expect(next).toHaveLength(1)
    expect(next[0].id).toBe('a')
    expect(next[0].name).toBe('ALPHA')
    expect(next[0].filter.keyword).toBe('new')
  })
})

describe('removeSavedView', () => {
  it('removes the view with the matching id', () => {
    const views = [view({ id: 'a' }), view({ id: 'b' })]

    expect(removeSavedView(views, 'a').map((v) => v.id)).toEqual(['b'])
  })

  it('returns an equivalent list when the id is not present', () => {
    const views = [view({ id: 'a' })]

    expect(removeSavedView(views, 'missing').map((v) => v.id)).toEqual(['a'])
  })
})

describe('parseSavedViews', () => {
  it('round-trips serialized views', () => {
    const views = [
      view({ id: 'a', name: 'Alpha', filter: filter({ statuses: ['todo'] }), sort: sort({ key: 'updatedAt' }) })
    ]
    const parsed = parseSavedViews(JSON.parse(serializeSavedViews(views)))

    expect(parsed).toEqual(views)
  })

  it('returns an empty array for non-array input', () => {
    expect(parseSavedViews(null)).toEqual([])
    expect(parseSavedViews({ name: 'x' })).toEqual([])
    expect(parseSavedViews('nope')).toEqual([])
  })

  it('skips entries without a usable name', () => {
    expect(parseSavedViews([{ name: '   ' }, { filter: {} }, 42])).toEqual([])
  })

  it('falls back to defaults for missing or malformed filter/sort fields', () => {
    const parsed = parseSavedViews([{ id: 'a', name: 'Alpha' }])

    expect(parsed).toHaveLength(1)
    expect(parsed[0].filter).toEqual(createEmptyTaskFilterState())
    expect(parsed[0].sort).toEqual(createDefaultTaskSortState())
  })

  it('keeps valid fields and defaults invalid ones within an entry', () => {
    const parsed = parseSavedViews([
      {
        id: 'a',
        name: 'Alpha',
        filter: { keyword: 'kw', statuses: 'not-an-array', tagMatchMode: 'any' },
        sort: { key: 'bogus', direction: 'asc' }
      }
    ])

    expect(parsed[0].filter.keyword).toBe('kw')
    expect(parsed[0].filter.statuses).toEqual([])
    expect(parsed[0].filter.tagMatchMode).toBe('any')
    expect(parsed[0].sort.key).toBe('manual')
    expect(parsed[0].sort.direction).toBe('asc')
  })

  it('drops invalid enum members but keeps valid ones', () => {
    const parsed = parseSavedViews([
      {
        id: 'a',
        name: 'Alpha',
        filter: {
          statuses: ['todo', 'not-a-status'],
          priorities: ['urgent', 'nope'],
          types: ['feature', 'bogus']
        }
      }
    ])

    expect(parsed[0].filter.statuses).toEqual(['todo'])
    expect(parsed[0].filter.priorities).toEqual(['urgent'])
    expect(parsed[0].filter.types).toEqual(['feature'])
  })

  it('keeps portable custom status and type filters', () => {
    const parsed = parseSavedViews([
      {
        id: 'a',
        name: 'Release flow',
        filter: {
          statuses: ['custom-active:QA'],
          types: ['custom:Ops']
        }
      }
    ])

    expect(parsed[0].filter.statuses).toEqual(['custom-active:QA'])
    expect(parsed[0].filter.types).toEqual(['custom:Ops'])
  })

  it('synthesizes an id when one is missing', () => {
    const parsed = parseSavedViews([{ name: 'Alpha' }])

    expect(parsed[0].id).toBeTruthy()
  })

  it('regenerates duplicate persisted ids so each view is uniquely addressable', () => {
    const parsed = parseSavedViews([
      { id: 'dup', name: 'Alpha' },
      { id: 'dup', name: 'Beta' }
    ])

    expect(parsed[0].id).toBe('dup')
    expect(parsed[1].id).not.toBe('dup')
    expect(parsed[1].id).toBeTruthy()
  })
})
