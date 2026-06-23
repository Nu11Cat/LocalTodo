import { describe, expect, it } from 'vitest'
import { findProjectSummary, getProjectKey, summarizeProjects } from './projectSummary'
import type { Task } from './taskModel'

const baseTask: Task = {
  id: 'task-1',
  title: 'Base task',
  status: 'todo',
  priority: 'medium',
  type: 'chore',
  tags: [],
  description: '',
  relatedFiles: [],
  commands: [],
  notes: [],
  sensitive: false,
  createdAt: '2026-06-16T01:00:00.000Z',
  updatedAt: '2026-06-16T02:00:00.000Z'
}

function task(overrides: Partial<Task>): Task {
  return {
    ...baseTask,
    ...overrides
  }
}

describe('projectSummary', () => {
  it('returns no summaries for no tasks', () => {
    expect(summarizeProjects([])).toEqual([])
  })

  it('groups tasks by project name and repository path', () => {
    const tasks = [
      task({ id: 'task-1', title: 'Project task', projectName: 'LocalTodo', repoPath: 'G:/repo' }),
      task({ id: 'task-2', title: 'Same project', projectName: 'LocalTodo', repoPath: 'G:/repo' }),
      task({ id: 'task-3', title: 'No project' })
    ]

    const summaries = summarizeProjects(tasks)

    expect(summaries).toHaveLength(2)
    expect(summaries[0]).toMatchObject({
      key: 'LocalTodo\nG:/repo',
      label: 'LocalTodo',
      projectName: 'LocalTodo',
      repoPath: 'G:/repo',
      total: 2
    })
    expect(summaries[1]).toMatchObject({
      key: '\n',
      label: '(No project)',
      total: 1
    })
  })

  it('counts tasks by status', () => {
    const summaries = summarizeProjects([
      task({ id: 'task-1', status: 'inbox', projectName: 'LocalTodo' }),
      task({ id: 'task-2', status: 'todo', projectName: 'LocalTodo' }),
      task({ id: 'task-3', status: 'doing', projectName: 'LocalTodo' }),
      task({ id: 'task-4', status: 'blocked', projectName: 'LocalTodo' }),
      task({ id: 'task-5', status: 'review', projectName: 'LocalTodo' }),
      task({ id: 'task-6', status: 'done', projectName: 'LocalTodo' })
    ])

    expect(summaries[0]).toMatchObject({
      total: 6,
      active: 5,
      done: 1,
      inbox: 1,
      todo: 1,
      doing: 1,
      blocked: 1,
      review: 1
    })
  })

  it('sorts by active count and then label', () => {
    const summaries = summarizeProjects([
      task({ id: 'task-1', projectName: 'Beta', status: 'todo' }),
      task({ id: 'task-2', projectName: 'Alpha', status: 'todo' }),
      task({ id: 'task-3', projectName: 'Alpha', status: 'doing' }),
      task({ id: 'task-4', projectName: 'Gamma', status: 'done' })
    ])

    expect(summaries.map((summary) => summary.label)).toEqual(['Alpha', 'Beta', 'Gamma'])
  })

  it('finds a project summary by key', () => {
    const summaries = summarizeProjects([task({ id: 'task-1', projectName: 'LocalTodo' })])
    const key = getProjectKey(summaries[0].tasks[0])

    expect(findProjectSummary(summaries, key)?.label).toBe('LocalTodo')
    expect(findProjectSummary(summaries, null)).toBeNull()
    expect(findProjectSummary(summaries, 'missing')).toBeNull()
  })
})
