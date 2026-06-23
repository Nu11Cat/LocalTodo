import { describe, expect, it, vi } from 'vitest'
import {
  createTask,
  createTaskNote,
  isTaskActive,
  isTaskDone,
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
      relatedFiles: ['', ' src/App.vue ', 'src/App.vue', 'src/main.ts'],
      commands: [' npm test ', 'npm test', '', 'npm run typecheck']
    })

    expect(task).toMatchObject({
      projectName: 'LocalTodo',
      repoPath: 'G:/Zhao/nu11cat/LocalTodo',
      relatedFiles: ['src/App.vue', 'src/main.ts'],
      commands: ['npm test', 'npm run typecheck']
    })
  })

  it('omits empty optional project metadata', () => {
    const task = createTask({ title: 'No project', projectName: ' ', repoPath: '' })

    expect(task.projectName).toBeUndefined()
    expect(task.repoPath).toBeUndefined()
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
})
