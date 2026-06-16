import { describe, expect, it, vi } from 'vitest'
import { createDataFile, parseDataFile, parseDataFileText, serializeDataFile } from './dataFile'
import type { Task } from './taskModel'

const task: Task = {
  id: 'task-1',
  title: 'Export data',
  status: 'todo',
  priority: 'medium',
  type: 'chore',
  tags: [],
  description: '',
  relatedFiles: [],
  commands: [],
  createdAt: '2026-06-16T01:00:00.000Z',
  updatedAt: '2026-06-16T02:00:00.000Z'
}

describe('dataFile', () => {
  it('creates schema versioned data files', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-16T03:00:00.000Z'))

    expect(createDataFile([task])).toEqual({
      schemaVersion: 1,
      exportedAt: '2026-06-16T03:00:00.000Z',
      tasks: [task]
    })

    vi.useRealTimers()
  })

  it('serializes data files as pretty JSON', () => {
    const text = serializeDataFile([task])
    const data = JSON.parse(text)

    expect(text.endsWith('\n')).toBe(true)
    expect(data.schemaVersion).toBe(1)
    expect(data.tasks).toEqual([task])
  })

  it('parses schema versioned data files', () => {
    expect(
      parseDataFile({
        schemaVersion: 1,
        exportedAt: '2026-06-16T03:00:00.000Z',
        tasks: [task]
      })
    ).toEqual([task])
  })

  it('round-trips project and repository metadata', () => {
    const taskWithProject: Task = {
      ...task,
      projectName: 'LocalTodo',
      repoPath: 'G:/Zhao/nu11cat/LocalTodo',
      relatedFiles: ['src/renderer/src/App.vue'],
      commands: ['npm test']
    }

    expect(parseDataFileText(serializeDataFile([taskWithProject]))).toEqual([taskWithProject])
  })

  it('rejects invalid JSON and unsupported schemas', () => {
    expect(parseDataFileText('{')).toBeNull()
    expect(parseDataFile({ schemaVersion: 2, tasks: [task] })).toBeNull()
    expect(parseDataFile({ schemaVersion: 1, tasks: 'invalid' })).toBeNull()
  })

  it('normalizes imported task entries', () => {
    expect(
      parseDataFile({
        schemaVersion: 1,
        exportedAt: '2026-06-16T03:00:00.000Z',
        tasks: [
          {
            id: 'legacy-1',
            title: 'Legacy imported todo',
            completed: true,
            createdAt: '2026-06-16T01:00:00.000Z'
          }
        ]
      })
    ).toEqual([
      {
        id: 'legacy-1',
        title: 'Legacy imported todo',
        status: 'done',
        priority: 'medium',
        type: 'chore',
        tags: [],
        description: '',
        relatedFiles: [],
        commands: [],
        createdAt: '2026-06-16T01:00:00.000Z',
        updatedAt: '2026-06-16T01:00:00.000Z'
      }
    ])
  })
})
