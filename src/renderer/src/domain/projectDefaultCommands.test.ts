import { describe, expect, it } from 'vitest'
import {
  findProjectDefaultCommands,
  parseProjectDefaultCommands,
  removeProjectDefaultCommands,
  serializeProjectDefaultCommands,
  upsertProjectDefaultCommands,
  type ProjectDefaultCommands
} from './projectDefaultCommands'

function entry(overrides: Partial<ProjectDefaultCommands> = {}): ProjectDefaultCommands {
  return { key: 'Proj\n/repo', commands: ['npm test'], ...overrides }
}

describe('upsertProjectDefaultCommands', () => {
  it('appends a new entry with sanitized commands', () => {
    const result = upsertProjectDefaultCommands([], 'a', ['npm test', 'npm test', '  '])

    expect(result).toEqual([{ key: 'a', commands: ['npm test'] }])
  })

  it('replaces an existing entry in place keeping order', () => {
    const result = upsertProjectDefaultCommands(
      [entry({ key: 'a', commands: ['old'] }), entry({ key: 'b', commands: ['keep'] })],
      'a',
      ['new']
    )

    expect(result).toEqual([
      { key: 'a', commands: ['new'] },
      { key: 'b', commands: ['keep'] }
    ])
  })

  it('removes the entry when the command list is empty after sanitizing', () => {
    const result = upsertProjectDefaultCommands(
      [entry({ key: 'a', commands: ['old'] }), entry({ key: 'b', commands: ['keep'] })],
      'a',
      ['   ']
    )

    expect(result).toEqual([{ key: 'b', commands: ['keep'] }])
  })

  it('is a no-op when clearing a key that has no entry', () => {
    const entries = [entry({ key: 'b', commands: ['keep'] })]
    const result = upsertProjectDefaultCommands(entries, 'a', [])

    expect(result).toBe(entries)
  })

  it('refuses to store an entry for the unassigned project key', () => {
    const result = upsertProjectDefaultCommands([], '\n', ['npm test'])

    expect(result).toEqual([])
  })
})

describe('removeProjectDefaultCommands', () => {
  it('removes only the matching key', () => {
    const result = removeProjectDefaultCommands(
      [entry({ key: 'a' }), entry({ key: 'b' })],
      'a'
    )

    expect(result).toEqual([entry({ key: 'b' })])
  })
})

describe('findProjectDefaultCommands', () => {
  it('returns the entry for a key or undefined', () => {
    const entries = [entry({ key: 'a', commands: ['x'] })]

    expect(findProjectDefaultCommands(entries, 'a')?.commands).toEqual(['x'])
    expect(findProjectDefaultCommands(entries, 'missing')).toBeUndefined()
  })
})

describe('parseProjectDefaultCommands', () => {
  it('returns an empty array for non-array input', () => {
    expect(parseProjectDefaultCommands(null)).toEqual([])
    expect(parseProjectDefaultCommands({})).toEqual([])
    expect(parseProjectDefaultCommands('nope')).toEqual([])
  })

  it('drops entries without a string key or usable commands', () => {
    const result = parseProjectDefaultCommands([
      { key: 'a', commands: ['npm test'] },
      { commands: ['no key'] },
      { key: 'b', commands: [] },
      { key: 'c', commands: ['  '] }
    ])

    expect(result).toEqual([{ key: 'a', commands: ['npm test'] }])
  })

  it('drops duplicate keys keeping the first', () => {
    const result = parseProjectDefaultCommands([
      { key: 'a', commands: ['first'] },
      { key: 'a', commands: ['second'] }
    ])

    expect(result).toEqual([{ key: 'a', commands: ['first'] }])
  })

  it('drops an entry for the unassigned project key', () => {
    const result = parseProjectDefaultCommands([
      { key: '\n', commands: ['npm test'] },
      { key: 'a', commands: ['keep'] }
    ])

    expect(result).toEqual([{ key: 'a', commands: ['keep'] }])
  })

  it('sanitizes the commands array', () => {
    const result = parseProjectDefaultCommands([
      { key: 'a', commands: ['npm test', 'npm test', 5, '  build  '] }
    ])

    expect(result).toEqual([{ key: 'a', commands: ['npm test', 'build'] }])
  })

  it('round-trips through serialize', () => {
    const source = [entry({ key: 'a', commands: ['npm run build'] })]
    const parsed = parseProjectDefaultCommands(JSON.parse(serializeProjectDefaultCommands(source)))

    expect(parsed).toEqual(source)
  })
})
