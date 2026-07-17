import { nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useTodos } from './useTodos'
import { useLocale } from './useLocale'

const storage = new Map<string, string>()
const fileStorage = new Map<string, string>()

function flushPromises(): Promise<void> {
  // Flush microtasks enough times for async saveData to resolve.
  return Promise.resolve().then(() => Promise.resolve()).then(() => Promise.resolve())
}

function createMockApi() {
  return {
    platform: 'win32',
    exportProjectAiContext: vi.fn().mockResolvedValue({ status: 'written', filePath: 'AI_CONTEXT.md' }),
    openExportedAiContextFile: vi.fn().mockResolvedValue({ status: 'opened' }),
    revealExportedAiContextFile: vi.fn().mockResolvedValue({ status: 'revealed' }),
    exportLocalTodoProject: vi.fn().mockResolvedValue({
      status: 'written',
      dirPath: 'G:/repo/.localtodo',
      aiContextFilePath: 'G:/repo/.localtodo/AI_CONTEXT.md',
      tasksJsonFilePath: 'G:/repo/.localtodo/tasks.json',
      taskFilePaths: ['G:/repo/.localtodo/tasks/task_task-id.md'],
      staleTaskFiles: [],
      gitignore: {
        status: 'not-requested',
        filePath: 'G:/repo/.gitignore',
        entries: ['.localtodo/tasks.json', '.localtodo/AI_CONTEXT.md', '.localtodo/tasks/']
      },
      excludedSensitiveCount: 0
    }),
    cleanupStaleLocalTodoTaskFiles: vi
      .fn()
      .mockResolvedValue({ status: 'deleted', deletedFileNames: [] }),
    loadData: vi.fn().mockImplementation((): Promise<{ status: 'ok'; data: string } | { status: 'missing' }> => {
      if (fileStorage.has('data.json')) {
        return Promise.resolve({ status: 'ok', data: fileStorage.get('data.json')! })
      }

      return Promise.resolve({ status: 'missing' })
    }),
    saveData: vi.fn().mockImplementation((payload: string): Promise<{ status: 'saved' }> => {
      fileStorage.set('data.json', payload)
      return Promise.resolve({ status: 'saved' })
    }),
    getDataFileInfo: vi.fn().mockImplementation(() => {
      if (fileStorage.has('data.json')) {
        return Promise.resolve({
          status: 'ok' as const,
          filePath: 'G:/LocalTodo/data.json',
          exists: true as const,
          size: Buffer.byteLength(fileStorage.get('data.json')!, 'utf8'),
          modifiedAtMs: 1_700_000_000_000
        })
      }

      return Promise.resolve({
        status: 'ok' as const,
        filePath: 'G:/LocalTodo/data.json',
        exists: false as const
      })
    }),
    revealDataFile: vi.fn().mockResolvedValue({ status: 'revealed' }),
    openDataFile: vi.fn().mockResolvedValue({ status: 'opened' }),
    createImportRestorePoint: vi.fn().mockResolvedValue({
      status: 'written',
      filePath: 'G:/LocalTodo/restore-points/localtodo-before-import.json'
    }),
    selectDirectory: vi.fn().mockResolvedValue({ status: 'selected', dirPath: 'G:/picked/repo' })
  }
}

beforeEach(() => {
  storage.clear()
  fileStorage.clear()
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
  vi.setSystemTime(new Date('2026-06-16T00:00:00.000Z'))
  vi.stubGlobal('localStorage', {
    getItem: vi.fn((key: string) => storage.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => storage.set(key, value)),
    removeItem: vi.fn((key: string) => storage.delete(key)),
    clear: vi.fn(() => storage.clear())
  })
  vi.stubGlobal('navigator', {
    clipboard: {
      writeText: vi.fn().mockResolvedValue(undefined)
    }
  })
  vi.stubGlobal('window', {
    api: createMockApi()
  })
  // Pin the i18n locale so message assertions are independent of the host's
  // system language (navigator.language seeds the locale singleton on first use).
  useLocale().setLocale('en')
})

afterEach(() => {
  vi.useRealTimers()
})

async function advanceSaveDebounce(): Promise<void> {
  vi.advanceTimersByTime(400)
  await flushPromises()
  await nextTick()
}

describe('useTodos', () => {
  it('adds a task from the draft title', async () => {
    const todos = useTodos()
    await todos.loaded

    todos.draftTitle.value = 'Buy milk'
    todos.addTodo()

    expect(todos.todos.value).toHaveLength(1)
    expect(todos.todos.value[0]).toMatchObject({
      title: 'Buy milk',
      status: 'todo',
      priority: 'medium',
      type: 'chore',
      tags: [],
      description: '',
      relatedFiles: [],
      commands: [],
      sensitive: false
    })
    expect(todos.draftTitle.value).toBe('')
  })

  it('does not add blank tasks', async () => {
    const todos = useTodos()
    await todos.loaded

    todos.draftTitle.value = '   '
    todos.addTodo()

    expect(todos.todos.value).toHaveLength(0)
  })

  it('prefills a new task from the selected template', async () => {
    const todos = useTodos()
    await todos.loaded

    todos.selectedTemplateId.value = 'bug'
    todos.draftTitle.value = 'Crash on launch'
    todos.addTodo()

    expect(todos.todos.value).toHaveLength(1)
    expect(todos.todos.value[0]).toMatchObject({
      title: 'Crash on launch',
      type: 'bug',
      priority: 'high',
      tags: ['bug'],
      commands: ['npm test']
    })
    expect(todos.todos.value[0].description).toContain('Steps to reproduce')
    expect(todos.selectedTodoId.value).toBe(todos.todos.value[0].id)
    expect(todos.selectedTemplateId.value).toBe('bug')
  })

  it('creates a title-only task for the blank template', async () => {
    const todos = useTodos()
    await todos.loaded

    todos.selectedTemplateId.value = 'blank'
    todos.draftTitle.value = 'Plain task'
    todos.addTodo()

    expect(todos.todos.value[0]).toMatchObject({
      title: 'Plain task',
      type: 'chore',
      description: '',
      tags: [],
      commands: []
    })
  })

  it('toggles tasks between active and completed lists', async () => {
    const todos = useTodos()
    await todos.loaded

    todos.draftTitle.value = 'Ship feature'
    todos.addTodo()

    const taskId = todos.todos.value[0].id

    expect(todos.activeTodos.value).toHaveLength(1)
    expect(todos.completedTodos.value).toHaveLength(0)

    todos.toggleTodo(taskId)

    expect(todos.todos.value[0].status).toBe('done')
    expect(todos.activeTodos.value).toHaveLength(0)
    expect(todos.completedTodos.value).toHaveLength(1)

    todos.toggleTodo(taskId)

    expect(todos.todos.value[0].status).toBe('todo')
    expect(todos.activeTodos.value).toHaveLength(1)
    expect(todos.completedTodos.value).toHaveLength(0)
  })

  it('clears completed tasks', async () => {
    const todos = useTodos()
    await todos.loaded

    todos.draftTitle.value = 'Keep this'
    todos.addTodo()
    todos.draftTitle.value = 'Clear this'
    todos.addTodo()

    todos.toggleTodo(todos.todos.value[0].id)
    todos.clearCompleted()

    expect(todos.todos.value).toHaveLength(1)
    expect(todos.todos.value[0].title).toBe('Keep this')
  })

  it('clears completed tasks without deleting active tasks hidden by filters', async () => {
    const todos = useTodos()
    await todos.loaded

    todos.draftTitle.value = 'Visible active'
    todos.addTodo()
    todos.draftTitle.value = 'Hidden active'
    todos.addTodo()
    todos.draftTitle.value = 'Completed task'
    todos.addTodo()
    todos.toggleTodo(todos.todos.value[0].id)

    todos.setFilterKeyword('Visible')
    todos.clearCompleted()

    expect(todos.todos.value.map((todo) => todo.title)).toEqual(['Hidden active', 'Visible active'])
  })

  it('loads tasks from file storage', async () => {
    fileStorage.set(
      'data.json',
      JSON.stringify({
        schemaVersion: 1,
        exportedAt: '2026-06-16T03:00:00.000Z',
        tasks: [
          {
            id: 'loaded-task',
            title: 'Loaded task',
            status: 'doing',
            priority: 'high',
            type: 'feature',
            tags: ['loaded'],
            description: 'Loaded description',
            projectName: 'LocalTodo',
            repoPath: 'G:/Zhao/nu11cat/LocalTodo',
            relatedFiles: ['src/renderer/src/App.vue'],
            commands: ['npm test'],
            createdAt: '2026-06-16T01:00:00.000Z',
            updatedAt: '2026-06-16T02:00:00.000Z'
          }
        ]
      })
    )

    const todos = useTodos()
    await todos.loaded

    expect(todos.todos.value).toEqual([
      {
        id: 'loaded-task',
        title: 'Loaded task',
        status: 'doing',
        priority: 'high',
        type: 'feature',
        tags: ['loaded'],
        description: 'Loaded description',
        projectName: 'LocalTodo',
        repoPath: 'G:/Zhao/nu11cat/LocalTodo',
        relatedFiles: ['src/renderer/src/App.vue'],
        commands: ['npm test'],
        notes: [],
        sensitive: false,
        createdAt: '2026-06-16T01:00:00.000Z',
        updatedAt: '2026-06-16T02:00:00.000Z'
      }
    ])
  })

  it('migrates legacy todos from localStorage when data file is missing', async () => {
    storage.set(
      'localtodo.todos',
      JSON.stringify([
        {
          id: 'legacy-open',
          title: 'Old open todo',
          completed: false,
          createdAt: '2026-06-16T01:00:00.000Z'
        },
        {
          id: 'legacy-done',
          title: 'Old completed todo',
          completed: true,
          createdAt: '2026-06-16T02:00:00.000Z'
        }
      ])
    )

    const todos = useTodos()
    await todos.loaded

    expect(todos.todos.value).toEqual([
      {
        id: 'legacy-open',
        title: 'Old open todo',
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
      },
      {
        id: 'legacy-done',
        title: 'Old completed todo',
        status: 'done',
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
    expect(window.api.saveData).toHaveBeenCalledWith(expect.stringContaining('"Old open todo"'))
    expect(window.api.saveData).toHaveBeenCalledWith(expect.stringContaining('"Old completed todo"'))
    expect(storage.get('localtodo.todos')).toBeUndefined()
  })

  it('keeps legacy localStorage when migration save fails', async () => {
    storage.set(
      'localtodo.todos',
      JSON.stringify([
        {
          id: 'legacy-open',
          title: 'Old open todo',
          completed: false,
          createdAt: '2026-06-16T01:00:00.000Z'
        }
      ])
    )
    vi.mocked(window.api.saveData).mockResolvedValue({ status: 'error', message: 'Disk full' })

    const todos = useTodos()
    await todos.loaded

    expect(todos.todos.value).toHaveLength(1)
    expect(storage.get('localtodo.todos')).toContain('Old open todo')
  })

  it('does not overwrite an unreadable data file with an empty task list', async () => {
    fileStorage.set('data.json', '{not-json')

    const todos = useTodos()
    await todos.loaded
    await nextTick()
    await advanceSaveDebounce()

    expect(todos.todos.value).toEqual([])
    expect(todos.loadErrorMessage.value).toBe(
      'Saved data could not be read. Your existing data file was left unchanged.'
    )
    expect(window.api.saveData).not.toHaveBeenCalled()
    expect(fileStorage.get('data.json')).toBe('{not-json')
  })

  it('starts empty when both file and localStorage are missing', async () => {
    const todos = useTodos()
    await todos.loaded

    expect(todos.todos.value).toEqual([])
    expect(window.api.saveData).not.toHaveBeenCalled()
  })

  it('does not add tasks before saved data finishes loading', async () => {
    const todos = useTodos()

    todos.draftTitle.value = 'Too early'
    todos.addTodo()

    await todos.loaded

    expect(todos.todos.value).toEqual([])
  })

  it('persists added tasks to file storage', async () => {
    const todos = useTodos()
    await todos.loaded

    todos.draftTitle.value = 'Persist this'
    todos.addTodo()
    await nextTick()

    expect(window.api.saveData).not.toHaveBeenCalled()

    await advanceSaveDebounce()

    expect(window.api.saveData).toHaveBeenCalledWith(expect.stringContaining('"Persist this"'))

    const data = JSON.parse(fileStorage.get('data.json') ?? '{}')

    expect(data.schemaVersion).toBe(1)
    expect(data.tasks[0]).toMatchObject({
      title: 'Persist this',
      status: 'todo',
      priority: 'medium',
      type: 'chore'
    })
  })

  it('selects a task and updates editable fields', async () => {
    const todos = useTodos()
    await todos.loaded

    todos.draftTitle.value = 'Edit me'
    todos.addTodo()

    const taskId = todos.todos.value[0].id
    todos.selectTodo(taskId)

    expect(todos.selectedTodoId.value).toBe(taskId)
    expect(todos.selectedTodo.value?.title).toBe('Edit me')

    const result = todos.updateTodo(taskId, {
      status: 'doing',
      priority: 'high',
      type: 'feature',
      tags: ['ui', 'ai'],
      description: '## Context\n\nEditable task details.',
      projectName: ' LocalTodo ',
      repoPath: ' G:/Zhao/nu11cat/LocalTodo ',
      gitBranch: ' feature/task-branch ',
      githubIssueUrl: ' https://github.com/Nu11Cat/LocalTodo/issues/12 ',
      githubPullRequestUrl: ' https://github.com/Nu11Cat/LocalTodo/pull/34 ',
      relatedFiles: [' src/renderer/src/App.vue ', 'src/renderer/src/App.vue'],
      commands: [' npm test ', 'npm test']
    })

    expect(result).toBe(true)
    expect(todos.selectedTodo.value).toMatchObject({
      status: 'doing',
      priority: 'high',
      type: 'feature',
      tags: ['ui', 'ai'],
      description: '## Context\n\nEditable task details.',
      projectName: 'LocalTodo',
      repoPath: 'G:/Zhao/nu11cat/LocalTodo',
      gitBranch: 'feature/task-branch',
      githubIssueUrl: 'https://github.com/Nu11Cat/LocalTodo/issues/12',
      githubPullRequestUrl: 'https://github.com/Nu11Cat/LocalTodo/pull/34',
      relatedFiles: ['src/renderer/src/App.vue'],
      commands: ['npm test'],
      sensitive: false
    })

    todos.updateTodo(taskId, { sensitive: true })

    expect(todos.selectedTodo.value?.sensitive).toBe(true)
  })

  it('clears optional project metadata with null patches', async () => {
    const todos = useTodos()
    await todos.loaded

    todos.draftTitle.value = 'Clear project'
    todos.addTodo()
    const taskId = todos.todos.value[0].id

    todos.updateTodo(taskId, {
      projectName: 'LocalTodo',
      repoPath: 'G:/repo',
      gitBranch: 'feature/clear-me',
      githubIssueUrl: 'https://github.com/Nu11Cat/LocalTodo/issues/12',
      githubPullRequestUrl: 'https://github.com/Nu11Cat/LocalTodo/pull/34'
    })
    todos.updateTodo(taskId, {
      projectName: null,
      repoPath: null,
      gitBranch: null,
      githubIssueUrl: null,
      githubPullRequestUrl: null
    })

    expect(todos.todos.value[0].projectName).toBeUndefined()
    expect(todos.todos.value[0].repoPath).toBeUndefined()
    expect(todos.todos.value[0].gitBranch).toBeUndefined()
    expect(todos.todos.value[0].githubIssueUrl).toBeUndefined()
    expect(todos.todos.value[0].githubPullRequestUrl).toBeUndefined()
  })

  it('updates timestamps when editing tasks', async () => {
    vi.setSystemTime(new Date('2026-06-16T05:00:00.000Z'))
    const todos = useTodos()
    await todos.loaded

    todos.draftTitle.value = 'Timestamp me'
    todos.addTodo()
    const taskId = todos.todos.value[0].id

    vi.setSystemTime(new Date('2026-06-16T06:00:00.000Z'))
    todos.updateTodo(taskId, { description: 'Updated' })

    expect(todos.todos.value[0].updatedAt).toBe('2026-06-16T06:00:00.000Z')
  })

  it('returns false when updating a missing task', async () => {
    const todos = useTodos()
    await todos.loaded

    expect(todos.updateTodo('missing-task', { status: 'done' })).toBe(false)
    expect(todos.todos.value).toHaveLength(0)
  })

  it('appends activity log notes and removes them by id', async () => {
    vi.setSystemTime(new Date('2026-06-16T05:00:00.000Z'))
    const todos = useTodos()
    await todos.loaded

    todos.draftTitle.value = 'Track progress'
    todos.addTodo()
    const taskId = todos.todos.value[0].id

    vi.setSystemTime(new Date('2026-06-16T06:00:00.000Z'))
    expect(todos.addTaskNote(taskId, '  Started investigating login bug  ')).toBe(true)

    expect(todos.todos.value[0].notes).toHaveLength(1)
    expect(todos.todos.value[0].notes[0].content).toBe('Started investigating login bug')
    expect(todos.todos.value[0].notes[0].createdAt).toBe('2026-06-16T06:00:00.000Z')
    expect(todos.todos.value[0].updatedAt).toBe('2026-06-16T06:00:00.000Z')

    expect(todos.addTaskNote(taskId, '   ')).toBe(false)
    expect(todos.todos.value[0].notes).toHaveLength(1)

    todos.addTaskNote(taskId, 'Blocked on token refresh')
    expect(todos.todos.value[0].notes).toHaveLength(2)

    const firstNoteId = todos.todos.value[0].notes[0].id
    expect(todos.removeTaskNote(taskId, firstNoteId)).toBe(true)
    expect(todos.todos.value[0].notes).toHaveLength(1)
    expect(todos.todos.value[0].notes[0].content).toBe('Blocked on token refresh')

    expect(todos.removeTaskNote(taskId, 'missing-note')).toBe(false)
    expect(todos.addTaskNote('missing-task', 'note')).toBe(false)
  })

  it('moves tasks between computed lists when status is updated', async () => {
    const todos = useTodos()
    await todos.loaded

    todos.draftTitle.value = 'Move me'
    todos.addTodo()
    const taskId = todos.todos.value[0].id

    todos.updateTodo(taskId, { status: 'done' })

    expect(todos.activeTodos.value).toHaveLength(0)
    expect(todos.completedTodos.value).toHaveLength(1)

    todos.updateTodo(taskId, { status: 'doing' })

    expect(todos.activeTodos.value).toHaveLength(1)
    expect(todos.completedTodos.value).toHaveLength(0)
  })

  it('clears selection when removing the selected task', async () => {
    const todos = useTodos()
    await todos.loaded

    todos.draftTitle.value = 'Remove selected'
    todos.addTodo()
    const taskId = todos.todos.value[0].id
    todos.selectTodo(taskId)

    todos.removeTodo(taskId)

    expect(todos.selectedTodoId.value).toBeNull()
    expect(todos.selectedTodo.value).toBeNull()
  })

  it('persists updated fields to file storage', async () => {
    const todos = useTodos()
    await todos.loaded

    todos.draftTitle.value = 'Persist edited fields'
    todos.addTodo()
    todos.updateTodo(todos.todos.value[0].id, {
      priority: 'urgent',
      type: 'bug',
      tags: ['persisted'],
      description: 'Saved details',
      projectName: 'LocalTodo',
      repoPath: 'G:/Zhao/nu11cat/LocalTodo',
      relatedFiles: ['src/renderer/src/App.vue'],
      commands: ['npm test']
    })
    await nextTick()
    await advanceSaveDebounce()

    const data = JSON.parse(fileStorage.get('data.json') ?? '{}')

    expect(data.tasks[0]).toMatchObject({
      priority: 'urgent',
      type: 'bug',
      tags: ['persisted'],
      description: 'Saved details',
      projectName: 'LocalTodo',
      repoPath: 'G:/Zhao/nu11cat/LocalTodo',
      relatedFiles: ['src/renderer/src/App.vue'],
      commands: ['npm test']
    })
  })

  it('does not throw when file save fails', async () => {
    vi.mocked(window.api.saveData).mockResolvedValue({ status: 'error', message: 'Disk full' })
    const todos = useTodos()
    await todos.loaded

    todos.draftTitle.value = 'Unsaved task'
    todos.addTodo()
    await nextTick()

    await expect(advanceSaveDebounce()).resolves.not.toThrow()
    expect(todos.todos.value).toHaveLength(1)
  })

  it('serializes overlapping file saves in mutation order', async () => {
    const saveCalls: string[] = []
    let firstSaveResolved = false
    const firstSave = {
      resolve: undefined as undefined | ((result: { status: 'saved' }) => void)
    }
    vi.mocked(window.api.saveData).mockImplementation(
      (payload: string): Promise<{ status: 'saved' }> => {
        saveCalls.push(payload)

        if (saveCalls.length === 1) {
          return new Promise((resolve) => {
            firstSave.resolve = resolve
          })
        }

        expect(firstSaveResolved).toBe(true)
        return Promise.resolve({ status: 'saved' })
      }
    )
    const todos = useTodos()
    await todos.loaded

    todos.draftTitle.value = 'First save'
    todos.addTodo()
    await nextTick()
    vi.advanceTimersByTime(400)
    await flushPromises()

    todos.draftTitle.value = 'Second save'
    todos.addTodo()
    await nextTick()
    vi.advanceTimersByTime(400)
    await flushPromises()

    expect(saveCalls).toHaveLength(1)

    if (!firstSave.resolve) {
      throw new Error('First save was not started.')
    }

    firstSaveResolved = true
    firstSave.resolve({ status: 'saved' })
    await flushPromises()

    expect(saveCalls).toHaveLength(2)
    expect(saveCalls[0]).toContain('"First save"')
    expect(saveCalls[0]).not.toContain('"Second save"')
    expect(saveCalls[1]).toContain('"First save"')
    expect(saveCalls[1]).toContain('"Second save"')
  })

  it('filters tasks by keyword and resets filters', async () => {
    const todos = useTodos()
    await todos.loaded

    todos.draftTitle.value = 'Buy milk'
    todos.addTodo()
    todos.draftTitle.value = 'Ship feature'
    todos.addTodo()

    expect(todos.hasActiveFilters.value).toBe(false)
    todos.setFilterKeyword('milk')

    expect(todos.hasActiveFilters.value).toBe(true)
    expect(todos.activeTodos.value.map((todo) => todo.title)).toEqual(['Buy milk'])

    todos.resetFilters()

    expect(todos.hasActiveFilters.value).toBe(false)
    expect(todos.activeTodos.value).toHaveLength(2)
  })

  it('toggles status, priority, and type filters', async () => {
    const todos = useTodos()
    await todos.loaded

    todos.draftTitle.value = 'Filter target'
    todos.addTodo()
    todos.updateTodo(todos.todos.value[0].id, {
      status: 'doing',
      priority: 'high',
      type: 'feature'
    })

    todos.toggleStatusFilter('doing')
    todos.togglePriorityFilter('high')
    todos.toggleTypeFilter('feature')

    expect(todos.activeTodos.value).toHaveLength(1)

    todos.toggleStatusFilter('done')

    expect(todos.activeTodos.value).toHaveLength(1)

    todos.toggleStatusFilter('doing')

    expect(todos.activeTodos.value).toHaveLength(0)

    todos.toggleStatusFilter('done')
    todos.togglePriorityFilter('high')
    todos.toggleTypeFilter('feature')

    expect(todos.hasActiveFilters.value).toBe(false)
  })

  it('filters by tags and lists available tags', async () => {
    const todos = useTodos()
    await todos.loaded

    todos.draftTitle.value = 'Alpha task'
    todos.addTodo()
    todos.updateTodo(todos.todos.value[0].id, { tags: ['AI', 'frontend'] })
    todos.draftTitle.value = 'Beta task'
    todos.addTodo()
    todos.updateTodo(todos.todos.value[0].id, { tags: ['ai', 'backend'] })

    expect(todos.availableTags.value).toEqual(['ai', 'backend', 'frontend'])

    todos.toggleTagFilter('ai')
    expect(todos.activeTodos.value).toHaveLength(2)

    todos.toggleTagFilter('frontend')
    expect(todos.activeTodos.value.map((todo) => todo.title)).toEqual(['Alpha task'])
  })

  it('matches any selected tag when tagMatchMode is any', async () => {
    const todos = useTodos()
    await todos.loaded

    todos.draftTitle.value = 'Alpha task'
    todos.addTodo()
    todos.updateTodo(todos.todos.value[0].id, { tags: ['frontend'] })
    todos.draftTitle.value = 'Beta task'
    todos.addTodo()
    todos.updateTodo(todos.todos.value[0].id, { tags: ['backend'] })

    todos.toggleTagFilter('frontend')
    todos.toggleTagFilter('backend')
    expect(todos.activeTodos.value).toHaveLength(0)

    todos.setTagMatchMode('any')
    expect(todos.activeTodos.value.map((todo) => todo.title).sort()).toEqual(['Alpha task', 'Beta task'])
  })

  it('sorts filtered tasks by the selected sort state', async () => {
    vi.setSystemTime(new Date('2026-06-16T01:00:00.000Z'))
    const todos = useTodos()
    await todos.loaded

    todos.draftTitle.value = 'Older task'
    todos.addTodo()
    vi.setSystemTime(new Date('2026-06-16T05:00:00.000Z'))
    todos.draftTitle.value = 'Newer task'
    todos.addTodo()

    // Default manual order keeps newest-inserted first (unshift).
    expect(todos.activeTodos.value.map((todo) => todo.title)).toEqual(['Newer task', 'Older task'])

    todos.setSortState({ key: 'createdAt', direction: 'asc' })
    expect(todos.activeTodos.value.map((todo) => todo.title)).toEqual(['Older task', 'Newer task'])

    todos.setSortState({ key: 'priority', direction: 'desc' })
    todos.updateTodo(todos.todos.value.find((t) => t.title === 'Older task')!.id, { priority: 'urgent' })
    expect(todos.activeTodos.value[0].title).toBe('Older task')
  })

  it('applies the blocked quick view and clears prior filters', async () => {
    const todos = useTodos()
    await todos.loaded

    todos.draftTitle.value = 'Active task'
    todos.addTodo()
    todos.draftTitle.value = 'Blocked task'
    todos.addTodo()
    todos.updateTodo(todos.todos.value[0].id, { status: 'blocked' })

    // A stale keyword filter should not survive a view preset.
    todos.setFilterKeyword('Active')
    todos.applyQuickView('blocked')

    expect(todos.filterState.value.keyword).toBe('')
    expect(todos.filterState.value.statuses).toEqual(['blocked'])
    expect(todos.activeTodos.value.map((todo) => todo.title)).toEqual(['Blocked task'])
  })

  it('applies the unassigned quick view and clears prior filters', async () => {
    const todos = useTodos()
    await todos.loaded

    todos.draftTitle.value = 'Project task'
    todos.addTodo()
    todos.updateTodo(todos.todos.value[0].id, { projectName: 'LocalTodo' })
    todos.draftTitle.value = 'Loose task'
    todos.addTodo()

    todos.setFilterKeyword('Project')
    todos.applyQuickView('unassigned')

    expect(todos.filterState.value.keyword).toBe('')
    expect(todos.activeTodos.value.map((todo) => todo.title)).toEqual(['Loose task'])
  })

  it('applies the recent quick view by sorting on updatedAt desc without touching filters', async () => {
    const todos = useTodos()
    await todos.loaded

    todos.setFilterKeyword('keep me')
    todos.applyQuickView('recent')

    expect(todos.sortState.value).toEqual({ key: 'updatedAt', direction: 'desc' })
    expect(todos.filterState.value.keyword).toBe('keep me')
  })

  it('exposes sort state through hasActiveView for the clear entry', async () => {
    const todos = useTodos()
    await todos.loaded

    expect(todos.hasActiveView.value).toBe(false)

    todos.setSortState({ key: 'priority', direction: 'desc' })

    expect(todos.hasActiveFilters.value).toBe(false)
    expect(todos.hasActiveView.value).toBe(true)
  })

  it('resets sort state along with filters', async () => {
    const todos = useTodos()
    await todos.loaded

    todos.setSortState({ key: 'priority', direction: 'asc' })
    todos.setFilterKeyword('anything')

    todos.resetFilters()

    expect(todos.sortState.value).toEqual({ key: 'manual', direction: 'desc' })
    expect(todos.hasActiveFilters.value).toBe(false)
  })

  it('tracks filtered and total counts separately', async () => {
    const todos = useTodos()
    await todos.loaded

    todos.draftTitle.value = 'Open task'
    todos.addTodo()
    todos.draftTitle.value = 'Done task'
    todos.addTodo()
    todos.toggleTodo(todos.todos.value[0].id)
    todos.setFilterKeyword('Open')

    expect(todos.activeTodos.value).toHaveLength(1)
    expect(todos.completedTodos.value).toHaveLength(0)
    expect(todos.totalActiveCount.value).toBe(1)
    expect(todos.totalCompletedCount.value).toBe(1)
  })

  it('copies AI context for a task', async () => {
    const todos = useTodos()
    await todos.loaded

    todos.draftTitle.value = 'Explain this task'
    todos.addTodo()

    const result = await todos.copyTaskAiContext(todos.todos.value[0].id)

    expect(result).toEqual({ status: 'copied', excludedSensitiveCount: 0 })
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('## Task\n\nExplain this task')
    )
  })

  it('blocks direct sensitive task context copy unless explicitly included', async () => {
    const todos = useTodos()
    await todos.loaded

    todos.draftTitle.value = 'Sensitive direct task'
    todos.addTodo()
    todos.updateTodo(todos.todos.value[0].id, { sensitive: true })

    const blockedResult = await todos.copyTaskAiContext(todos.todos.value[0].id)

    expect(blockedResult).toEqual({ status: 'sensitive-blocked', excludedSensitiveCount: 1 })
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()

    const copiedResult = await todos.copyTaskAiContext(todos.todos.value[0].id, { includeSensitive: true })

    expect(copiedResult).toEqual({ status: 'copied', excludedSensitiveCount: 0 })
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('## Task\n\nSensitive direct task')
    )
  })

  it('returns false when copying a missing task context', async () => {
    const todos = useTodos()
    await todos.loaded

    const result = await todos.copyTaskAiContext('missing-task')

    expect(result).toEqual({ status: 'not-found', excludedSensitiveCount: 0 })
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
  })

  it('copies AI context for active tasks', async () => {
    const todos = useTodos()
    await todos.loaded

    todos.draftTitle.value = 'Active task'
    todos.addTodo()
    todos.draftTitle.value = 'Completed task'
    todos.addTodo()
    todos.toggleTodo(todos.todos.value[0].id)

    const result = await todos.copyActiveAiContext()

    expect(result).toEqual({ status: 'copied', excludedSensitiveCount: 0 })
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('## Active task'))
    expect(navigator.clipboard.writeText).not.toHaveBeenCalledWith(
      expect.stringContaining('## Completed task')
    )
  })

  it('summarizes projects and filters by selected project', async () => {
    const todos = useTodos()
    await todos.loaded

    todos.draftTitle.value = 'LocalTodo task'
    todos.addTodo()
    todos.updateTodo(todos.todos.value[0].id, {
      projectName: 'LocalTodo',
      repoPath: 'G:/Zhao/nu11cat/LocalTodo'
    })
    todos.draftTitle.value = 'Other task'
    todos.addTodo()
    todos.updateTodo(todos.todos.value[0].id, { projectName: 'OtherProject' })

    const localTodoKey = 'LocalTodo\nG:/Zhao/nu11cat/LocalTodo'

    expect(todos.hasProjectDashboard.value).toBe(true)
    expect(todos.projectSummaries.value.map((summary) => summary.label)).toEqual([
      'LocalTodo',
      'OtherProject'
    ])

    todos.setProjectFilter(localTodoKey)

    expect(todos.selectedProjectKey.value).toBe(localTodoKey)
    expect(todos.selectedProjectLabel.value).toBe('LocalTodo')
    expect(todos.activeTodos.value.map((todo) => todo.title)).toEqual(['LocalTodo task'])

    todos.setProjectFilter(null)

    expect(todos.selectedProjectKey.value).toBeNull()
    expect(todos.activeTodos.value).toHaveLength(2)
  })

  it('clears the selected project when its group disappears', async () => {
    const todos = useTodos()
    await todos.loaded

    todos.draftTitle.value = 'Temporary project task'
    todos.addTodo()
    todos.updateTodo(todos.todos.value[0].id, { projectName: 'Temporary' })
    todos.setProjectFilter('Temporary\n')

    todos.removeTodo(todos.todos.value[0].id)

    expect(todos.selectedProjectKey.value).toBeNull()
  })

  it('copies AI context for a project group', async () => {
    const todos = useTodos()
    await todos.loaded

    todos.draftTitle.value = 'LocalTodo context task'
    todos.addTodo()
    todos.updateTodo(todos.todos.value[0].id, { projectName: 'LocalTodo' })
    todos.draftTitle.value = 'Other context task'
    todos.addTodo()
    todos.updateTodo(todos.todos.value[0].id, { projectName: 'OtherProject' })

    const result = await todos.copyProjectGroupAiContext('LocalTodo\n')

    expect(result).toEqual({ status: 'copied', excludedSensitiveCount: 0 })
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('## LocalTodo'))
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('## LocalTodo context task')
    )
    expect(navigator.clipboard.writeText).not.toHaveBeenCalledWith(
      expect.stringContaining('## Other context task')
    )
  })

  it('exports AI context for a project group', async () => {
    const todos = useTodos()
    await todos.loaded

    todos.draftTitle.value = 'Scoped export task'
    todos.addTodo()
    todos.updateTodo(todos.todos.value[0].id, {
      projectName: 'LocalTodo',
      repoPath: 'G:/Zhao/nu11cat/LocalTodo'
    })
    todos.draftTitle.value = 'Foreign export task'
    todos.addTodo()
    todos.updateTodo(todos.todos.value[0].id, { projectName: 'OtherProject' })

    const result = await todos.exportProjectGroupAiContext('LocalTodo\nG:/Zhao/nu11cat/LocalTodo')

    expect(result).toEqual({ status: 'written', filePath: 'AI_CONTEXT.md', excludedSensitiveCount: 0 })
    expect(window.api.exportProjectAiContext).toHaveBeenCalledWith({
      markdown: expect.stringContaining('## Scoped export task'),
      suggestedFileName: 'AI_CONTEXT.md',
      suggestedPath: 'G:/Zhao/nu11cat/LocalTodo/.localtodo/AI_CONTEXT.md'
    })
  })

  it('copies project-level AI context for all tasks', async () => {
    const todos = useTodos()
    await todos.loaded

    todos.draftTitle.value = 'Visible project task'
    todos.addTodo()
    todos.updateTodo(todos.todos.value[0].id, {
      projectName: 'LocalTodo',
      repoPath: 'G:/Zhao/nu11cat/LocalTodo',
      relatedFiles: ['src/renderer/src/App.vue'],
      commands: ['npm test']
    })
    todos.draftTitle.value = 'Filtered out task'
    todos.addTodo()
    todos.updateTodo(todos.todos.value[0].id, { projectName: 'OtherProject' })
    todos.setFilterKeyword('Visible')

    const result = await todos.copyProjectAiContext()

    expect(result).toEqual({ status: 'copied', excludedSensitiveCount: 0 })
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('# Project Context'))
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('## LocalTodo'))
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('## OtherProject'))
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('## Filtered out task')
    )
  })

  it('excludes sensitive tasks from project-level AI context by default', async () => {
    const todos = useTodos()
    await todos.loaded

    todos.draftTitle.value = 'Visible context task'
    todos.addTodo()
    todos.draftTitle.value = 'Sensitive context task'
    todos.addTodo()
    todos.updateTodo(todos.todos.value[0].id, {
      description: 'Sensitive context details',
      relatedFiles: ['secret-context.ts'],
      commands: ['secret-context-command'],
      sensitive: true
    })

    const result = await todos.copyProjectAiContext()

    expect(result).toEqual({ status: 'copied', excludedSensitiveCount: 1 })
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('Visible context task'))
    expect(navigator.clipboard.writeText).not.toHaveBeenCalledWith(
      expect.stringContaining('Sensitive context task')
    )
    expect(navigator.clipboard.writeText).not.toHaveBeenCalledWith(
      expect.stringContaining('secret-context-command')
    )
  })

  it('exports project-level AI context through the preload bridge', async () => {
    const todos = useTodos()
    await todos.loaded

    todos.draftTitle.value = 'Export context task'
    todos.addTodo()
    todos.updateTodo(todos.todos.value[0].id, {
      projectName: 'LocalTodo',
      repoPath: 'G:/Zhao/nu11cat/LocalTodo'
    })

    const result = await todos.exportProjectAiContext()

    expect(result).toEqual({ status: 'written', filePath: 'AI_CONTEXT.md', excludedSensitiveCount: 0 })
    expect(window.api.exportProjectAiContext).toHaveBeenCalledWith({
      markdown: expect.stringContaining('# Project Context'),
      suggestedFileName: 'AI_CONTEXT.md',
      suggestedPath: 'G:/Zhao/nu11cat/LocalTodo/.localtodo/AI_CONTEXT.md'
    })
  })

  it('returns preload export results without throwing', async () => {
    vi.mocked(window.api.exportProjectAiContext).mockResolvedValueOnce({ status: 'cancelled' })
    const todos = useTodos()
    await todos.loaded

    todos.draftTitle.value = 'Cancel export'
    todos.addTodo()

    await expect(todos.exportProjectAiContext()).resolves.toEqual({
      status: 'cancelled',
      excludedSensitiveCount: 0
    })
  })

  it('returns an error when project context export is unavailable', async () => {
    vi.stubGlobal('window', { api: { platform: 'win32' } })
    const todos = useTodos()
    await todos.loaded

    await expect(todos.exportProjectAiContext()).resolves.toEqual({
      status: 'error',
      message: 'Project AI context export is not available.',
      excludedSensitiveCount: 0
    })
  })

  it('opens an exported project AI context file through the preload bridge', async () => {
    const todos = useTodos()
    await todos.loaded

    await expect(todos.openExportedAiContext('G:/repo/.localtodo/AI_CONTEXT.md')).resolves.toEqual({
      status: 'opened'
    })
    expect(window.api.openExportedAiContextFile).toHaveBeenCalledWith('G:/repo/.localtodo/AI_CONTEXT.md')
  })

  it('returns an error when opening exported AI context is unavailable', async () => {
    vi.stubGlobal('window', { api: { platform: 'win32' } })
    const todos = useTodos()
    await todos.loaded

    await expect(todos.openExportedAiContext('AI_CONTEXT.md')).resolves.toEqual({
      status: 'error',
      message: 'Open exported AI context is not available.'
    })
  })

  it('reveals an exported project AI context file through the preload bridge', async () => {
    const todos = useTodos()
    await todos.loaded

    await expect(todos.revealExportedAiContext('G:/repo/.localtodo/AI_CONTEXT.md')).resolves.toEqual({
      status: 'revealed'
    })
    expect(window.api.revealExportedAiContextFile).toHaveBeenCalledWith(
      'G:/repo/.localtodo/AI_CONTEXT.md'
    )
  })

  it('returns an error when revealing exported AI context is unavailable', async () => {
    vi.stubGlobal('window', { api: { platform: 'win32' } })
    const todos = useTodos()
    await todos.loaded

    await expect(todos.revealExportedAiContext('AI_CONTEXT.md')).resolves.toEqual({
      status: 'error',
      message: 'Reveal exported AI context is not available.'
    })
  })

  it('exports tasks as schema versioned JSON', async () => {
    const todos = useTodos()
    await todos.loaded

    todos.draftTitle.value = 'Export me'
    todos.addTodo()

    const data = JSON.parse(todos.exportTodosJson())

    expect(data.schemaVersion).toBe(1)
    expect(data.exportedAt).toBeTruthy()
    expect(data.tasks[0]).toMatchObject({
      title: 'Export me',
      status: 'todo'
    })
  })

  it('imports tasks from schema versioned JSON', async () => {
    const todos = useTodos()
    await todos.loaded
    todos.selectTodo('stale-selection')
    const file = {
      text: vi.fn().mockResolvedValue(
        JSON.stringify({
          schemaVersion: 1,
          exportedAt: '2026-06-16T03:00:00.000Z',
          tasks: [
            {
              id: 'imported-task',
              title: 'Imported task',
              status: 'doing',
              priority: 'high',
              type: 'feature',
              tags: ['imported'],
              description: 'Imported description',
              projectName: 'LocalTodo',
              repoPath: 'G:/Zhao/nu11cat/LocalTodo',
              relatedFiles: ['src/renderer/src/App.vue'],
              commands: ['npm test'],
              createdAt: '2026-06-16T01:00:00.000Z',
              updatedAt: '2026-06-16T02:00:00.000Z'
            }
          ]
        })
      )
    } as unknown as File

    const preview = await todos.previewTodosJsonImport(file)

    expect(preview).toMatchObject({ status: 'ready', currentTaskCount: 0, importTaskCount: 1 })
    expect(todos.todos.value).toEqual([])

    const result = preview.status === 'ready' ? await todos.applyTodosJsonImport(preview.tasks) : null

    expect(result).toEqual({
      status: 'imported',
      previousTaskCount: 0,
      importedTaskCount: 1,
      restorePointPath: 'G:/LocalTodo/restore-points/localtodo-before-import.json'
    })
    expect(window.api.createImportRestorePoint).toHaveBeenCalledWith(expect.stringContaining('"tasks": []'))
    expect(todos.todos.value).toEqual([
      {
        id: 'imported-task',
        title: 'Imported task',
        status: 'doing',
        priority: 'high',
        type: 'feature',
        tags: ['imported'],
        description: 'Imported description',
        projectName: 'LocalTodo',
        repoPath: 'G:/Zhao/nu11cat/LocalTodo',
        relatedFiles: ['src/renderer/src/App.vue'],
        commands: ['npm test'],
        notes: [],
        sensitive: false,
        createdAt: '2026-06-16T01:00:00.000Z',
        updatedAt: '2026-06-16T02:00:00.000Z'
      }
    ])
    expect(todos.selectedTodoId.value).toBeNull()
  })

  it('creates a restore point from current tasks before replacing an import', async () => {
    const todos = useTodos()
    await todos.loaded

    todos.draftTitle.value = 'Current task'
    todos.addTodo()
    todos.selectTodo(todos.todos.value[0].id)

    const importedTask = {
      ...todos.todos.value[0],
      id: 'imported-task',
      title: 'Imported task'
    }
    const result = await todos.applyTodosJsonImport([importedTask])

    expect(result).toEqual({
      status: 'imported',
      previousTaskCount: 1,
      importedTaskCount: 1,
      restorePointPath: 'G:/LocalTodo/restore-points/localtodo-before-import.json'
    })
    expect(window.api.createImportRestorePoint).toHaveBeenCalledWith(expect.stringContaining('Current task'))
    expect(window.api.createImportRestorePoint).toHaveBeenCalledWith(expect.not.stringContaining('Imported task'))
    expect(todos.todos.value).toEqual([importedTask])
    expect(todos.selectedTodoId.value).toBeNull()
  })

  it('does not overwrite current tasks when imported JSON is invalid', async () => {
    const todos = useTodos()
    await todos.loaded

    todos.draftTitle.value = 'Keep this task'
    todos.addTodo()
    const file = { text: vi.fn().mockResolvedValue('{not-json') } as unknown as File

    const result = await todos.previewTodosJsonImport(file)

    expect(result).toEqual({
      status: 'invalid',
      message: 'Selected file is not a valid LocalTodo JSON export.'
    })
    expect(todos.todos.value[0].title).toBe('Keep this task')
    expect(window.api.createImportRestorePoint).not.toHaveBeenCalled()
  })

  it('does not overwrite current tasks when reading the import file fails', async () => {
    const todos = useTodos()
    await todos.loaded

    todos.draftTitle.value = 'Keep this task'
    todos.addTodo()
    const file = { text: vi.fn().mockRejectedValue(new Error('Read failed')) } as unknown as File

    const result = await todos.previewTodosJsonImport(file)

    expect(result).toEqual({ status: 'invalid', message: 'Read failed' })
    expect(todos.todos.value[0].title).toBe('Keep this task')
    expect(window.api.createImportRestorePoint).not.toHaveBeenCalled()
  })

  it('does not overwrite current tasks when restore point creation fails', async () => {
    vi.mocked(window.api.createImportRestorePoint).mockResolvedValue({ status: 'error', message: 'Disk full' })
    const todos = useTodos()
    await todos.loaded

    todos.draftTitle.value = 'Keep this task'
    todos.addTodo()
    const importedTask = {
      ...todos.todos.value[0],
      id: 'imported-task',
      title: 'Imported task'
    }

    const result = await todos.applyTodosJsonImport([importedTask])

    expect(result).toEqual({ status: 'restore-error', message: 'Disk full' })
    expect(todos.todos.value[0].title).toBe('Keep this task')
  })

  it('does not overwrite current tasks when restore point creation is unavailable', async () => {
    vi.stubGlobal('window', {
      api: {
        ...createMockApi(),
        createImportRestorePoint: undefined
      }
    })
    const todos = useTodos()
    await todos.loaded

    todos.draftTitle.value = 'Keep this task'
    todos.addTodo()
    const importedTask = {
      ...todos.todos.value[0],
      id: 'imported-task',
      title: 'Imported task'
    }

    const result = await todos.applyTodosJsonImport([importedTask])

    expect(result).toEqual({
      status: 'restore-error',
      message: 'Import restore point creation is not available.'
    })
    expect(todos.todos.value[0].title).toBe('Keep this task')
  })

  it('exports .localtodo workspace for a project group', async () => {
    const todos = useTodos()
    await todos.loaded

    todos.draftTitle.value = 'LocalTodo workspace task'
    todos.addTodo()
    todos.updateTodo(todos.todos.value[0].id, {
      projectName: 'LocalTodo',
      repoPath: 'G:/Zhao/nu11cat/LocalTodo'
    })
    todos.draftTitle.value = 'Foreign workspace task'
    todos.addTodo()
    todos.updateTodo(todos.todos.value[0].id, { projectName: 'OtherProject' })

    const result = await todos.exportLocalTodoProject('LocalTodo\nG:/Zhao/nu11cat/LocalTodo')

    expect(result).toEqual({
      status: 'written',
      dirPath: 'G:/repo/.localtodo',
      aiContextFilePath: 'G:/repo/.localtodo/AI_CONTEXT.md',
      tasksJsonFilePath: 'G:/repo/.localtodo/tasks.json',
      taskFilePaths: ['G:/repo/.localtodo/tasks/task_task-id.md'],
      staleTaskFiles: [],
      gitignore: {
        status: 'not-requested',
        filePath: 'G:/repo/.gitignore',
        entries: ['.localtodo/tasks.json', '.localtodo/AI_CONTEXT.md', '.localtodo/tasks/']
      },
      excludedSensitiveCount: 0
    })
    expect(window.api.exportLocalTodoProject).toHaveBeenCalledWith({
      repoPath: 'G:/Zhao/nu11cat/LocalTodo',
      markdown: expect.stringContaining('## LocalTodo workspace task'),
      tasksJson: expect.stringContaining('"title": "LocalTodo workspace task"'),
      taskMarkdownFiles: [
        {
          id: todos.todos.value[1].id,
          markdown: expect.stringContaining('# Task Context')
        }
      ],
      writeGitignore: undefined
    })

    const payload = vi.mocked(window.api.exportLocalTodoProject).mock.calls[0][0]

    expect(payload.taskMarkdownFiles[0].markdown).toContain('LocalTodo workspace task')
    expect(payload.taskMarkdownFiles[0].markdown).not.toContain('Foreign workspace task')
  })

  it('excludes sensitive tasks from .localtodo project export by default', async () => {
    const todos = useTodos()
    await todos.loaded

    todos.draftTitle.value = 'Visible workspace task'
    todos.addTodo()
    todos.updateTodo(todos.todos.value[0].id, {
      projectName: 'LocalTodo',
      repoPath: 'G:/Zhao/nu11cat/LocalTodo'
    })
    todos.draftTitle.value = 'Sensitive workspace task'
    todos.addTodo()
    todos.updateTodo(todos.todos.value[0].id, {
      projectName: 'LocalTodo',
      repoPath: 'G:/Zhao/nu11cat/LocalTodo',
      description: 'Secret workspace details',
      relatedFiles: ['secret.ts'],
      commands: ['secret-command'],
      sensitive: true
    })

    const result = await todos.exportLocalTodoProject('LocalTodo\nG:/Zhao/nu11cat/LocalTodo')

    expect(result).toEqual(expect.objectContaining({ status: 'written', excludedSensitiveCount: 1 }))

    const payload = vi.mocked(window.api.exportLocalTodoProject).mock.calls[0][0]

    expect(payload.markdown).toContain('Visible workspace task')
    expect(payload.markdown).not.toContain('Sensitive workspace task')
    expect(payload.markdown).not.toContain('Secret workspace details')
    expect(payload.tasksJson).toContain('Visible workspace task')
    expect(payload.tasksJson).not.toContain('Sensitive workspace task')
    expect(payload.taskMarkdownFiles).toHaveLength(1)
    expect(payload.taskMarkdownFiles[0].markdown).toContain('Visible workspace task')
    expect(payload.taskMarkdownFiles[0].markdown).not.toContain('Sensitive workspace task')
  })

  it('includes sensitive tasks in .localtodo project export when requested', async () => {
    const todos = useTodos()
    await todos.loaded

    todos.draftTitle.value = 'Sensitive included task'
    todos.addTodo()
    todos.updateTodo(todos.todos.value[0].id, {
      projectName: 'LocalTodo',
      repoPath: 'G:/Zhao/nu11cat/LocalTodo',
      sensitive: true
    })

    const result = await todos.exportLocalTodoProject('LocalTodo\nG:/Zhao/nu11cat/LocalTodo', {
      includeSensitive: true
    })

    expect(result).toEqual(expect.objectContaining({ status: 'written', excludedSensitiveCount: 0 }))

    const payload = vi.mocked(window.api.exportLocalTodoProject).mock.calls[0][0]

    expect(payload.markdown).toContain('Sensitive included task')
    expect(payload.tasksJson).toContain('Sensitive included task')
    expect(payload.taskMarkdownFiles[0].markdown).toContain('Sensitive included task')
  })

  it('passes the .gitignore write option to .localtodo project export', async () => {
    const todos = useTodos()
    await todos.loaded

    todos.draftTitle.value = 'Gitignore workspace task'
    todos.addTodo()
    todos.updateTodo(todos.todos.value[0].id, {
      projectName: 'LocalTodo',
      repoPath: 'G:/Zhao/nu11cat/LocalTodo'
    })

    await todos.exportLocalTodoProject('LocalTodo\nG:/Zhao/nu11cat/LocalTodo', { writeGitignore: true })

    expect(window.api.exportLocalTodoProject).toHaveBeenCalledWith(
      expect.objectContaining({ writeGitignore: true })
    )
  })

  it('returns an error when exporting .localtodo for a project without a repo path', async () => {
    const todos = useTodos()
    await todos.loaded

    todos.draftTitle.value = 'No repo task'
    todos.addTodo()
    todos.updateTodo(todos.todos.value[0].id, { projectName: 'NoRepoProject' })

    const result = await todos.exportLocalTodoProject('NoRepoProject\n')

    expect(result).toEqual({
      status: 'error',
      message: 'Project does not have a repository path.',
      excludedSensitiveCount: 0
    })
    expect(window.api.exportLocalTodoProject).not.toHaveBeenCalled()
  })

  it('returns an error when .localtodo project export is unavailable', async () => {
    vi.stubGlobal('window', { api: { platform: 'win32' } })
    const todos = useTodos()
    await todos.loaded

    todos.draftTitle.value = 'Missing bridge task'
    todos.addTodo()
    todos.updateTodo(todos.todos.value[0].id, {
      projectName: 'LocalTodo',
      repoPath: 'G:/Zhao/nu11cat/LocalTodo'
    })

    await expect(todos.exportLocalTodoProject('LocalTodo\nG:/Zhao/nu11cat/LocalTodo')).resolves.toEqual({
      status: 'error',
      message: '.localtodo project export is not available.',
      excludedSensitiveCount: 0
    })
  })
})

describe('useTodos data file info', () => {
  it('maps an existing data file into dataFileInfo after load', async () => {
    fileStorage.set(
      'data.json',
      JSON.stringify({ schemaVersion: 1, exportedAt: '2026-06-16T00:00:00.000Z', tasks: [] })
    )

    const todos = useTodos()
    await todos.loaded

    expect(window.api.getDataFileInfo).toHaveBeenCalled()
    expect(todos.dataFileInfo.value).toEqual({
      filePath: 'G:/LocalTodo/data.json',
      exists: true,
      size: expect.any(Number),
      modifiedAtMs: 1_700_000_000_000
    })
  })

  it('reports a not-yet-created data file with null size and timestamp', async () => {
    const todos = useTodos()
    await todos.loaded

    expect(todos.dataFileInfo.value).toEqual({
      filePath: 'G:/LocalTodo/data.json',
      exists: false,
      size: null,
      modifiedAtMs: null
    })
  })

  it('clears dataFileInfo when the info lookup errors', async () => {
    vi.mocked(window.api.getDataFileInfo).mockResolvedValue({
      status: 'error',
      message: 'boom'
    })

    const todos = useTodos()
    await todos.loaded

    expect(todos.dataFileInfo.value).toBeNull()
  })

  it('leaves dataFileInfo null when the bridge lacks getDataFileInfo', async () => {
    vi.stubGlobal('window', { api: { platform: 'win32' } })

    const todos = useTodos()
    await todos.loaded
    await todos.refreshDataFileInfo()

    expect(todos.dataFileInfo.value).toBeNull()
  })

  it('still populates dataFileInfo when the saved file cannot be read', async () => {
    fileStorage.set('data.json', '{not-json')

    const todos = useTodos()
    await todos.loaded

    expect(todos.loadErrorMessage.value).not.toBe('')
    expect(todos.dataFileInfo.value).toEqual({
      filePath: 'G:/LocalTodo/data.json',
      exists: true,
      size: expect.any(Number),
      modifiedAtMs: 1_700_000_000_000
    })
  })

  it('refreshes data file info after a successful save', async () => {
    const todos = useTodos()
    await todos.loaded

    const callsAfterLoad = vi.mocked(window.api.getDataFileInfo).mock.calls.length

    todos.draftTitle.value = 'Triggers a save'
    todos.addTodo()
    await advanceSaveDebounce()

    expect(vi.mocked(window.api.getDataFileInfo).mock.calls.length).toBeGreaterThan(callsAfterLoad)
  })

  it('ignores a stale info response so it cannot overwrite newer metadata', async () => {
    const todos = useTodos()
    await todos.loaded

    // First (stale) call resolves last; second (fresh) call resolves first.
    const staleInfo = {
      status: 'ok' as const,
      filePath: 'G:/LocalTodo/data.json',
      exists: true as const,
      size: 11,
      modifiedAtMs: 1_000
    }
    const freshInfo = {
      status: 'ok' as const,
      filePath: 'G:/LocalTodo/data.json',
      exists: true as const,
      size: 22,
      modifiedAtMs: 2_000
    }
    let resolveStale: ((value: typeof staleInfo) => void) | null = null

    vi.mocked(window.api.getDataFileInfo).mockImplementationOnce(
      () => new Promise((resolve) => (resolveStale = resolve))
    )
    vi.mocked(window.api.getDataFileInfo).mockResolvedValueOnce(freshInfo)

    const stalePromise = todos.refreshDataFileInfo()
    const freshPromise = todos.refreshDataFileInfo()

    await freshPromise
    ;(resolveStale as ((value: typeof staleInfo) => void) | null)?.(staleInfo)
    await stalePromise

    expect(todos.dataFileInfo.value?.modifiedAtMs).toBe(2_000)
    expect(todos.dataFileInfo.value?.size).toBe(22)
  })

  it('sets the repo path for every task in a project group', async () => {
    const todos = useTodos()
    await todos.loaded

    todos.draftTitle.value = 'First task'
    todos.addTodo()
    todos.updateTodo(todos.todos.value[0].id, { projectName: 'BatchProject' })
    todos.draftTitle.value = 'Second task'
    todos.addTodo()
    todos.updateTodo(todos.todos.value[0].id, { projectName: 'BatchProject' })

    const key = 'BatchProject\n'

    vi.setSystemTime(new Date('2026-06-17T00:00:00.000Z'))
    const changed = todos.setProjectRepoPath(key, 'G:/picked/repo')

    expect(changed).toBe(2)
    const batchTasks = todos.todos.value.filter((task) => task.projectName === 'BatchProject')
    expect(batchTasks).toHaveLength(2)
    for (const task of batchTasks) {
      expect(task.repoPath).toBe('G:/picked/repo')
      expect(task.updatedAt).toBe('2026-06-17T00:00:00.000Z')
    }
  })

  it('returns 0 and changes nothing for an unknown project key', async () => {
    const todos = useTodos()
    await todos.loaded

    todos.draftTitle.value = 'Lonely task'
    todos.addTodo()
    todos.updateTodo(todos.todos.value[0].id, { projectName: 'KeepMe', repoPath: 'G:/keep' })

    expect(todos.setProjectRepoPath('missing\nkey', 'G:/picked/repo')).toBe(0)
    expect(todos.todos.value[0].repoPath).toBe('G:/keep')
  })

  it('clears the repo path for a project group when passed null', async () => {
    const todos = useTodos()
    await todos.loaded

    todos.draftTitle.value = 'Bound task'
    todos.addTodo()
    todos.updateTodo(todos.todos.value[0].id, { projectName: 'Bound', repoPath: 'G:/old/repo' })

    const key = 'Bound\nG:/old/repo'
    expect(todos.setProjectRepoPath(key, null)).toBe(1)
    expect(todos.todos.value[0].repoPath).toBeUndefined()
  })

  it('surfaces a friendly error when reveal/open are unsupported', async () => {
    vi.stubGlobal('window', { api: { platform: 'win32' } })

    const todos = useTodos()
    await todos.loaded

    await expect(todos.revealDataFile()).resolves.toEqual({
      status: 'error',
      message: 'Revealing the data file is not supported here.'
    })
    await expect(todos.openDataFile()).resolves.toEqual({
      status: 'error',
      message: 'Opening the data file is not supported here.'
    })
  })

  it('saves the current task as a custom template appended after the built-ins', async () => {
    const todos = useTodos()
    await todos.loaded

    const builtInCount = todos.availableTemplates.value.length

    todos.draftTitle.value = 'Source task'
    todos.addTodo()
    const sourceId = todos.todos.value[0].id
    todos.updateTodo(sourceId, {
      type: 'bug',
      priority: 'high',
      description: 'Reproduce and fix',
      commands: ['npm test'],
      tags: ['bug']
    })

    const source = todos.todos.value.find((task) => task.id === sourceId)!
    expect(todos.saveTaskAsTemplate('My bug flow', source)).toBe(true)

    expect(todos.availableTemplates.value).toHaveLength(builtInCount + 1)
    const saved = todos.availableTemplates.value[todos.availableTemplates.value.length - 1]
    expect(saved.label).toBe('My bug flow')
    expect(saved.type).toBe('bug')
    expect(saved.commands).toEqual(['npm test'])
    expect(saved.tags).toEqual(['bug'])
  })

  it('does not save a template when the name is blank', async () => {
    const todos = useTodos()
    await todos.loaded

    const builtInCount = todos.availableTemplates.value.length

    todos.draftTitle.value = 'Source task'
    todos.addTodo()
    const source = todos.todos.value[0]

    expect(todos.saveTaskAsTemplate('   ', source)).toBe(false)
    expect(todos.availableTemplates.value).toHaveLength(builtInCount)
  })

  it('prefills a new task from a saved custom template', async () => {
    const todos = useTodos()
    await todos.loaded

    todos.draftTitle.value = 'Source task'
    todos.addTodo()
    const source = todos.todos.value[0]
    todos.updateTodo(source.id, {
      type: 'feature',
      priority: 'low',
      description: 'Template body',
      commands: ['npm run build'],
      tags: ['feature']
    })

    todos.saveTaskAsTemplate('Reusable', todos.todos.value.find((task) => task.id === source.id)!)
    const saved = todos.customTemplates.value[0]
    todos.selectedTemplateId.value = saved.id

    todos.draftTitle.value = 'New from template'
    todos.addTodo()

    const created = todos.todos.value[0]
    expect(created.title).toBe('New from template')
    expect(created.type).toBe('feature')
    expect(created.description).toBe('Template body')
    expect(created.commands).toEqual(['npm run build'])
    expect(created.tags).toEqual(['feature'])
  })

  it('removes a custom template and resets the selection when it was selected', async () => {
    const todos = useTodos()
    await todos.loaded

    todos.draftTitle.value = 'Source task'
    todos.addTodo()
    todos.saveTaskAsTemplate('Throwaway', todos.todos.value[0])
    const saved = todos.customTemplates.value[0]
    todos.selectedTemplateId.value = saved.id

    todos.deleteCustomTemplate(saved.id)

    expect(todos.customTemplates.value).toHaveLength(0)
    expect(todos.availableTemplates.value.some((template) => template.id === saved.id)).toBe(false)
    expect(todos.selectedTemplateId.value).toBe('blank')
  })

  it('auto-fills a task with the project default commands when it binds to that project with no commands', async () => {
    const todos = useTodos()
    await todos.loaded

    todos.setProjectDefaultCommands('Acme\nG:/acme', ['npm run lint', 'npm test'])

    todos.draftTitle.value = 'New work'
    todos.addTodo()
    const taskId = todos.todos.value[0].id

    todos.updateTodo(taskId, { projectName: 'Acme', repoPath: 'G:/acme' })

    expect(todos.todos.value[0].commands).toEqual(['npm run lint', 'npm test'])
  })

  it('does not overwrite existing commands when binding to a project with defaults', async () => {
    const todos = useTodos()
    await todos.loaded

    todos.setProjectDefaultCommands('Acme\nG:/acme', ['npm run lint'])

    todos.draftTitle.value = 'Has commands'
    todos.addTodo()
    const taskId = todos.todos.value[0].id
    todos.updateTodo(taskId, { commands: ['custom command'] })

    todos.updateTodo(taskId, { projectName: 'Acme', repoPath: 'G:/acme' })

    expect(todos.todos.value[0].commands).toEqual(['custom command'])
  })

  it('does not auto-fill when an update sets commands explicitly alongside the binding', async () => {
    const todos = useTodos()
    await todos.loaded

    todos.setProjectDefaultCommands('Acme\nG:/acme', ['npm run lint'])

    todos.draftTitle.value = 'Explicit commands'
    todos.addTodo()
    const taskId = todos.todos.value[0].id

    todos.updateTodo(taskId, { projectName: 'Acme', repoPath: 'G:/acme', commands: [] })

    expect(todos.todos.value[0].commands).toEqual([])
  })

  it('does not auto-fill when the binding is unchanged', async () => {
    const todos = useTodos()
    await todos.loaded

    todos.draftTitle.value = 'Bound first'
    todos.addTodo()
    const taskId = todos.todos.value[0].id
    todos.updateTodo(taskId, { projectName: 'Acme', repoPath: 'G:/acme' })

    // Configure defaults only after the task is already bound.
    todos.setProjectDefaultCommands('Acme\nG:/acme', ['npm run lint'])
    todos.updateTodo(taskId, { priority: 'high' })

    expect(todos.todos.value[0].commands).toEqual([])
  })

  it('clears project default commands when set to an empty list', async () => {
    const todos = useTodos()
    await todos.loaded

    todos.setProjectDefaultCommands('Acme\nG:/acme', ['npm test'])
    expect(todos.getProjectDefaultCommands('Acme\nG:/acme')).toEqual(['npm test'])

    todos.setProjectDefaultCommands('Acme\nG:/acme', [])
    expect(todos.getProjectDefaultCommands('Acme\nG:/acme')).toEqual([])
  })

  it('persists project default commands to localStorage and reloads them', async () => {
    const first = useTodos()
    await first.loaded

    first.setProjectDefaultCommands('Acme\nG:/acme', ['npm run lint', 'npm test'])
    await nextTick()

    expect(storage.get('localtodo.projectDefaultCommands')).toBe(
      JSON.stringify([{ key: 'Acme\nG:/acme', commands: ['npm run lint', 'npm test'] }])
    )

    const second = useTodos()
    await second.loaded

    expect(second.getProjectDefaultCommands('Acme\nG:/acme')).toEqual(['npm run lint', 'npm test'])
  })
})
