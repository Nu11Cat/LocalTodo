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
})
