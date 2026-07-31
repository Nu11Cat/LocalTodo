import { describe, expect, it, vi } from 'vitest'
import {
  collectTaskStatuses,
  collectTaskTypes,
  createCustomTaskStatus,
  createCustomTaskType,
  createTask,
  createTaskNote,
  getTaskDueState,
  isTaskActive,
  isTaskDone,
  isTaskStatus,
  isTaskType,
  parseCustomTaskStatus,
  parseCustomTaskType,
  sanitizeTaskDueDate,
  sanitizeTaskNotes,
  toggleTaskDone
} from './taskModel'

describe('taskModel', () => {
  it('creates tasks with MVP defaults', () => {
    const task = createTask({ title: 'Write tests', createdAt: '2026-06-16T01:00:00.000Z' })

    expect(task).toMatchObject({
      title: 'Write tests',
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
    })
    expect(task.id).toBeTruthy()
  })

  it('creates sensitive tasks when requested', () => {
    const task = createTask({ title: 'Private plan', sensitive: true })

    expect(task.sensitive).toBe(true)
  })

  it('trims and deduplicates project metadata', () => {
    const task = createTask({
      title: 'Bind project',
      projectName: '  LocalTodo  ',
      repoPath: '  G:/Zhao/nu11cat/LocalTodo  ',
      gitBranch: '  feature/task-branch  ',
      githubIssueUrl: '  https://github.com/Nu11Cat/LocalTodo/issues/12  ',
      githubPullRequestUrl: '  https://github.com/Nu11Cat/LocalTodo/pull/34  ',
      relatedFiles: ['', ' src/App.vue ', 'src/App.vue', 'src/main.ts'],
      commands: [' npm test ', 'npm test', '', 'npm run typecheck']
    })

    expect(task).toMatchObject({
      projectName: 'LocalTodo',
      repoPath: 'G:/Zhao/nu11cat/LocalTodo',
      gitBranch: 'feature/task-branch',
      githubIssueUrl: 'https://github.com/Nu11Cat/LocalTodo/issues/12',
      githubPullRequestUrl: 'https://github.com/Nu11Cat/LocalTodo/pull/34',
      relatedFiles: ['src/App.vue', 'src/main.ts'],
      commands: ['npm test', 'npm run typecheck']
    })
  })

  it('omits empty optional project metadata', () => {
    const task = createTask({
      title: 'No project',
      projectName: ' ',
      repoPath: '',
      gitBranch: ' ',
      githubIssueUrl: '',
      githubPullRequestUrl: ' '
    })

    expect(task.projectName).toBeUndefined()
    expect(task.repoPath).toBeUndefined()
    expect(task.gitBranch).toBeUndefined()
    expect(task.githubIssueUrl).toBeUndefined()
    expect(task.githubPullRequestUrl).toBeUndefined()
  })

  it('sanitizes notes, dropping blank content and preserving valid entries', () => {
    const task = createTask({
      title: 'With notes',
      notes: [
        { id: 'note-1', createdAt: '2026-06-16T03:00:00.000Z', content: '  Did the thing  ' },
        { id: 'note-2', createdAt: '2026-06-16T04:00:00.000Z', content: '   ' },
        { content: 'No id or timestamp' }
      ] as never
    })

    expect(task.notes).toHaveLength(2)
    expect(task.notes[0]).toMatchObject({
      id: 'note-1',
      createdAt: '2026-06-16T03:00:00.000Z',
      content: 'Did the thing'
    })
    expect(task.notes[1].content).toBe('No id or timestamp')
    expect(task.notes[1].id).toBeTruthy()
    expect(task.notes[1].createdAt).toBeTruthy()
  })

  it('ignores non-array note input', () => {
    expect(sanitizeTaskNotes('nope')).toEqual([])
    expect(sanitizeTaskNotes(undefined)).toEqual([])
  })

  it('creates a trimmed note with id and timestamp', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-16T05:00:00.000Z'))

    const note = createTaskNote('  next step: review refresh logic  ')

    expect(note.content).toBe('next step: review refresh logic')
    expect(note.createdAt).toBe('2026-06-16T05:00:00.000Z')
    expect(note.id).toBeTruthy()

    vi.useRealTimers()
  })

  it('detects active and completed tasks', () => {
    const task = createTask({ title: 'Review docs' })
    const completedTask = createTask({ title: 'Ship docs', status: 'done' })

    expect(isTaskActive(task)).toBe(true)
    expect(isTaskDone(task)).toBe(false)
    expect(isTaskActive(completedTask)).toBe(false)
    expect(isTaskDone(completedTask)).toBe(true)
  })

  it('toggles done status and updates timestamp', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-16T03:00:00.000Z'))

    const task = createTask({
      title: 'Toggle me',
      createdAt: '2026-06-16T01:00:00.000Z',
      updatedAt: '2026-06-16T01:00:00.000Z'
    })

    const completedTask = toggleTaskDone(task)
    const activeTask = toggleTaskDone(completedTask)

    expect(completedTask.status).toBe('done')
    expect(completedTask.updatedAt).toBe('2026-06-16T03:00:00.000Z')
    expect(activeTask.status).toBe('todo')

    vi.useRealTimers()
  })

  it('creates portable custom statuses with completion semantics', () => {
    const activeStatus = createCustomTaskStatus('  QA in progress  ')
    const completedStatus = createCustomTaskStatus('Released', true)

    expect(activeStatus).toBe('custom-active:QA in progress')
    expect(completedStatus).toBe('custom-done:Released')
    expect(parseCustomTaskStatus(activeStatus!)).toEqual({
      label: 'QA in progress',
      completed: false
    })
    expect(isTaskStatus(activeStatus)).toBe(true)
    expect(isTaskDone(createTask({ title: 'Released task', status: completedStatus! }))).toBe(true)
  })

  it('creates portable custom types and rejects malformed custom values', () => {
    const taskType = createCustomTaskType('  Prompt design  ')

    expect(taskType).toBe('custom:Prompt design')
    expect(parseCustomTaskType(taskType!)).toEqual({ label: 'Prompt design' })
    expect(isTaskType(taskType)).toBe(true)
    expect(isTaskStatus('custom-active:')).toBe(false)
    expect(isTaskType('custom:   ')).toBe(false)
  })

  it('collects custom status and type values used by tasks', () => {
    const tasks = [
      createTask({ title: 'Built in' }),
      createTask({
        title: 'Custom',
        status: 'custom-active:QA',
        type: 'custom:Ops'
      })
    ]

    expect(collectTaskStatuses(tasks)).toEqual([
      'inbox',
      'todo',
      'doing',
      'blocked',
      'review',
      'done',
      'custom-active:QA'
    ])
    expect(collectTaskTypes(tasks)).toEqual([
      'feature',
      'bug',
      'refactor',
      'research',
      'chore',
      'deploy',
      'review',
      'custom:Ops'
    ])
  })

  it('validates calendar due dates and classifies active deadlines', () => {
    expect(sanitizeTaskDueDate('2026-02-28')).toBe('2026-02-28')
    expect(sanitizeTaskDueDate('2026-02-29')).toBeUndefined()
    expect(sanitizeTaskDueDate('2026-2-03')).toBeUndefined()

    expect(getTaskDueState(createTask({ title: 'Late', dueAt: '2026-07-30' }), '2026-07-31')).toBe(
      'overdue'
    )
    expect(getTaskDueState(createTask({ title: 'Today', dueAt: '2026-07-31' }), '2026-07-31')).toBe(
      'today'
    )
    expect(getTaskDueState(createTask({ title: 'Next', dueAt: '2026-08-01' }), '2026-07-31')).toBe(
      'upcoming'
    )
    expect(
      getTaskDueState(createTask({ title: 'Done', status: 'done', dueAt: '2026-07-01' }), '2026-07-31')
    ).toBe('completed')
  })

  it('drops invalid due dates when creating a task', () => {
    expect(createTask({ title: 'Invalid', dueAt: '2026-13-01' }).dueAt).toBeUndefined()
  })
})
