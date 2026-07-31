import { describe, expect, it } from 'vitest'
import { migrateStoredTasks } from './taskMigration'

describe('taskMigration', () => {
  it('migrates legacy todos to tasks', () => {
    const tasks = migrateStoredTasks([
      {
        id: 'legacy-1',
        title: 'Legacy todo',
        completed: false,
        createdAt: '2026-06-16T01:00:00.000Z'
      }
    ])

    expect(tasks).toEqual([
      {
        id: 'legacy-1',
        title: 'Legacy todo',
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
        updatedAt: '2026-06-16T01:00:00.000Z'
      }
    ])
  })

  it('normalizes existing tasks', () => {
    const tasks = migrateStoredTasks([
      {
        id: 'task-1',
        title: 'Existing task',
        status: 'doing',
        priority: 'high',
        type: 'feature',
        tags: ['app', 123, 'ai'],
        description: 'Details',
        projectName: ' LocalTodo ',
        repoPath: ' G:/Zhao/nu11cat/LocalTodo ',
        gitBranch: ' feature/migrate-branch ',
        githubIssueUrl: ' https://github.com/Nu11Cat/LocalTodo/issues/12 ',
        githubPullRequestUrl: ' https://github.com/Nu11Cat/LocalTodo/pull/34 ',
        relatedFiles: [' src/App.vue ', 123, 'src/App.vue'],
        commands: [' npm test ', null, 'npm test'],
        notes: [
          { id: 'note-1', createdAt: '2026-06-16T03:00:00.000Z', content: '  Logged progress  ' },
          { id: 'note-2', createdAt: '2026-06-16T04:00:00.000Z', content: '  ' }
        ],
        sensitive: true,
        createdAt: '2026-06-16T01:00:00.000Z',
        updatedAt: '2026-06-16T02:00:00.000Z'
      }
    ])

    expect(tasks).toEqual([
      {
        id: 'task-1',
        title: 'Existing task',
        status: 'doing',
        priority: 'high',
        type: 'feature',
        tags: ['app', 'ai'],
        description: 'Details',
        projectName: 'LocalTodo',
        repoPath: 'G:/Zhao/nu11cat/LocalTodo',
        gitBranch: 'feature/migrate-branch',
        githubIssueUrl: 'https://github.com/Nu11Cat/LocalTodo/issues/12',
        githubPullRequestUrl: 'https://github.com/Nu11Cat/LocalTodo/pull/34',
        relatedFiles: ['src/App.vue'],
        commands: ['npm test'],
        notes: [{ id: 'note-1', createdAt: '2026-06-16T03:00:00.000Z', content: 'Logged progress' }],
        sensitive: true,
        createdAt: '2026-06-16T01:00:00.000Z',
        updatedAt: '2026-06-16T02:00:00.000Z'
      }
    ])
  })

  it('drops invalid entries and non-array values', () => {
    expect(migrateStoredTasks(null)).toEqual([])
    expect(
      migrateStoredTasks([
        null,
        { id: 'missing-title', status: 'todo', createdAt: '2026-06-16T01:00:00.000Z' },
        {
          id: 'valid',
          title: 'Valid task',
          status: 'review',
          createdAt: '2026-06-16T02:00:00.000Z'
        }
      ])
    ).toEqual([
      {
        id: 'valid',
        title: 'Valid task',
        status: 'review',
        priority: 'medium',
        type: 'chore',
        tags: [],
        description: '',
        relatedFiles: [],
        commands: [],
        notes: [],
        sensitive: false,
        createdAt: '2026-06-16T02:00:00.000Z',
        updatedAt: '2026-06-16T02:00:00.000Z'
      }
    ])
  })

  it('preserves valid custom statuses and types', () => {
    const tasks = migrateStoredTasks([
      {
        id: 'custom-1',
        title: 'Ship from QA',
        status: 'custom-done:Released',
        type: 'custom:Ops',
        createdAt: '2026-06-16T01:00:00.000Z'
      }
    ])

    expect(tasks[0]).toMatchObject({
      status: 'custom-done:Released',
      type: 'custom:Ops'
    })
  })

  it('preserves valid due dates and drops invalid calendar dates', () => {
    const tasks = migrateStoredTasks([
      {
        id: 'due-1',
        title: 'Valid deadline',
        status: 'todo',
        dueAt: '2026-08-15',
        createdAt: '2026-07-31T01:00:00.000Z'
      },
      {
        id: 'due-2',
        title: 'Invalid deadline',
        status: 'todo',
        dueAt: '2026-02-30',
        createdAt: '2026-07-31T01:00:00.000Z'
      }
    ])

    expect(tasks[0].dueAt).toBe('2026-08-15')
    expect(tasks[1].dueAt).toBeUndefined()
  })
})
