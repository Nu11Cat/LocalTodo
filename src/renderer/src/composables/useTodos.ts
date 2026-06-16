import { computed, ref, watch } from 'vue'
import {
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

type ExportProjectAiContextResult =
  | { status: 'written'; filePath: string }
  | { status: 'cancelled' }
  | { status: 'error'; message: string }

type ExportLocalTodoProjectResult =
  | { status: 'written'; dirPath: string; aiContextFilePath: string; tasksJsonFilePath: string }
  | { status: 'error'; message: string }

type OpenExportedAiContextResult = { status: 'opened' } | { status: 'error'; message: string }
type RevealExportedAiContextResult = { status: 'revealed' } | { status: 'error'; message: string }

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

function loadTodos(): Task[] {
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

export function useTodos() {
  const todos = ref<Task[]>(loadTodos())
  const draftTitle = ref('')
  const selectedTodoId = ref<string | null>(null)
  const filterState = ref<TaskFilterState>(createEmptyTaskFilterState())

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

  async function copyTaskAiContext(id: string): Promise<boolean> {
    const todo = todos.value.find((item) => item.id === id)

    if (!todo) {
      return false
    }

    await navigator.clipboard.writeText(generateTaskAiContext(todo))
    return true
  }

  async function copyActiveAiContext(): Promise<boolean> {
    await navigator.clipboard.writeText(generateTasksAiContext(activeTodos.value))
    return true
  }

  async function copyProjectAiContext(): Promise<boolean> {
    await navigator.clipboard.writeText(generateProjectAiContext(todos.value))
    return true
  }

  async function copyProjectGroupAiContext(key: string): Promise<boolean> {
    const summary = findProjectSummary(projectSummaries.value, key)

    if (!summary) {
      return false
    }

    await navigator.clipboard.writeText(generateProjectAiContext(summary.tasks))
    return true
  }

  async function exportProjectAiContext(): Promise<ExportProjectAiContextResult> {
    if (!window.api?.exportProjectAiContext) {
      return { status: 'error', message: 'Project AI context export is not available.' }
    }

    return window.api.exportProjectAiContext({
      markdown: generateProjectAiContext(todos.value),
      suggestedFileName: projectContextFileName,
      suggestedPath: createProjectContextExportPath(todos.value)
    })
  }

  async function exportProjectGroupAiContext(key: string): Promise<ExportProjectAiContextResult> {
    if (!window.api?.exportProjectAiContext) {
      return { status: 'error', message: 'Project AI context export is not available.' }
    }

    const summary = findProjectSummary(projectSummaries.value, key)

    if (!summary) {
      return { status: 'error', message: 'Project was not found.' }
    }

    return window.api.exportProjectAiContext({
      markdown: generateProjectAiContext(summary.tasks),
      suggestedFileName: projectContextFileName,
      suggestedPath: createProjectContextExportPath(summary.tasks)
    })
  }

  async function exportLocalTodoProject(key: string): Promise<ExportLocalTodoProjectResult> {
    if (!window.api?.exportLocalTodoProject) {
      return { status: 'error', message: '.localtodo project export is not available.' }
    }

    const summary = findProjectSummary(projectSummaries.value, key)

    if (!summary) {
      return { status: 'error', message: 'Project was not found.' }
    }

    const repoPath = summary.repoPath

    if (!repoPath) {
      return { status: 'error', message: 'Project does not have a repository path.' }
    }

    return window.api.exportLocalTodoProject({
      repoPath,
      markdown: generateProjectAiContext(summary.tasks),
      tasksJson: serializeDataFile(summary.tasks)
    })
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

  async function importTodosJson(file: File): Promise<boolean> {
    const importedTodos = parseDataFileText(await file.text())

    if (importedTodos === null) {
      return false
    }

    todos.value = importedTodos
    selectTodo(null)
    return true
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
    (nextTodos) => {
      localStorage.setItem(storageKey, JSON.stringify(nextTodos))
    },
    { deep: true, immediate: true }
  )

  return {
    todos,
    draftTitle,
    selectedTodoId,
    filterState,
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
    openExportedAiContext,
    revealExportedAiContext,
    exportTodosJson,
    downloadTodosJson,
    importTodosJson
  }
}
