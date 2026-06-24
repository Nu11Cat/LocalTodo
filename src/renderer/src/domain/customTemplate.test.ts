import { describe, expect, it } from 'vitest'
import {
  createCustomTemplateFromTask,
  parseCustomTemplates,
  removeCustomTemplate,
  serializeCustomTemplates,
  toTaskTemplate,
  upsertCustomTemplate,
  type CustomTemplate
} from './customTemplate'
import { createTask, type Task } from './taskModel'

function task(overrides: Partial<Task> = {}): Task {
  return {
    ...createTask({ title: 'Source task' }),
    ...overrides
  }
}

function template(overrides: Partial<CustomTemplate> = {}): CustomTemplate {
  return {
    id: 'tpl-1',
    name: 'A',
    description: '',
    commands: [],
    tags: [],
    ...overrides
  }
}

describe('createCustomTemplateFromTask', () => {
  it('snapshots type/priority/description/commands/tags and trims the name', () => {
    const source = task({
      type: 'bug',
      priority: 'high',
      description: 'Fix the thing',
      commands: ['npm test', 'npm test'],
      tags: ['bug', '  ', 'urgent']
    })

    const created = createCustomTemplateFromTask('  My template  ', source)

    expect(created.name).toBe('My template')
    expect(created.id).toBeTruthy()
    expect(created.type).toBe('bug')
    expect(created.priority).toBe('high')
    expect(created.description).toBe('Fix the thing')
    // sanitizeTaskStringList dedupes and drops blanks.
    expect(created.commands).toEqual(['npm test'])
    expect(created.tags).toEqual(['bug', 'urgent'])
  })
})

describe('upsertCustomTemplate', () => {
  it('appends when the name is new', () => {
    const result = upsertCustomTemplate([template({ id: 'a', name: 'A' })], template({ id: 'b', name: 'B' }))

    expect(result).toHaveLength(2)
    expect(result[1].name).toBe('B')
  })

  it('replaces a same-named template (case-insensitive) keeping the original id', () => {
    const existing = [template({ id: 'a', name: 'Bug flow', description: 'old' })]
    const result = upsertCustomTemplate(existing, template({ id: 'b', name: 'bug flow', description: 'new' }))

    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('a')
    expect(result[0].description).toBe('new')
  })
})

describe('removeCustomTemplate', () => {
  it('removes only the template with the matching id', () => {
    const result = removeCustomTemplate(
      [template({ id: 'a', name: 'A' }), template({ id: 'b', name: 'B' })],
      'a'
    )

    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('b')
  })
})

describe('parseCustomTemplates', () => {
  it('returns an empty array for non-array input', () => {
    expect(parseCustomTemplates(null)).toEqual([])
    expect(parseCustomTemplates({})).toEqual([])
    expect(parseCustomTemplates('nope')).toEqual([])
  })

  it('drops entries without a usable name', () => {
    const result = parseCustomTemplates([{ id: 'a', name: '   ' }, { id: 'b' }, { id: 'c', name: 'Keep' }])

    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Keep')
  })

  it('regenerates missing or duplicated ids', () => {
    const result = parseCustomTemplates([
      { name: 'No id' },
      { id: 'dup', name: 'First' },
      { id: 'dup', name: 'Second' }
    ])

    expect(result).toHaveLength(3)
    const ids = result.map((item) => item.id)
    expect(new Set(ids).size).toBe(3)
    expect(ids.every((id) => typeof id === 'string' && id.length > 0)).toBe(true)
  })

  it('regenerates ids that collide with built-in template ids', () => {
    const result = parseCustomTemplates([
      { id: 'bug', name: 'My bug flow' },
      { id: 'blank', name: 'My blank' }
    ])

    expect(result).toHaveLength(2)
    expect(result[0].id).not.toBe('bug')
    expect(result[1].id).not.toBe('blank')
    expect(result[0].name).toBe('My bug flow')
    expect(result[1].name).toBe('My blank')
  })

  it('keeps valid type/priority and drops invalid ones', () => {
    const result = parseCustomTemplates([
      { id: 'a', name: 'Valid', type: 'bug', priority: 'high' },
      { id: 'b', name: 'Invalid', type: 'nope', priority: 'whatever' }
    ])

    expect(result[0].type).toBe('bug')
    expect(result[0].priority).toBe('high')
    expect(result[1].type).toBeUndefined()
    expect(result[1].priority).toBeUndefined()
  })

  it('sanitizes commands and tags arrays', () => {
    const result = parseCustomTemplates([
      { id: 'a', name: 'Clean', commands: ['npm test', 'npm test', 5], tags: ['  x  ', ''] }
    ])

    expect(result[0].commands).toEqual(['npm test'])
    expect(result[0].tags).toEqual(['x'])
  })

  it('round-trips through serialize', () => {
    const source = [template({ id: 'a', name: 'A', type: 'feature', commands: ['npm run build'], tags: ['x'] })]
    const parsed = parseCustomTemplates(JSON.parse(serializeCustomTemplates(source)))

    expect(parsed).toEqual(source)
  })
})

describe('toTaskTemplate', () => {
  it('adapts a custom template into the built-in TaskTemplate shape', () => {
    const adapted = toTaskTemplate(
      template({ id: 'a', name: 'My label', type: 'bug', commands: ['npm test'], tags: ['bug'] })
    )

    expect(adapted.id).toBe('a')
    expect(adapted.label).toBe('My label')
    expect(adapted.type).toBe('bug')
    expect(adapted.commands).toEqual(['npm test'])
    expect(adapted.tags).toEqual(['bug'])
  })
})
