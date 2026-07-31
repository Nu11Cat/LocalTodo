import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createEmptyTaskFilterState,
  filterTasks,
  isTaskFilterStateEmpty,
  matchesTaskFilter,
  type TaskFilterState
} from './taskFilter'
import type { Task } from './taskModel'

const baseTask: Task = {
  id: 'task-1',
  title: 'Build search filters',
  status: 'todo',
  priority: 'medium',
  type: 'feature',
  tags: ['AI', 'frontend'],
  description: 'Add keyword search to task descriptions.',
  projectName: 'LocalTodo',
  repoPath: 'G:/Zhao/nu11cat/LocalTodo',
  gitBranch: 'feature/search-branch',
  githubIssueUrl: 'https://github.com/Nu11Cat/LocalTodo/issues/12',
  githubPullRequestUrl: 'https://github.com/Nu11Cat/LocalTodo/pull/34',
  relatedFiles: ['src/renderer/src/App.vue'],
  commands: ['npm run dev'],
  notes: [],
  sensitive: false,
  createdAt: '2026-06-16T01:00:00.000Z',
  updatedAt: '2026-06-16T02:00:00.000Z'
}

function filter(overrides: Partial<TaskFilterState>): TaskFilterState {
  return {
    ...createEmptyTaskFilterState(),
    ...overrides
  }
}

describe('taskFilter', () => {
  afterEach(() => {
    vi.useRealTimers()
  })
  it('treats empty filters as inactive and returns the input array', () => {
    const tasks = [baseTask]
    const state = createEmptyTaskFilterState()

    expect(isTaskFilterStateEmpty(state)).toBe(true)
    expect(filterTasks(tasks, state)).toBe(tasks)
  })

  it('matches keyword tokens against title, description, and tags case-insensitively', () => {
    expect(matchesTaskFilter(baseTask, filter({ keyword: 'build descriptions' }))).toBe(true)
    expect(matchesTaskFilter(baseTask, filter({ keyword: 'FRONTEND search' }))).toBe(true)
    expect(matchesTaskFilter(baseTask, filter({ keyword: 'localtodo' }))).toBe(true)
    expect(matchesTaskFilter(baseTask, filter({ keyword: 'App.vue' }))).toBe(true)
    expect(matchesTaskFilter(baseTask, filter({ keyword: 'npm dev' }))).toBe(true)
    expect(matchesTaskFilter(baseTask, filter({ keyword: 'search-branch' }))).toBe(true)
    expect(matchesTaskFilter(baseTask, filter({ keyword: 'issues/12 pull/34' }))).toBe(true)
    expect(matchesTaskFilter(baseTask, filter({ keyword: 'missing search' }))).toBe(false)
  })

  it('filters by status, priority, and type', () => {
    expect(matchesTaskFilter(baseTask, filter({ statuses: ['todo'] }))).toBe(true)
    expect(matchesTaskFilter(baseTask, filter({ statuses: ['done'] }))).toBe(false)
    expect(matchesTaskFilter(baseTask, filter({ priorities: ['medium', 'high'] }))).toBe(true)
    expect(matchesTaskFilter(baseTask, filter({ priorities: ['urgent'] }))).toBe(false)
    expect(matchesTaskFilter(baseTask, filter({ types: ['feature'] }))).toBe(true)
    expect(matchesTaskFilter(baseTask, filter({ types: ['bug'] }))).toBe(false)
  })

  it('filters by tags using case-insensitive AND semantics', () => {
    expect(matchesTaskFilter(baseTask, filter({ tags: ['ai'] }))).toBe(true)
    expect(matchesTaskFilter(baseTask, filter({ tags: ['ai', 'FRONTEND'] }))).toBe(true)
    expect(matchesTaskFilter(baseTask, filter({ tags: ['ai', 'backend'] }))).toBe(false)
  })

  it('defaults tagMatchMode to all and matches any when requested', () => {
    expect(createEmptyTaskFilterState().tagMatchMode).toBe('all')
    expect(matchesTaskFilter(baseTask, filter({ tags: ['ai', 'backend'], tagMatchMode: 'any' }))).toBe(
      true
    )
    expect(matchesTaskFilter(baseTask, filter({ tags: ['backend', 'devops'], tagMatchMode: 'any' }))).toBe(
      false
    )
    expect(matchesTaskFilter(baseTask, filter({ tags: ['ai', 'backend'], tagMatchMode: 'all' }))).toBe(
      false
    )
  })

  it('ignores tagMatchMode when deciding if filters are empty', () => {
    expect(isTaskFilterStateEmpty(filter({ tagMatchMode: 'any' }))).toBe(true)
  })

  it('filters by project key', () => {
    expect(matchesTaskFilter(baseTask, filter({ projects: ['LocalTodo\nG:/Zhao/nu11cat/LocalTodo'] }))).toBe(
      true
    )
    expect(matchesTaskFilter(baseTask, filter({ projects: ['Other\nG:/other'] }))).toBe(false)
    expect(matchesTaskFilter({ ...baseTask, projectName: undefined, repoPath: undefined }, filter({ projects: ['\n'] }))).toBe(true)
    expect(isTaskFilterStateEmpty(filter({ projects: ['LocalTodo\nG:/Zhao/nu11cat/LocalTodo'] }))).toBe(false)
  })

  it('combines filter facets with AND semantics', () => {
    const tasks: Task[] = [
      baseTask,
      {
        ...baseTask,
        id: 'task-2',
        title: 'Fix storage bug',
        status: 'doing',
        priority: 'high',
        type: 'bug',
        tags: ['backend']
      }
    ]

    expect(
      filterTasks(
        tasks,
        filter({ keyword: 'search', statuses: ['todo'], priorities: ['medium'], tags: ['frontend'] })
      )
    ).toEqual([baseTask])
  })

  it('filters overdue active tasks using the local calendar date', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 6, 31, 12, 0, 0))
    const overdueTask = { ...baseTask, dueAt: '2026-07-30' }
    const dueTodayTask = { ...baseTask, id: 'today', dueAt: '2026-07-31' }
    const completedLateTask = { ...baseTask, id: 'done', status: 'done' as const, dueAt: '2026-07-01' }

    expect(filterTasks([overdueTask, dueTodayTask, completedLateTask], filter({ due: 'overdue' }))).toEqual([
      overdueTask
    ])
  })
})
