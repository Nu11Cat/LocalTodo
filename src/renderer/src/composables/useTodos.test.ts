import { nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useTodos } from './useTodos'

const storage = new Map<string, string>()

beforeEach(() => {
  storage.clear()
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
    api: {
      exportProjectAiContext: vi.fn().mockResolvedValue({ status: 'written', filePath: 'AI_CONTEXT.md' }),
      openExportedAiContextFile: vi.fn().mockResolvedValue({ status: 'opened' }),
      revealExportedAiContextFile: vi.fn().mockResolvedValue({ status: 'revealed' })
    }
  })
})

describe('useTodos', () => {
  it('adds a task from the draft title', () => {
    const todos = useTodos()

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
      commands: []
    })
    expect(todos.draftTitle.value).toBe('')
  })

  it('does not add blank tasks', () => {
    const todos = useTodos()

    todos.draftTitle.value = '   '
    todos.addTodo()

    expect(todos.todos.value).toHaveLength(0)
  })

  it('toggles tasks between active and completed lists', () => {
    const todos = useTodos()

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

  it('clears completed tasks', () => {
    const todos = useTodos()

    todos.draftTitle.value = 'Keep this'
    todos.addTodo()
    todos.draftTitle.value = 'Clear this'
    todos.addTodo()

    todos.toggleTodo(todos.todos.value[0].id)
    todos.clearCompleted()

    expect(todos.todos.value).toHaveLength(1)
    expect(todos.todos.value[0].title).toBe('Keep this')
  })

  it('clears completed tasks without deleting active tasks hidden by filters', () => {
    const todos = useTodos()

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

  it('migrates legacy todos from localStorage', () => {
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
        createdAt: '2026-06-16T02:00:00.000Z',
        updatedAt: '2026-06-16T02:00:00.000Z'
      }
    ])
  })

  it('persists upgraded tasks to localStorage', async () => {
    const todos = useTodos()

    todos.draftTitle.value = 'Persist this'
    todos.addTodo()
    await nextTick()

    const storedTodos = JSON.parse(storage.get('localtodo.todos') ?? '[]')

    expect(storedTodos[0]).toMatchObject({
      title: 'Persist this',
      status: 'todo',
      priority: 'medium',
      type: 'chore'
    })
  })

  it('selects a task and updates editable fields', () => {
    const todos = useTodos()

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
      relatedFiles: ['src/renderer/src/App.vue'],
      commands: ['npm test']
    })
  })

  it('clears optional project metadata with null patches', () => {
    const todos = useTodos()

    todos.draftTitle.value = 'Clear project'
    todos.addTodo()
    const taskId = todos.todos.value[0].id

    todos.updateTodo(taskId, { projectName: 'LocalTodo', repoPath: 'G:/repo' })
    todos.updateTodo(taskId, { projectName: null, repoPath: null })

    expect(todos.todos.value[0].projectName).toBeUndefined()
    expect(todos.todos.value[0].repoPath).toBeUndefined()
  })

  it('updates timestamps when editing tasks', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-16T05:00:00.000Z'))
    const todos = useTodos()

    todos.draftTitle.value = 'Timestamp me'
    todos.addTodo()
    const taskId = todos.todos.value[0].id

    vi.setSystemTime(new Date('2026-06-16T06:00:00.000Z'))
    todos.updateTodo(taskId, { description: 'Updated' })

    expect(todos.todos.value[0].updatedAt).toBe('2026-06-16T06:00:00.000Z')
    vi.useRealTimers()
  })

  it('returns false when updating a missing task', () => {
    const todos = useTodos()

    expect(todos.updateTodo('missing-task', { status: 'done' })).toBe(false)
    expect(todos.todos.value).toHaveLength(0)
  })

  it('moves tasks between computed lists when status is updated', () => {
    const todos = useTodos()

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

  it('clears selection when removing the selected task', () => {
    const todos = useTodos()

    todos.draftTitle.value = 'Remove selected'
    todos.addTodo()
    const taskId = todos.todos.value[0].id
    todos.selectTodo(taskId)

    todos.removeTodo(taskId)

    expect(todos.selectedTodoId.value).toBeNull()
    expect(todos.selectedTodo.value).toBeNull()
  })

  it('persists updated fields to localStorage', async () => {
    const todos = useTodos()

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

    const storedTodos = JSON.parse(storage.get('localtodo.todos') ?? '[]')

    expect(storedTodos[0]).toMatchObject({
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

  it('filters tasks by keyword and resets filters', () => {
    const todos = useTodos()

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

  it('toggles status, priority, and type filters', () => {
    const todos = useTodos()

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

  it('filters by tags and lists available tags', () => {
    const todos = useTodos()

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

  it('tracks filtered and total counts separately', () => {
    const todos = useTodos()

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

    todos.draftTitle.value = 'Explain this task'
    todos.addTodo()

    const result = await todos.copyTaskAiContext(todos.todos.value[0].id)

    expect(result).toBe(true)
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('## Task\n\nExplain this task')
    )
  })

  it('returns false when copying a missing task context', async () => {
    const todos = useTodos()

    const result = await todos.copyTaskAiContext('missing-task')

    expect(result).toBe(false)
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
  })

  it('copies AI context for active tasks', async () => {
    const todos = useTodos()

    todos.draftTitle.value = 'Active task'
    todos.addTodo()
    todos.draftTitle.value = 'Completed task'
    todos.addTodo()
    todos.toggleTodo(todos.todos.value[0].id)

    const result = await todos.copyActiveAiContext()

    expect(result).toBe(true)
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('## Active task'))
    expect(navigator.clipboard.writeText).not.toHaveBeenCalledWith(
      expect.stringContaining('## Completed task')
    )
  })

  it('summarizes projects and filters by selected project', () => {
    const todos = useTodos()

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

  it('clears the selected project when its group disappears', () => {
    const todos = useTodos()

    todos.draftTitle.value = 'Temporary project task'
    todos.addTodo()
    todos.updateTodo(todos.todos.value[0].id, { projectName: 'Temporary' })
    todos.setProjectFilter('Temporary\n')

    todos.removeTodo(todos.todos.value[0].id)

    expect(todos.selectedProjectKey.value).toBeNull()
  })

  it('copies AI context for a project group', async () => {
    const todos = useTodos()

    todos.draftTitle.value = 'LocalTodo context task'
    todos.addTodo()
    todos.updateTodo(todos.todos.value[0].id, { projectName: 'LocalTodo' })
    todos.draftTitle.value = 'Other context task'
    todos.addTodo()
    todos.updateTodo(todos.todos.value[0].id, { projectName: 'OtherProject' })

    const result = await todos.copyProjectGroupAiContext('LocalTodo\n')

    expect(result).toBe(true)
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

    expect(result).toEqual({ status: 'written', filePath: 'AI_CONTEXT.md' })
    expect(window.api.exportProjectAiContext).toHaveBeenCalledWith({
      markdown: expect.stringContaining('## Scoped export task'),
      suggestedFileName: 'AI_CONTEXT.md',
      suggestedPath: 'G:/Zhao/nu11cat/LocalTodo/.localtodo/AI_CONTEXT.md'
    })
  })

  it('copies project-level AI context for all tasks', async () => {
    const todos = useTodos()

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

    expect(result).toBe(true)
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('# Project Context'))
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('## LocalTodo'))
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('## OtherProject'))
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('## Filtered out task')
    )
  })

  it('exports project-level AI context through the preload bridge', async () => {
    const todos = useTodos()

    todos.draftTitle.value = 'Export context task'
    todos.addTodo()
    todos.updateTodo(todos.todos.value[0].id, {
      projectName: 'LocalTodo',
      repoPath: 'G:/Zhao/nu11cat/LocalTodo'
    })

    const result = await todos.exportProjectAiContext()

    expect(result).toEqual({ status: 'written', filePath: 'AI_CONTEXT.md' })
    expect(window.api.exportProjectAiContext).toHaveBeenCalledWith({
      markdown: expect.stringContaining('# Project Context'),
      suggestedFileName: 'AI_CONTEXT.md',
      suggestedPath: 'G:/Zhao/nu11cat/LocalTodo/.localtodo/AI_CONTEXT.md'
    })
  })

  it('returns preload export results without throwing', async () => {
    vi.mocked(window.api.exportProjectAiContext).mockResolvedValueOnce({ status: 'cancelled' })
    const todos = useTodos()

    todos.draftTitle.value = 'Cancel export'
    todos.addTodo()

    await expect(todos.exportProjectAiContext()).resolves.toEqual({ status: 'cancelled' })
  })

  it('returns an error when project context export is unavailable', async () => {
    vi.stubGlobal('window', { api: { platform: 'win32' } })
    const todos = useTodos()

    await expect(todos.exportProjectAiContext()).resolves.toEqual({
      status: 'error',
      message: 'Project AI context export is not available.'
    })
  })

  it('opens an exported project AI context file through the preload bridge', async () => {
    const todos = useTodos()

    await expect(todos.openExportedAiContext('G:/repo/.localtodo/AI_CONTEXT.md')).resolves.toEqual({
      status: 'opened'
    })
    expect(window.api.openExportedAiContextFile).toHaveBeenCalledWith(
      'G:/repo/.localtodo/AI_CONTEXT.md'
    )
  })

  it('returns an error when opening exported AI context is unavailable', async () => {
    vi.stubGlobal('window', { api: { platform: 'win32' } })
    const todos = useTodos()

    await expect(todos.openExportedAiContext('AI_CONTEXT.md')).resolves.toEqual({
      status: 'error',
      message: 'Open exported AI context is not available.'
    })
  })

  it('reveals an exported project AI context file through the preload bridge', async () => {
    const todos = useTodos()

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

    await expect(todos.revealExportedAiContext('AI_CONTEXT.md')).resolves.toEqual({
      status: 'error',
      message: 'Reveal exported AI context is not available.'
    })
  })

  it('exports tasks as schema versioned JSON', () => {
    const todos = useTodos()

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

    const result = await todos.importTodosJson(file)

    expect(result).toBe(true)
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
        createdAt: '2026-06-16T01:00:00.000Z',
        updatedAt: '2026-06-16T02:00:00.000Z'
      }
    ])
    expect(todos.selectedTodoId.value).toBeNull()
  })

  it('does not replace tasks when importing invalid JSON', async () => {
    const todos = useTodos()
    const file = {
      text: vi.fn().mockResolvedValue('{')
    } as unknown as File

    todos.draftTitle.value = 'Keep existing'
    todos.addTodo()

    const result = await todos.importTodosJson(file)

    expect(result).toBe(false)
    expect(todos.todos.value).toHaveLength(1)
    expect(todos.todos.value[0].title).toBe('Keep existing')
  })
})
