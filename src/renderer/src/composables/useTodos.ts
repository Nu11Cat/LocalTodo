import { computed, nextTick, ref, watch } from 'vue'
import {
  filterSensitiveTasks,
  generateProjectAiContext,
  generateTaskAiContext,
  generateTasksAiContext
} from '@renderer/domain/aiContext'
import { parseDataFileText, serializeDataFile } from '@renderer/domain/dataFile'
import {
  createEmptyTaskFilterState,
  filterTasks,
  isTaskFilterStateEmpty,
  type TaskFilterState
} from '@renderer/domain/taskFilter'
import {
  createTask,
  isTaskActive,
  isTaskDone,
  sanitizeOptionalTaskString,
  sanitizeTaskStringList,
  toggleTaskDone,
  type Task,
  type TaskPriority,
  type TaskStatus,
  type TaskType
} from '@renderer/domain/taskModel'
import { findProjectSummary, summarizeProjects } from '@renderer/domain/projectSummary'
import { migrateStoredTasks } from '@renderer/domain/taskMigration'

const storageKey = 'localtodo.todos'
const projectContextFileName = 'AI_CONTEXT.md'
const saveDebounceMs = 300

type ExportProjectAiContextResult =
  | { status: 'written'; filePath: string; excludedSensitiveCount: number }
  | { status: 'cancelled'; excludedSensitiveCount: number }
  | { status: 'error'; message: string; excludedSensitiveCount: number }

type LocalTodoGitignoreResult =
  | { status: 'not-requested'; filePath: string; entries: string[] }
  | { status: 'already-configured'; filePath: string; entries: string[] }
  | { status: 'updated'; filePath: string; entries: string[] }
  | { status: 'error'; filePath: string; entries: string[]; message: string }

type ExportLocalTodoProjectResult =
  | {
      status: 'written'
      dirPath: string
      aiContextFilePath: string
      tasksJsonFilePath: string
      taskFilePaths: string[]
      staleTaskFiles: string[]
      gitignore: LocalTodoGitignoreResult
      excludedSensitiveCount: number
    }
  | { status: 'error'; message: string; excludedSensitiveCount: number }

type CleanupStaleLocalTodoTaskFilesResult =
  | { status: 'deleted'; deletedFileNames: string[] }
  | { status: 'error'; message: string }

type SensitiveTaskActionOptions = {
  includeSensitive?: boolean
}

type ExportLocalTodoProjectOptions = SensitiveTaskActionOptions & {
  writeGitignore?: boolean
}

type CopyAiContextResult = {
  status: 'copied' | 'not-found' | 'sensitive-blocked'
  excludedSensitiveCount: number
}

type ImportTodosJsonPreviewResult =
  | { status: 'ready'; tasks: Task[]; currentTaskCount: number; importTaskCount: number }
  | { status: 'not-loaded'; message: string }
  | { status: 'invalid'; message: string }

type ImportTodosJsonApplyResult =
  | { status: 'imported'; previousTaskCount: number; importedTaskCount: number; restorePointPath: string }
  | { status: 'not-loaded'; message: string }
  | { status: 'restore-error'; message: string }

type OpenExportedAiContextResult = { status: 'opened' } | { status: 'error'; message: string }
type RevealExportedAiContextResult = { status: 'revealed' } | { status: 'error'; message: string }
type LoadTodosResult =
  | { status: 'loaded'; tasks: Task[] }
  | { status: 'error'; message: string; tasks: Task[] }

type EditableTaskPatch = Partial<{
  status: TaskStatus
  priority: TaskPriority
  type: TaskType
  tags: string[]
  description: string
  projectName: string | null
  repoPath: string | null
  relatedFiles: string[]
  commands: string[]
  sensitive: boolean
}>

type TaskFilterKey = 'statuses' | 'priorities' | 'types' | 'tags'

function hasPatchKey(key: keyof EditableTaskPatch, patch: EditableTaskPatch): boolean {
  return Object.prototype.hasOwnProperty.call(patch, key)
}

function createProjectContextExportPath(tasks: Task[]): string | undefined {
  const repoPaths = tasks
    .map((task) => task.repoPath)
    .filter((repoPath): repoPath is string => typeof repoPath === 'string' && repoPath.trim().length > 0)
  const uniqueRepoPaths = [...new Set(repoPaths)]

  if (uniqueRepoPaths.length !== 1) {
    return undefined
  }

  return `${uniqueRepoPaths[0]}/.localtodo/${projectContextFileName}`
}

function loadLegacyTodos(): Task[] {
  const rawTodos = localStorage.getItem(storageKey)

  if (!rawTodos) {
    return []
  }

  try {
    return migrateStoredTasks(JSON.parse(rawTodos))
  } catch {
    return []
  }
}

function removeLegacyTodos(): void {
  try {
    localStorage.removeItem(storageKey)
  } catch {
    // Ignore localStorage removal errors.
  }
}

async function loadTodos(): Promise<LoadTodosResult> {
  if (!window.api?.loadData) {
    return { status: 'loaded', tasks: loadLegacyTodos() }
  }

  const result = await window.api.loadData()

  if (result.status === 'ok') {
    const tasks = parseDataFileText(result.data)

    if (tasks === null) {
      return {
        status: 'error',
        message: 'Saved data could not be read. Your existing data file was left unchanged.',
        tasks: []
      }
    }

    return { status: 'loaded', tasks }
  }

  if (result.status === 'error') {
    return { status: 'error', message: result.message, tasks: loadLegacyTodos() }
  }

  const legacyTodos = loadLegacyTodos()

  if (legacyTodos.length > 0 && window.api?.saveData) {
    const saveResult = await window.api.saveData(serializeDataFile(legacyTodos))

    if (saveResult.status === 'saved') {
      removeLegacyTodos()
    } else {
      console.warn('Failed to migrate legacy todos:', saveResult.message)
    }
  }

  return { status: 'loaded', tasks: legacyTodos }
}

function debounceSave(callback: () => void, delayMs: number): () => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  return () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId)
    }

    timeoutId = setTimeout(() => {
      timeoutId = null
      callback()
    }, delayMs)
  }
}

export function useTodos() {
  const todos = ref<Task[]>([])
  const draftTitle = ref('')
  const selectedTodoId = ref<string | null>(null)
  const filterState = ref<TaskFilterState>(createEmptyTaskFilterState())
  const isLoaded = ref(false)
  const loadErrorMessage = ref('')
  let shouldPersist = false
  let saveQueue = Promise.resolve()

  async function saveTodos(): Promise<void> {
    if (!shouldPersist) {
      return
    }

    if (!window.api?.saveData) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(todos.value))
      } catch {
        // Ignore localStorage fallback save errors.
      }
      return
    }

    const saveData = window.api.saveData
    const payload = serializeDataFile(todos.value)

    saveQueue = saveQueue.then(async () => {
      try {
        const result = await saveData(payload)

        if (result.status === 'error') {
          console.warn('Failed to save todos:', result.message)
        }
      } catch (error) {
        console.warn('Failed to save todos:', error)
      }
    })

    await saveQueue
  }

  const scheduleSaveTodos = debounceSave(() => {
    void saveTodos()
  }, saveDebounceMs)

  const loaded = (async () => {
    const result = await loadTodos()

    todos.value = result.tasks
    isLoaded.value = true

    if (result.status === 'error') {
      loadErrorMessage.value = result.message
      shouldPersist = false
      return
    }

    await nextTick()
    shouldPersist = true
  })()

  const filteredTodos = computed(() => filterTasks(todos.value, filterState.value))
  const activeTodos = computed(() => filteredTodos.value.filter(isTaskActive))
  const completedTodos = computed(() => filteredTodos.value.filter(isTaskDone))
  const totalActiveCount = computed(() => todos.value.filter(isTaskActive).length)
  const totalCompletedCount = computed(() => todos.value.filter(isTaskDone).length)
  const hasActiveFilters = computed(() => !isTaskFilterStateEmpty(filterState.value))
  const projectSummaries = computed(() => summarizeProjects(todos.value))
  const hasProjectDashboard = computed(() => todos.value.length > 0)
  const selectedProjectKey = computed(() => filterState.value.projects[0] ?? null)
  const selectedProject = computed(() => findProjectSummary(projectSummaries.value, selectedProjectKey.value))
  const selectedProjectLabel = computed(() => selectedProject.value?.label ?? '')
  const availableTags = computed(() => {
    const tagsByKey = new Map<string, string>()

    for (const todo of todos.value) {
      for (const tag of todo.tags) {
        const key = tag.toLowerCase()

        if (!tagsByKey.has(key)) {
          tagsByKey.set(key, tag)
        }
      }
    }

    return [...tagsByKey.values()].sort((first, second) => first.localeCompare(second))
  })
  const selectedTodo = computed(() => {
    if (selectedTodoId.value === null) {
      return null
    }

    return todos.value.find((todo) => todo.id === selectedTodoId.value) ?? null
  })

  function addTodo(): void {
    if (!isLoaded.value) {
      return
    }

    const title = draftTitle.value.trim()

    if (!title) {
      return
    }

    todos.value.unshift(createTask({ title }))
    draftTitle.value = ''
  }

  function toggleTodo(id: string): void {
    const todoIndex = todos.value.findIndex((item) => item.id === id)

    if (todoIndex !== -1) {
      todos.value[todoIndex] = toggleTaskDone(todos.value[todoIndex])
    }
  }

  function selectTodo(id: string | null): void {
    selectedTodoId.value = id
  }

  function updateTodo(id: string, patch: EditableTaskPatch): boolean {
    const todoIndex = todos.value.findIndex((item) => item.id === id)

    if (todoIndex === -1) {
      return false
    }

    const currentTodo = todos.value[todoIndex]
    const projectName = hasPatchKey('projectName', patch)
      ? sanitizeOptionalTaskString(patch.projectName, 200)
      : currentTodo.projectName
    const repoPath = hasPatchKey('repoPath', patch)
      ? sanitizeOptionalTaskString(patch.repoPath)
      : currentTodo.repoPath

    todos.value[todoIndex] = createTask({
      ...currentTodo,
      ...patch,
      projectName,
      repoPath,
      tags: hasPatchKey('tags', patch) ? sanitizeTaskStringList(patch.tags) : currentTodo.tags,
      relatedFiles: hasPatchKey('relatedFiles', patch)
        ? sanitizeTaskStringList(patch.relatedFiles)
        : currentTodo.relatedFiles,
      commands: hasPatchKey('commands', patch) ? sanitizeTaskStringList(patch.commands) : currentTodo.commands,
      id: currentTodo.id,
      createdAt: currentTodo.createdAt,
      updatedAt: new Date().toISOString()
    })
    return true
  }

  function removeTodo(id: string): void {
    todos.value = todos.value.filter((todo) => todo.id !== id)

    if (selectedTodoId.value === id) {
      selectTodo(null)
    }
  }

  function clearCompleted(): void {
    todos.value = todos.value.filter(isTaskActive)

    if (selectedTodo.value === null) {
      selectTodo(null)
    }
  }

  function toggleFilterValue<T extends string>(key: TaskFilterKey, value: T): void {
    const currentValues = filterState.value[key]
    const hasValue = currentValues.some((item) => item.toLowerCase() === value.toLowerCase())

    filterState.value = {
      ...filterState.value,
      [key]: hasValue
        ? currentValues.filter((item) => item.toLowerCase() !== value.toLowerCase())
        : [...currentValues, value]
    }
  }

  function setFilterKeyword(value: string): void {
    filterState.value = {
      ...filterState.value,
      keyword: value
    }
  }

  function toggleStatusFilter(status: TaskStatus): void {
    toggleFilterValue('statuses', status)
  }

  function togglePriorityFilter(priority: TaskPriority): void {
    toggleFilterValue('priorities', priority)
  }

  function toggleTypeFilter(type: TaskType): void {
    toggleFilterValue('types', type)
  }

  function toggleTagFilter(tag: string): void {
    toggleFilterValue('tags', tag)
  }

  function setProjectFilter(key: string | null): void {
    filterState.value = {
      ...filterState.value,
      projects: key === null ? [] : [key]
    }
  }

  function resetFilters(): void {
    filterState.value = createEmptyTaskFilterState()
  }

  async function copyTaskAiContext(
    id: string,
    options: SensitiveTaskActionOptions = {}
  ): Promise<CopyAiContextResult> {
    const todo = todos.value.find((item) => item.id === id)

    if (!todo) {
      return { status: 'not-found', excludedSensitiveCount: 0 }
    }

    if (todo.sensitive && options.includeSensitive !== true) {
      return { status: 'sensitive-blocked', excludedSensitiveCount: 1 }
    }

    await navigator.clipboard.writeText(generateTaskAiContext(todo))
    return { status: 'copied', excludedSensitiveCount: 0 }
  }

  async function copyActiveAiContext(
    options: SensitiveTaskActionOptions = {}
  ): Promise<CopyAiContextResult> {
    const result = generateTasksAiContext(activeTodos.value, options)

    await navigator.clipboard.writeText(result.markdown)
    return { status: 'copied', excludedSensitiveCount: result.excludedSensitiveCount }
  }

  async function copyProjectAiContext(
    options: SensitiveTaskActionOptions = {}
  ): Promise<CopyAiContextResult> {
    const result = generateProjectAiContext(todos.value, options)

    await navigator.clipboard.writeText(result.markdown)
    return { status: 'copied', excludedSensitiveCount: result.excludedSensitiveCount }
  }

  async function copyProjectGroupAiContext(
    key: string,
    options: SensitiveTaskActionOptions = {}
  ): Promise<CopyAiContextResult> {
    const summary = findProjectSummary(projectSummaries.value, key)

    if (!summary) {
      return { status: 'not-found', excludedSensitiveCount: 0 }
    }

    const result = generateProjectAiContext(summary.tasks, options)

    await navigator.clipboard.writeText(result.markdown)
    return { status: 'copied', excludedSensitiveCount: result.excludedSensitiveCount }
  }

  async function exportProjectAiContext(
    options: SensitiveTaskActionOptions = {}
  ): Promise<ExportProjectAiContextResult> {
    const context = generateProjectAiContext(todos.value, options)

    if (!window.api?.exportProjectAiContext) {
      return {
        status: 'error',
        message: 'Project AI context export is not available.',
        excludedSensitiveCount: context.excludedSensitiveCount
      }
    }

    const result = await window.api.exportProjectAiContext({
      markdown: context.markdown,
      suggestedFileName: projectContextFileName,
      suggestedPath: createProjectContextExportPath(filterSensitiveTasks(todos.value, options).tasks)
    })

    return { ...result, excludedSensitiveCount: context.excludedSensitiveCount }
  }

  async function exportProjectGroupAiContext(
    key: string,
    options: SensitiveTaskActionOptions = {}
  ): Promise<ExportProjectAiContextResult> {
    if (!window.api?.exportProjectAiContext) {
      return { status: 'error', message: 'Project AI context export is not available.', excludedSensitiveCount: 0 }
    }

    const summary = findProjectSummary(projectSummaries.value, key)

    if (!summary) {
      return { status: 'error', message: 'Project was not found.', excludedSensitiveCount: 0 }
    }

    const filtered = filterSensitiveTasks(summary.tasks, options)
    const context = generateProjectAiContext(summary.tasks, options)
    const result = await window.api.exportProjectAiContext({
      markdown: context.markdown,
      suggestedFileName: projectContextFileName,
      suggestedPath: createProjectContextExportPath(filtered.tasks)
    })

    return { ...result, excludedSensitiveCount: context.excludedSensitiveCount }
  }

  async function exportLocalTodoProject(
    key: string,
    options: ExportLocalTodoProjectOptions = {}
  ): Promise<ExportLocalTodoProjectResult> {
    if (!window.api?.exportLocalTodoProject) {
      return { status: 'error', message: '.localtodo project export is not available.', excludedSensitiveCount: 0 }
    }

    const summary = findProjectSummary(projectSummaries.value, key)

    if (!summary) {
      return { status: 'error', message: 'Project was not found.', excludedSensitiveCount: 0 }
    }

    const repoPath = summary.repoPath

    if (!repoPath) {
      return { status: 'error', message: 'Project does not have a repository path.', excludedSensitiveCount: 0 }
    }

    const filtered = filterSensitiveTasks(summary.tasks, options)
    const context = generateProjectAiContext(summary.tasks, options)
    const result = await window.api.exportLocalTodoProject({
      repoPath,
      markdown: context.markdown,
      tasksJson: serializeDataFile(filtered.tasks),
      taskMarkdownFiles: filtered.tasks.map((task) => ({
        id: task.id,
        markdown: generateTaskAiContext(task)
      })),
      writeGitignore: options.writeGitignore
    })

    return { ...result, excludedSensitiveCount: context.excludedSensitiveCount }
  }

  async function cleanupStaleLocalTodoTaskFiles(
    key: string,
    fileNames: string[]
  ): Promise<CleanupStaleLocalTodoTaskFilesResult> {
    if (!window.api?.cleanupStaleLocalTodoTaskFiles) {
      return { status: 'error', message: 'Stale task file cleanup is not available.' }
    }

    const summary = findProjectSummary(projectSummaries.value, key)

    if (!summary) {
      return { status: 'error', message: 'Project was not found.' }
    }

    const repoPath = summary.repoPath

    if (!repoPath) {
      return { status: 'error', message: 'Project does not have a repository path.' }
    }

    return window.api.cleanupStaleLocalTodoTaskFiles({ repoPath, fileNames })
  }

  async function openExportedAiContext(filePath: string): Promise<OpenExportedAiContextResult> {
    if (!window.api?.openExportedAiContextFile) {
      return { status: 'error', message: 'Open exported AI context is not available.' }
    }

    return window.api.openExportedAiContextFile(filePath)
  }

  async function revealExportedAiContext(filePath: string): Promise<RevealExportedAiContextResult> {
    if (!window.api?.revealExportedAiContextFile) {
      return { status: 'error', message: 'Reveal exported AI context is not available.' }
    }

    return window.api.revealExportedAiContextFile(filePath)
  }

  function exportTodosJson(): string {
    return serializeDataFile(todos.value)
  }

  function downloadTodosJson(): void {
    const url = URL.createObjectURL(new Blob([exportTodosJson()], { type: 'application/json' }))
    const link = document.createElement('a')

    link.href = url
    link.download = 'localtodo-export.json'
    link.click()
    URL.revokeObjectURL(url)
  }

  async function previewTodosJsonImport(file: File): Promise<ImportTodosJsonPreviewResult> {
    if (!isLoaded.value) {
      return { status: 'not-loaded', message: 'Saved data is still loading.' }
    }

    try {
      const importedTodos = parseDataFileText(await file.text())

      if (importedTodos === null) {
        return { status: 'invalid', message: 'Selected file is not a valid LocalTodo JSON export.' }
      }

      return {
        status: 'ready',
        tasks: importedTodos,
        currentTaskCount: todos.value.length,
        importTaskCount: importedTodos.length
      }
    } catch (error) {
      return {
        status: 'invalid',
        message: error instanceof Error ? error.message : 'Failed to read selected JSON file.'
      }
    }
  }

  async function applyTodosJsonImport(importedTodos: Task[]): Promise<ImportTodosJsonApplyResult> {
    if (!isLoaded.value) {
      return { status: 'not-loaded', message: 'Saved data is still loading.' }
    }

    if (!window.api?.createImportRestorePoint) {
      return { status: 'restore-error', message: 'Import restore point creation is not available.' }
    }

    const previousTaskCount = todos.value.length
    const restorePoint = await window.api.createImportRestorePoint(serializeDataFile(todos.value))

    if (restorePoint.status === 'error') {
      return { status: 'restore-error', message: restorePoint.message }
    }

    shouldPersist = true
    loadErrorMessage.value = ''
    todos.value = importedTodos
    selectTodo(null)

    return {
      status: 'imported',
      previousTaskCount,
      importedTaskCount: importedTodos.length,
      restorePointPath: restorePoint.filePath
    }
  }

  watch(
    projectSummaries,
    (summaries) => {
      const key = selectedProjectKey.value

      if (key !== null && !findProjectSummary(summaries, key)) {
        setProjectFilter(null)
      }
    },
    { flush: 'sync' }
  )

  watch(
    todos,
    () => {
      scheduleSaveTodos()
    },
    { deep: true }
  )

  return {
    todos,
    draftTitle,
    selectedTodoId,
    filterState,
    isLoaded,
    loadErrorMessage,
    filteredTodos,
    activeTodos,
    completedTodos,
    totalActiveCount,
    totalCompletedCount,
    hasActiveFilters,
    projectSummaries,
    hasProjectDashboard,
    selectedProjectKey,
    selectedProjectLabel,
    availableTags,
    selectedTodo,
    loaded,
    addTodo,
    toggleTodo,
    selectTodo,
    updateTodo,
    setFilterKeyword,
    toggleStatusFilter,
    togglePriorityFilter,
    toggleTypeFilter,
    toggleTagFilter,
    setProjectFilter,
    resetFilters,
    removeTodo,
    clearCompleted,
    copyTaskAiContext,
    copyActiveAiContext,
    copyProjectAiContext,
    copyProjectGroupAiContext,
    exportProjectAiContext,
    exportProjectGroupAiContext,
    exportLocalTodoProject,
    cleanupStaleLocalTodoTaskFiles,
    openExportedAiContext,
    revealExportedAiContext,
    exportTodosJson,
    downloadTodosJson,
    previewTodosJsonImport,
    applyTodosJsonImport
  }
}
