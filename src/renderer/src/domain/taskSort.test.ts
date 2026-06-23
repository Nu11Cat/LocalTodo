import { describe, expect, it } from 'vitest'
import { createDefaultTaskSortState, sortTasks } from './taskSort'
import type { Task } from './taskModel'

const baseTask: Task = {
  id: 'task-1',
  title: 'A',
  status: 'todo',
  priority: 'medium',
  type: 'feature',
  tags: [],
  description: '',
  relatedFiles: [],
  commands: [],
  notes: [],
  sensitive: false,
  createdAt: '2026-06-10T00:00:00.000Z',
  updatedAt: '2026-06-10T00:00:00.000Z'
}

function task(overrides: Partial<Task>): Task {
  return { ...baseTask, ...overrides }
}

describe('createDefaultTaskSortState', () => {
  it('defaults to manual / desc', () => {
    expect(createDefaultTaskSortState()).toEqual({ key: 'manual', direction: 'desc' })
  })
})

describe('sortTasks', () => {
  it('returns the same array reference for manual sort', () => {
    const tasks = [task({ id: 'a' }), task({ id: 'b' })]

    expect(sortTasks(tasks, { key: 'manual', direction: 'desc' })).toBe(tasks)
  })

  it('sorts by updatedAt descending and ascending', () => {
    const older = task({ id: 'older', updatedAt: '2026-06-01T00:00:00.000Z' })
    const newer = task({ id: 'newer', updatedAt: '2026-06-20T00:00:00.000Z' })
    const tasks = [older, newer]

    expect(sortTasks(tasks, { key: 'updatedAt', direction: 'desc' }).map((t) => t.id)).toEqual([
      'newer',
      'older'
    ])
    expect(sortTasks(tasks, { key: 'updatedAt', direction: 'asc' }).map((t) => t.id)).toEqual([
      'older',
      'newer'
    ])
  })

  it('sorts by createdAt', () => {
    const first = task({ id: 'first', createdAt: '2026-06-01T00:00:00.000Z' })
    const second = task({ id: 'second', createdAt: '2026-06-05T00:00:00.000Z' })

    expect(sortTasks([first, second], { key: 'createdAt', direction: 'desc' }).map((t) => t.id)).toEqual([
      'second',
      'first'
    ])
  })

  it('sorts by priority weight (urgent highest)', () => {
    const low = task({ id: 'low', priority: 'low' })
    const urgent = task({ id: 'urgent', priority: 'urgent' })
    const high = task({ id: 'high', priority: 'high' })

    expect(
      sortTasks([low, urgent, high], { key: 'priority', direction: 'desc' }).map((t) => t.id)
    ).toEqual(['urgent', 'high', 'low'])
  })

  it('falls back to createdAt for equal keys to stay deterministic', () => {
    const a = task({ id: 'a', priority: 'high', createdAt: '2026-06-01T00:00:00.000Z' })
    const b = task({ id: 'b', priority: 'high', createdAt: '2026-06-02T00:00:00.000Z' })

    expect(sortTasks([b, a], { key: 'priority', direction: 'desc' }).map((t) => t.id)).toEqual([
      'b',
      'a'
    ])
  })

  it('falls back to id when key and createdAt are equal', () => {
    const a = task({ id: 'a', priority: 'high', createdAt: '2026-06-01T00:00:00.000Z' })
    const b = task({ id: 'b', priority: 'high', createdAt: '2026-06-01T00:00:00.000Z' })

    expect(sortTasks([b, a], { key: 'priority', direction: 'asc' }).map((t) => t.id)).toEqual([
      'a',
      'b'
    ])
    expect(sortTasks([a, b], { key: 'priority', direction: 'desc' }).map((t) => t.id)).toEqual([
      'b',
      'a'
    ])
  })

  it('does not mutate the input array for non-manual sorts', () => {
    const tasks = [
      task({ id: 'a', updatedAt: '2026-06-01T00:00:00.000Z' }),
      task({ id: 'b', updatedAt: '2026-06-20T00:00:00.000Z' })
    ]
    const sorted = sortTasks(tasks, { key: 'updatedAt', direction: 'desc' })

    expect(sorted).not.toBe(tasks)
    expect(tasks.map((t) => t.id)).toEqual(['a', 'b'])
  })
})
