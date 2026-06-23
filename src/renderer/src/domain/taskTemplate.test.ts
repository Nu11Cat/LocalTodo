import { describe, expect, it } from 'vitest'
import {
  buildTaskInputFromTemplate,
  findTaskTemplate,
  taskTemplates,
  type TaskTemplateId
} from './taskTemplate'

describe('findTaskTemplate', () => {
  it('finds each built-in template by id', () => {
    const ids: TaskTemplateId[] = ['blank', 'bug', 'feature', 'refactor', 'release']

    for (const id of ids) {
      expect(findTaskTemplate(id)?.id).toBe(id)
    }
  })

  it('returns undefined for unknown ids', () => {
    expect(findTaskTemplate('nope')).toBeUndefined()
  })
})

describe('buildTaskInputFromTemplate', () => {
  it('keeps the blank template minimal so createTask defaults apply', () => {
    const blank = findTaskTemplate('blank')!
    const input = buildTaskInputFromTemplate(blank, 'Plain task')

    expect(input).toEqual({ title: 'Plain task' })
  })

  it('prefills type, priority, description, commands, and tags for the bug template', () => {
    const bug = findTaskTemplate('bug')!
    const input = buildTaskInputFromTemplate(bug, 'Crash on launch')

    expect(input.title).toBe('Crash on launch')
    expect(input.type).toBe('bug')
    expect(input.priority).toBe('high')
    expect(input.description).toContain('Steps to reproduce')
    expect(input.commands).toEqual(['npm test'])
    expect(input.tags).toEqual(['bug'])
  })

  it('maps the release template to the deploy task type', () => {
    const release = findTaskTemplate('release')!

    expect(release.type).toBe('deploy')
    expect(buildTaskInputFromTemplate(release, 'Cut 1.0').type).toBe('deploy')
  })

  it('gives every non-blank template a type, description, commands, and tags', () => {
    for (const template of taskTemplates.filter((item) => item.id !== 'blank')) {
      expect(template.type).toBeDefined()
      expect(template.description.length).toBeGreaterThan(0)
      expect(template.commands.length).toBeGreaterThan(0)
      expect(template.tags.length).toBeGreaterThan(0)
    }
  })

  it('copies array fields so mutating the input does not affect the template', () => {
    const feature = findTaskTemplate('feature')!
    const input = buildTaskInputFromTemplate(feature, 'New feature')

    input.commands?.push('rm -rf /')
    input.tags?.push('mutated')

    expect(feature.commands).not.toContain('rm -rf /')
    expect(feature.tags).not.toContain('mutated')
  })
})
