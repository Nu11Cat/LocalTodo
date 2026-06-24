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
  type TagMatchMode,
  type TaskFilterState
} from '@renderer/domain/taskFilter'
import {
  createDefaultTaskSortState,
  sortTasks,
  type TaskSortState
} from '@renderer/domain/taskSort'
import {
  createSavedView,
  parseSavedViews,
  removeSavedView,
  serializeSavedViews,
  upsertSavedView,
  type SavedView
} from '@renderer/domain/savedView'
import {
  createTask,
  createTaskNote,
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
import {
  composeProjectKey,
  findProjectSummary,
  summarizeProjects,
  unassignedProjectKey
} from '@renderer/domain/projectSummary'
import {
  findProjectDefaultCommands,
  parseProjectDefaultCommands,
  serializeProjectDefaultCommands,
  upsertProjectDefaultCommands,
  type ProjectDefaultCommands
} from '@renderer/domain/projectDefaultCommands'
import { migrateStoredTasks } from '@renderer/domain/taskMigration'
import {
  buildTaskInputFromTemplate,
  taskTemplates
} from '@renderer/domain/taskTemplate'
import {
  createCustomTemplateFromTask,
  parseCustomTemplates,
  removeCustomTemplate,
  serializeCustomTemplates,
  toTaskTemplate,
  upsertCustomTemplate,
  type CustomTemplate
} from '@renderer/domain/customTemplate'

const storageKey = 'localtodo.todos'
const savedViewsStorageKey = 'localtodo.savedViews'
const customTemplatesStorageKey = 'localtodo.customTemplates'
const projectDefaultCommandsStorageKey = 'localtodo.projectDefaultCommands'
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
type RevealDataFileResult = { status: 'revealed' } | { status: 'error'; message: string }
type OpenDataFileResult = { status: 'opened' } | { status: 'error'; message: string }
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

export type QuickViewId = 'recent' | 'blocked' | 'unassigned'

export interface QuickView {
  id: QuickViewId
  label: string
}

const quickViews: QuickView[] = [
  { id: 'recent', label: 'Recently updated' },
  { id: 'blocked', label: 'Blocked' },
  { id: 'unassigned', label: 'No project' }
]

// Renderer-friendly view of the persisted data file. size/modifiedAtMs are null
// until the file exists; the UI formats modifiedAtMs into a local timestamp.
export interface DataFileInfo {
  filePath: string
  exists: boolean
  size: number | null
  modifiedAtMs: number | null
}

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

// Saved views are a local UI preference; they always live in localStorage and
// never go through the data file / window.api persistence path.
function loadSavedViews(): SavedView[] {
  try {
    return parseSavedViews(JSON.parse(localStorage.getItem(savedViewsStorageKey) ?? 'null'))
  } catch {
    return []
  }
}

function persistSavedViews(views: SavedView[]): void {
  try {
    localStorage.setItem(savedViewsStorageKey, serializeSavedViews(views))
  } catch {
    // Ignore localStorage persistence errors.
  }
}

// Custom templates, like saved views, are a local UI preference that always lives
// in localStorage and never goes through the data file / window.api persistence path.
function loadCustomTemplates(): CustomTemplate[] {
  try {
    return parseCustomTemplates(JSON.parse(localStorage.getItem(customTemplatesStorageKey) ?? 'null'))
  } catch {
    return []
  }
}

function persistCustomTemplates(templates: CustomTemplate[]): void {
  try {
    localStorage.setItem(customTemplatesStorageKey, serializeCustomTemplates(templates))
  } catch {
    // Ignore localStorage persistence errors.
  }
}

// Project-level default commands, like saved views and custom templates, are a
// local preference that always lives in localStorage and never goes through the
// data file / window.api persistence path.
function loadProjectDefaultCommands(): ProjectDefaultCommands[] {
  try {
    return parseProjectDefaultCommands(
      JSON.parse(localStorage.getItem(projectDefaultCommandsStorageKey) ?? 'null')
    )
  } catch {
    return []
  }
}

function persistProjectDefaultCommands(entries: ProjectDefaultCommands[]): void {
  try {
    localStorage.setItem(projectDefaultCommandsStorageKey, serializeProjectDefaultCommands(entries))
  } catch {
    // Ignore localStorage persistence errors.
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
  const selectedTemplateId = ref<string>('blank')
  const selectedTodoId = ref<string | null>(null)
  const filterState = ref<TaskFilterState>(createEmptyTaskFilterState())
  const sortState = ref<TaskSortState>(createDefaultTaskSortState())
  const savedViews = ref<SavedView[]>(loadSavedViews())
  const customTemplates = ref<CustomTemplate[]>(loadCustomTemplates())
  const projectDefaultCommands = ref<ProjectDefaultCommands[]>(loadProjectDefaultCommands())
  const dataFileInfo = ref<DataFileInfo | null>(null)
  const isLoaded = ref(false)
  const loadErrorMessage = ref('')
  let shouldPersist = false
  let saveQueue = Promise.resolve()
  // Monotonic token so a slow info lookup cannot overwrite a newer one.
  let dataFileInfoRequestId = 0

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
        } else {
          // Refresh size/modified time so the data file panel stays current.
          void refreshDataFileInfo()
        }
      } catch (error) {
        console.warn('Failed to save todos:', error)
      }
    })

    await saveQueue
  }

  async function refreshDataFileInfo(): Promise<void> {
    if (!window.api?.getDataFileInfo) {
      dataFileInfo.value = null
      return
    }

    const requestId = ++dataFileInfoRequestId

    try {
      const result = await window.api.getDataFileInfo()

      // Drop the response if a newer refresh started while this was in flight.
      if (requestId !== dataFileInfoRequestId) {
        return
      }

      if (result.status !== 'ok') {
        dataFileInfo.value = null
        return
      }

      dataFileInfo.value = result.exists
        ? {
            filePath: result.filePath,
            exists: true,
            size: result.size,
            modifiedAtMs: result.modifiedAtMs
          }
        : { filePath: result.filePath, exists: false, size: null, modifiedAtMs: null }
    } catch {
      if (requestId === dataFileInfoRequestId) {
        dataFileInfo.value = null
      }
    }
  }

  async function revealDataFile(): Promise<RevealDataFileResult> {
    if (!window.api?.revealDataFile) {
      return { status: 'error', message: 'Revealing the data file is not supported here.' }
    }

    return window.api.revealDataFile()
  }

  async function openDataFile(): Promise<OpenDataFileResult> {
    if (!window.api?.openDataFile) {
      return { status: 'error', message: 'Opening the data file is not supported here.' }
    }

    return window.api.openDataFile()
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
      // Still surface the data file location — it is most useful when the
      // saved file could not be read.
      await refreshDataFileInfo()
      return
    }

    await nextTick()
    shouldPersist = true
    await refreshDataFileInfo()
  })()

  const filteredTodos = computed(() =>
    sortTasks(filterTasks(todos.value, filterState.value), sortState.value)
  )
  const activeTodos = computed(() => filteredTodos.value.filter(isTaskActive))
  const completedTodos = computed(() => filteredTodos.value.filter(isTaskDone))
  const totalActiveCount = computed(() => todos.value.filter(isTaskActive).length)
  const totalCompletedCount = computed(() => todos.value.filter(isTaskDone).length)
  // New-task dropdown source: built-in templates first, then user-defined ones.
  const availableTemplates = computed(() => [
    ...taskTemplates,
    ...customTemplates.value.map(toTaskTemplate)
  ])
  const hasActiveFilters = computed(() => !isTaskFilterStateEmpty(filterState.value))
  const hasNonDefaultSort = computed(() => sortState.value.key !== 'manual')
  // Drives the "Clear filters" entry: visible when filters OR sort deviate from default.
  const hasActiveView = computed(() => hasActiveFilters.value || hasNonDefaultSort.value)
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

    const template = availableTemplates.value.find((item) => item.id === selectedTemplateId.value)
    const input = template ? buildTaskInputFromTemplate(template, title) : { title }
    const newTask = createTask(input)

    todos.value.unshift(newTask)
    draftTitle.value = ''
    selectTodo(newTask.id)
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

    // When a task is (re)bound to a project and has no commands of its own, seed
    // it with that project's saved default commands. Only fires when the binding
    // actually changed and the caller isn't setting commands explicitly, so it
    // never overwrites existing commands or fights a manual edit.
    const bindingChanged = projectName !== currentTodo.projectName || repoPath !== currentTodo.repoPath
    const commands = hasPatchKey('commands', patch)
      ? sanitizeTaskStringList(patch.commands)
      : bindingChanged && currentTodo.commands.length === 0
        ? (findProjectDefaultCommands(
            projectDefaultCommands.value,
            composeProjectKey(projectName, repoPath)
          )?.commands ?? currentTodo.commands)
        : currentTodo.commands

    todos.value[todoIndex] = createTask({
      ...currentTodo,
      ...patch,
      projectName,
      repoPath,
      tags: hasPatchKey('tags', patch) ? sanitizeTaskStringList(patch.tags) : currentTodo.tags,
      relatedFiles: hasPatchKey('relatedFiles', patch)
        ? sanitizeTaskStringList(patch.relatedFiles)
        : currentTodo.relatedFiles,
      commands,
      id: currentTodo.id,
      createdAt: currentTodo.createdAt,
      updatedAt: new Date().toISOString()
    })
    return true
  }

  // Bind every task in a project group to one repo path in a single action,
  // reusing updateTodo so each task goes through the same sanitize/timestamp/persist path.
  function setProjectRepoPath(key: string, repoPath: string | null): number {
    const summary = findProjectSummary(projectSummaries.value, key)

    if (!summary) {
      return 0
    }

    for (const task of summary.tasks) {
      updateTodo(task.id, { repoPath })
    }

    return summary.tasks.length
  }

  function addTaskNote(id: string, content: string): boolean {
    const trimmedContent = content.trim()

    if (!trimmedContent) {
      return false
    }

    const todoIndex = todos.value.findIndex((item) => item.id === id)

    if (todoIndex === -1) {
      return false
    }

    const currentTodo = todos.value[todoIndex]

    todos.value[todoIndex] = createTask({
      ...currentTodo,
      notes: [...currentTodo.notes, createTaskNote(trimmedContent)],
      id: currentTodo.id,
      createdAt: currentTodo.createdAt,
      updatedAt: new Date().toISOString()
    })
    return true
  }

  function removeTaskNote(id: string, noteId: string): boolean {
    const todoIndex = todos.value.findIndex((item) => item.id === id)

    if (todoIndex === -1) {
      return false
    }

    const currentTodo = todos.value[todoIndex]
    const nextNotes = currentTodo.notes.filter((note) => note.id !== noteId)

    if (nextNotes.length === currentTodo.notes.length) {
      return false
    }

    todos.value[todoIndex] = createTask({
      ...currentTodo,
      notes: nextNotes,
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

  function setTagMatchMode(mode: TagMatchMode): void {
    filterState.value = {
      ...filterState.value,
      tagMatchMode: mode
    }
  }

  function setSortState(state: TaskSortState): void {
    sortState.value = state
  }

  function applyQuickView(id: QuickViewId): void {
    if (id === 'recent') {
      // Recent is a sort dimension; leave the current filters untouched.
      setSortState({ key: 'updatedAt', direction: 'desc' })
      return
    }

    // Blocked and unassigned are view presets: reset filters, then narrow.
    if (id === 'blocked') {
      filterState.value = {
        ...createEmptyTaskFilterState(),
        statuses: ['blocked']
      }
      return
    }

    filterState.value = {
      ...createEmptyTaskFilterState(),
      projects: [unassignedProjectKey]
    }
  }

  function resetFilters(): void {
    filterState.value = createEmptyTaskFilterState()
    sortState.value = createDefaultTaskSortState()
  }

  function saveCurrentView(name: string): boolean {
    const trimmedName = name.trim()

    if (!trimmedName) {
      return false
    }

    savedViews.value = upsertSavedView(
      savedViews.value,
      createSavedView(trimmedName, filterState.value, sortState.value)
    )
    return true
  }

  function applySavedView(id: string): boolean {
    const view = savedViews.value.find((item) => item.id === id)

    if (!view) {
      return false
    }

    // Clone so later filter mutations cannot reach into the stored view's arrays.
    filterState.value = {
      ...view.filter,
      statuses: [...view.filter.statuses],
      priorities: [...view.filter.priorities],
      types: [...view.filter.types],
      tags: [...view.filter.tags],
      projects: [...view.filter.projects]
    }
    sortState.value = { ...view.sort }
    return true
  }

  function deleteSavedView(id: string): void {
    savedViews.value = removeSavedView(savedViews.value, id)
  }

  function saveTaskAsTemplate(name: string, task: Task): boolean {
    const trimmedName = name.trim()

    if (!trimmedName) {
      return false
    }

    customTemplates.value = upsertCustomTemplate(
      customTemplates.value,
      createCustomTemplateFromTask(trimmedName, task)
    )
    return true
  }

  function deleteCustomTemplate(id: string): void {
    customTemplates.value = removeCustomTemplate(customTemplates.value, id)

    // The deleted template can no longer back the new-task dropdown; fall back to Blank.
    if (selectedTemplateId.value === id) {
      selectedTemplateId.value = 'blank'
    }
  }

  // The saved default commands for a project key, or [] if none are configured.
  function getProjectDefaultCommands(key: string): string[] {
    return findProjectDefaultCommands(projectDefaultCommands.value, key)?.commands ?? []
  }

  // Save (or clear, when commands is empty) the default commands for a project key.
  // These are applied to future tasks bound to this project that have no commands.
  function setProjectDefaultCommands(key: string, commands: string[]): void {
    projectDefaultCommands.value = upsertProjectDefaultCommands(
      projectDefaultCommands.value,
      key,
      commands
    )
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

  watch(
    savedViews,
    (views) => {
      persistSavedViews(views)
    },
    { deep: true }
  )

  watch(
    customTemplates,
    (templates) => {
      persistCustomTemplates(templates)
    },
    { deep: true }
  )

  watch(
    projectDefaultCommands,
    (entries) => {
      persistProjectDefaultCommands(entries)
    },
    { deep: true }
  )

  return {
    todos,
    draftTitle,
    selectedTemplateId,
    availableTemplates,
    customTemplates,
    saveTaskAsTemplate,
    deleteCustomTemplate,
    projectDefaultCommands,
    getProjectDefaultCommands,
    setProjectDefaultCommands,
    selectedTodoId,
    filterState,
    sortState,
    savedViews,
    quickViews,
    dataFileInfo,
    isLoaded,
    loadErrorMessage,
    filteredTodos,
    activeTodos,
    completedTodos,
    totalActiveCount,
    totalCompletedCount,
    hasActiveFilters,
    hasNonDefaultSort,
    hasActiveView,
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
    setProjectRepoPath,
    addTaskNote,
    removeTaskNote,
    setFilterKeyword,
    toggleStatusFilter,
    togglePriorityFilter,
    toggleTypeFilter,
    toggleTagFilter,
    setTagMatchMode,
    setSortState,
    applyQuickView,
    setProjectFilter,
    resetFilters,
    saveCurrentView,
    applySavedView,
    deleteSavedView,
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
    refreshDataFileInfo,
    revealDataFile,
    openDataFile,
    exportTodosJson,
    downloadTodosJson,
    previewTodosJsonImport,
    applyTodosJsonImport
  }
}
