<script setup lang="ts">
import { computed, ref } from 'vue'
import ProjectDashboard from './components/ProjectDashboard.vue'
import TaskDetailPanel from './components/TaskDetailPanel.vue'
import { useTodos } from './composables/useTodos'
import { useLocale, availableLocales } from './composables/useLocale'
import { useTheme, availableThemes } from './composables/useTheme'
import type { MessageKey } from './locales/en'
import { taskPriorities, taskStatuses, taskTypes } from './domain/taskModel'
import type { TaskSortKey } from './domain/taskSort'

const { t, locale, setLocale } = useLocale()
const { theme, setTheme, applyTheme } = useTheme()

// Reflect the persisted/system theme onto <html> as soon as the app script runs.
applyTheme()

const sortOptions: TaskSortKey[] = ['manual', 'updatedAt', 'createdAt', 'priority']

const fileInput = ref<HTMLInputElement | null>(null)
const projectContextExportMessage = ref('')
const savedViewName = ref('')
const lastExportedFilePath = ref<string | null>(null)
const lastExportedAiContextFilePath = ref<string | null>(null)

const {
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
  isLoaded,
  loadErrorMessage,
  activeTodos,
  completedTodos,
  totalActiveCount,
  totalCompletedCount,
  hasActiveFilters,
  hasActiveView,
  projectSummaries,
  hasProjectDashboard,
  selectedProjectKey,
  selectedProjectLabel,
  availableTags,
  selectedTodo,
  dataFileInfo,
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
  revealDataFile,
  openDataFile,
  downloadTodosJson,
  previewTodosJsonImport,
  applyTodosJsonImport
} = useTodos()

const todosSensitiveCount = computed(() => todos.value.filter((todo) => todo.sensitive).length)

const isCustomTemplateSelected = computed(() =>
  customTemplates.value.some((template) => template.id === selectedTemplateId.value)
)

const projectDefaultCommandKeys = computed(() =>
  projectDefaultCommands.value.map((entry) => entry.key)
)

// Built-in templates carry English labels; map them to the active locale by id.
// Custom templates use a user-provided name, so they are shown verbatim.
const builtinTemplateIds = new Set(['blank', 'bug', 'feature', 'refactor', 'release'])

function templateLabel(template: { id: string; label: string }): string {
  return builtinTemplateIds.has(template.id)
    ? t(`template.${template.id}` as MessageKey)
    : template.label
}

// summary.label is the canonical English fallback ("(No project)") for the
// unassigned group; localize the label for display without mutating stored data.
function projectLabel(summary: { projectName?: string; repoPath?: string; label: string }): string {
  return summary.projectName || summary.repoPath ? summary.label : t('project.noProject')
}

const selectedProjectLabelLocalized = computed(() => {
  const summary = projectSummaries.value.find((item) => item.key === selectedProjectKey.value)

  return summary ? projectLabel(summary) : selectedProjectLabel.value
})

// Enum/option values are stored in their canonical English form; these map them to
// the active locale for display only.
function sortLabel(key: TaskSortKey): string {
  return t(`sort.${key}` as const)
}

function statusLabel(status: (typeof taskStatuses)[number]): string {
  return t(`status.${status}` as const)
}

function priorityLabel(priority: (typeof taskPriorities)[number]): string {
  return t(`priority.${priority}` as const)
}

function typeLabel(taskType: (typeof taskTypes)[number]): string {
  return t(`type.${taskType}` as const)
}

// Count fragments used to fill {count}-style placeholders in messages/confirms.
function taskCount(n: number): string {
  return t('count.task', { n })
}

function sensitiveTaskCount(n: number): string {
  return t('count.sensitiveTask', { n })
}

function defaultCommandCount(n: number): string {
  return t('count.defaultCommand', { n })
}

function staleTaskFileCount(n: number): string {
  return t('count.staleTaskFile', { n })
}

function taskFileCount(n: number): string {
  return t('count.taskFile', { n })
}

function formatBytes(size: number): string {
  if (size < 1024) {
    return `${size} B`
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function formatDataFileTimestamp(ms: number): string {
  return new Date(ms).toLocaleString()
}

async function revealDataFileLocation(): Promise<void> {
  const result = await revealDataFile()

  if (result.status === 'error') {
    projectContextExportMessage.value = t('msg.showInFolderFailed', { message: result.message })
  }
}

async function openDataFileLocation(): Promise<void> {
  const result = await openDataFile()

  if (result.status === 'error') {
    projectContextExportMessage.value = t('msg.openDataFileFailed', { message: result.message })
  }
}

function openImportDialog(): void {
  fileInput.value?.click()
}

async function importSelectedFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]

  if (!file) {
    input.value = ''
    return
  }

  const preview = await previewTodosJsonImport(file)

  if (preview.status !== 'ready') {
    projectContextExportMessage.value = t('msg.importFailed', { message: preview.message })
    input.value = ''
    return
  }

  const confirmed = window.confirm(
    t('confirm.importJson', {
      current: taskCount(preview.currentTaskCount),
      import: taskCount(preview.importTaskCount)
    })
  )

  if (!confirmed) {
    projectContextExportMessage.value = t('msg.importCancelled')
    input.value = ''
    return
  }

  projectContextExportMessage.value = t('msg.importing')

  const result = await applyTodosJsonImport(preview.tasks)

  if (result.status === 'imported') {
    projectContextExportMessage.value = t('msg.imported', {
      imported: taskCount(result.importedTaskCount),
      previous: taskCount(result.previousTaskCount),
      path: result.restorePointPath
    })
  } else {
    projectContextExportMessage.value = t('msg.importFailedBeforeOverwrite', {
      message: result.message
    })
  }

  input.value = ''
}

function updateSelectedTodo(patch: Parameters<typeof updateTodo>[1]): void {
  if (selectedTodo.value) {
    updateTodo(selectedTodo.value.id, patch)
  }
}

function changeSortKey(key: TaskSortKey): void {
  setSortState({ key, direction: sortState.value.direction })
}

function toggleSortDirection(): void {
  setSortState({
    key: sortState.value.key,
    direction: sortState.value.direction === 'asc' ? 'desc' : 'asc'
  })
}

function saveCurrentFilterView(): void {
  const name = savedViewName.value.trim()

  if (!saveCurrentView(name)) {
    return
  }

  savedViewName.value = ''
  projectContextExportMessage.value = t('msg.savedView', { name })
}

function deleteSavedFilterView(id: string, name: string): void {
  const confirmed = window.confirm(t('confirm.deleteSavedView', { name }))

  if (!confirmed) {
    return
  }

  deleteSavedView(id)
}

function addNoteToSelectedTodo(content: string): void {
  if (selectedTodo.value) {
    addTaskNote(selectedTodo.value.id, content)
  }
}

function removeNoteFromSelectedTodo(noteId: string): void {
  if (selectedTodo.value) {
    removeTaskNote(selectedTodo.value.id, noteId)
  }
}

function formatSensitiveExclusionMessage(count: number): string {
  if (count <= 0) {
    return ''
  }

  return t('msg.excludedSensitive', { count: sensitiveTaskCount(count) })
}

function confirmIncludeSensitiveTasks(count: number): boolean {
  if (count <= 0) {
    return false
  }

  return window.confirm(t('confirm.includeSensitive', { count: sensitiveTaskCount(count) }))
}

function countSensitiveTasks(key?: string): number {
  if (key === undefined) {
    return activeTodos.value.filter((todo) => todo.sensitive).length
  }

  const summary = projectSummaries.value.find((item) => item.key === key)

  return summary?.tasks.filter((todo) => todo.sensitive).length ?? 0
}

async function copyTodoContext(id: string): Promise<void> {
  const todo = todos.value.find((item) => item.id === id)

  if (!todo) {
    return
  }

  const includeSensitive = todo.sensitive
    ? window.confirm(t('confirm.copySensitive'))
    : false
  const result = await copyTaskAiContext(todo.id, { includeSensitive })

  if (result.status === 'copied') {
    projectContextExportMessage.value = t('msg.copiedTaskContext')
    return
  }

  if (result.status === 'sensitive-blocked') {
    projectContextExportMessage.value = t('msg.sensitiveNotCopied')
  }
}

async function copySelectedTodoContext(): Promise<void> {
  if (selectedTodo.value) {
    await copyTodoContext(selectedTodo.value.id)
  }
}

async function copyActiveContext(): Promise<void> {
  const result = await copyActiveAiContext()

  if (result.status === 'copied') {
    projectContextExportMessage.value = t('msg.copiedActiveContext', {
      excluded: formatSensitiveExclusionMessage(result.excludedSensitiveCount)
    })
  }
}

async function copyProjectContext(): Promise<void> {
  const result = await copyProjectAiContext()

  if (result.status === 'copied') {
    projectContextExportMessage.value = t('msg.copiedProjectContext', {
      excluded: formatSensitiveExclusionMessage(result.excludedSensitiveCount)
    })
  }
}

async function copyProjectGroupContext(key: string): Promise<void> {
  const result = await copyProjectGroupAiContext(key)

  if (result.status === 'copied') {
    projectContextExportMessage.value = t('msg.copiedProjectContext', {
      excluded: formatSensitiveExclusionMessage(result.excludedSensitiveCount)
    })
  }
}

async function setProjectRepoPathFromDashboard(key: string): Promise<void> {
  if (!window.api?.selectDirectory) {
    return
  }

  const result = await window.api.selectDirectory()

  if (result.status !== 'selected') {
    return
  }

  const summary = projectSummaries.value.find((item) => item.key === key)

  if (!summary) {
    projectContextExportMessage.value = t('msg.projectNotFound')
    return
  }

  if (
    summary.tasks.length > 1 &&
    !window.confirm(t('confirm.setRepoPath', { count: taskCount(summary.tasks.length), name: projectLabel(summary) }))
  ) {
    return
  }

  const changed = setProjectRepoPath(key, result.dirPath)
  projectContextExportMessage.value = t('msg.setRepoPath', { count: taskCount(changed) })
}

function setProjectDefaultCommandsFromDashboard(key: string): void {
  const summary = projectSummaries.value.find((item) => item.key === key)

  if (!summary) {
    projectContextExportMessage.value = t('msg.projectNotFound')
    return
  }

  const current = getProjectDefaultCommands(key)
  const input = window.prompt(t('prompt.defaultCommands', { name: projectLabel(summary) }), current.join(', '))

  // Cancel (null) leaves the saved defaults untouched; an empty string clears them.
  if (input === null) {
    return
  }

  const commands = input
    .split(',')
    .map((command) => command.trim())
    .filter(Boolean)

  setProjectDefaultCommands(key, commands)
  projectContextExportMessage.value =
    commands.length > 0
      ? t('msg.savedDefaultCommands', { count: defaultCommandCount(commands.length), name: projectLabel(summary) })
      : t('msg.clearedDefaultCommands', { name: projectLabel(summary) })
}

function saveSelectedTaskAsTemplate(): void {
  const task = selectedTodo.value

  if (!task) {
    return
  }

  const name = window.prompt(t('prompt.templateName'))

  if (!name?.trim()) {
    return
  }

  if (saveTaskAsTemplate(name, task)) {
    projectContextExportMessage.value = t('msg.savedTemplate', { name: name.trim() })
  }
}

function deleteSelectedTemplate(): void {
  const template = customTemplates.value.find((item) => item.id === selectedTemplateId.value)

  if (!template) {
    return
  }

  if (!window.confirm(t('confirm.deleteTemplate', { name: template.name }))) {
    return
  }

  deleteCustomTemplate(template.id)
  projectContextExportMessage.value = t('msg.deletedTemplate', { name: template.name })
}

async function handleProjectContextExport(
  exporter: (options?: { includeSensitive?: boolean }) => ReturnType<typeof exportProjectAiContext>,
  sensitiveCount = 0
): Promise<void> {
  const includeSensitive = confirmIncludeSensitiveTasks(sensitiveCount)

  projectContextExportMessage.value = t('msg.exportingContext')
  lastExportedFilePath.value = null
  lastExportedAiContextFilePath.value = null

  const result = await exporter({ includeSensitive })

  if (result.status === 'written') {
    lastExportedFilePath.value = result.filePath
    projectContextExportMessage.value = t('msg.savedTo', {
      path: result.filePath,
      excluded: formatSensitiveExclusionMessage(result.excludedSensitiveCount)
    })
    return
  }

  if (result.status === 'cancelled') {
    projectContextExportMessage.value = t('msg.exportCancelled')
    return
  }

  projectContextExportMessage.value = t('msg.exportFailed', { message: result.message })
}

async function exportProjectContext(): Promise<void> {
  await handleProjectContextExport(exportProjectAiContext, todosSensitiveCount.value)
}

async function exportProjectGroupContext(key: string): Promise<void> {
  await handleProjectContextExport((options) => exportProjectGroupAiContext(key, options), countSensitiveTasks(key))
}

function formatGitignoreExportMessage(result: Awaited<ReturnType<typeof exportLocalTodoProject>>): string {
  if (result.status !== 'written') {
    return ''
  }

  if (result.gitignore.status === 'updated') {
    return t('msg.gitignoreUpdated')
  }

  if (result.gitignore.status === 'already-configured') {
    return t('msg.gitignoreAlready')
  }

  if (result.gitignore.status === 'error') {
    return t('msg.gitignoreError', { message: result.gitignore.message })
  }

  return t('msg.gitignoreReminder', { entries: result.gitignore.entries.join(', ') })
}

async function exportProjectLocalTodo(key: string): Promise<void> {
  const includeSensitive = confirmIncludeSensitiveTasks(countSensitiveTasks(key))
  const writeGitignore = window.confirm(t('confirm.writeGitignore'))

  projectContextExportMessage.value = t('msg.exportingLocalTodo')
  lastExportedFilePath.value = null
  lastExportedAiContextFilePath.value = null

  const result = await exportLocalTodoProject(key, { includeSensitive, writeGitignore })

  if (result.status === 'written') {
    lastExportedAiContextFilePath.value = result.aiContextFilePath
    projectContextExportMessage.value = t('msg.savedLocalTodo', {
      dir: result.dirPath,
      count: taskFileCount(result.taskFilePaths.length),
      excluded: formatSensitiveExclusionMessage(result.excludedSensitiveCount),
      gitignore: formatGitignoreExportMessage(result)
    })
    await cleanupStaleLocalTodoTaskFilesWithConfirm(key, result.staleTaskFiles)
    return
  }

  projectContextExportMessage.value = t('msg.exportFailed', { message: result.message })
}

async function cleanupStaleLocalTodoTaskFilesWithConfirm(
  key: string,
  staleTaskFiles: string[]
): Promise<void> {
  if (staleTaskFiles.length === 0) {
    return
  }

  const confirmed = window.confirm(
    t('confirm.cleanupStale', {
      count: staleTaskFileCount(staleTaskFiles.length),
      files: staleTaskFiles.join('\n')
    })
  )

  if (!confirmed) {
    projectContextExportMessage.value += t('msg.keptStale', {
      count: staleTaskFileCount(staleTaskFiles.length)
    })
    return
  }

  const cleanup = await cleanupStaleLocalTodoTaskFiles(key, staleTaskFiles)

  if (cleanup.status === 'deleted') {
    projectContextExportMessage.value += t('msg.deletedStale', {
      count: staleTaskFileCount(cleanup.deletedFileNames.length)
    })
    return
  }

  projectContextExportMessage.value += t('msg.deleteStaleFailed', { message: cleanup.message })
}

async function openLastExport(): Promise<void> {
  if (!lastExportedFilePath.value) {
    return
  }

  const result = await openExportedAiContext(lastExportedFilePath.value)

  if (result.status === 'error') {
    projectContextExportMessage.value = t('msg.openFailed', { message: result.message })
  }
}

async function revealLastExport(): Promise<void> {
  if (!lastExportedFilePath.value) {
    return
  }

  const result = await revealExportedAiContext(lastExportedFilePath.value)

  if (result.status === 'error') {
    projectContextExportMessage.value = t('msg.revealFailed', { message: result.message })
  }
}

async function openLastAiContextFile(): Promise<void> {
  if (!lastExportedAiContextFilePath.value) {
    return
  }

  const result = await openExportedAiContext(lastExportedAiContextFilePath.value)

  if (result.status === 'error') {
    projectContextExportMessage.value = t('msg.openFailed', { message: result.message })
  }
}

async function revealLastDir(): Promise<void> {
  if (!lastExportedAiContextFilePath.value) {
    return
  }

  const result = await revealExportedAiContext(lastExportedAiContextFilePath.value)

  if (result.status === 'error') {
    projectContextExportMessage.value = t('msg.revealFailed', { message: result.message })
  }
}
</script>

<template>
  <main class="app-shell">
    <section class="hero-card" aria-labelledby="app-title">
      <div class="hero-top">
        <p class="eyebrow">{{ t('app.eyebrow') }}</p>
        <div class="hero-switchers">
          <label class="language-switcher">
            <span class="sr-only">{{ t('app.theme') }}</span>
            <select :value="theme" @change="setTheme(($event.target as HTMLSelectElement).value as 'light' | 'dark' | 'system')">
              <option v-for="option in availableThemes" :key="option.value" :value="option.value">
                {{ t(option.labelKey) }}
              </option>
            </select>
          </label>
          <label class="language-switcher">
            <span class="sr-only">{{ t('app.language') }}</span>
            <select :value="locale" @change="setLocale(($event.target as HTMLSelectElement).value as 'en' | 'zh')">
              <option v-for="option in availableLocales" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </label>
        </div>
      </div>
      <h1 id="app-title">{{ t('app.title') }}</h1>
      <p class="intro">{{ t('app.intro') }}</p>

      <form class="todo-form" @submit.prevent="addTodo">
        <label class="sr-only" for="todo-title">{{ t('form.newTodo') }}</label>
        <input
          id="todo-title"
          v-model="draftTitle"
          type="text"
          autocomplete="off"
          :placeholder="t('form.titlePlaceholder')"
          :disabled="!isLoaded"
        />
        <label class="sr-only" for="todo-template">{{ t('form.taskTemplate') }}</label>
        <select id="todo-template" v-model="selectedTemplateId" :disabled="!isLoaded">
          <option v-for="template in availableTemplates" :key="template.id" :value="template.id">
            {{ templateLabel(template) }}
          </option>
        </select>
        <button
          v-if="isCustomTemplateSelected"
          type="button"
          class="ghost-button"
          :disabled="!isLoaded"
          @click="deleteSelectedTemplate"
        >
          {{ t('form.deleteTemplate') }}
        </button>
        <button type="submit" :disabled="!isLoaded">{{ t('form.add') }}</button>
      </form>

      <p v-if="!isLoaded" class="empty-state">{{ t('state.loading') }}</p>
      <p v-else-if="loadErrorMessage" class="empty-state">{{ loadErrorMessage }}</p>

      <div class="data-actions">
        <button
          v-if="totalActiveCount + totalCompletedCount > 0"
          type="button"
          class="ghost-button"
          @click="copyProjectContext"
        >
          {{ t('data.copyProjectContext') }}
        </button>
        <button
          v-if="totalActiveCount + totalCompletedCount > 0"
          type="button"
          class="ghost-button"
          @click="exportProjectContext"
        >
          {{ t('data.exportProjectContext') }}
        </button>
        <button type="button" class="ghost-button" :disabled="!isLoaded" @click="downloadTodosJson">
          {{ t('data.exportJson') }}
        </button>
        <button type="button" class="ghost-button" :disabled="!isLoaded" @click="openImportDialog">
          {{ t('data.importJson') }}
        </button>
        <input
          ref="fileInput"
          class="sr-only"
          type="file"
          accept="application/json,.json"
          @change="importSelectedFile"
        />
      </div>
      <div v-if="dataFileInfo" class="data-file-info">
        <div class="data-file-info-text">
          <span class="data-file-path">{{ dataFileInfo.filePath }}</span>
          <span v-if="dataFileInfo.exists" class="data-file-meta">
            {{ formatBytes(dataFileInfo.size ?? 0) }} ·
            {{ t('data.lastSaved', { time: formatDataFileTimestamp(dataFileInfo.modifiedAtMs ?? 0) }) }}
          </span>
          <span v-else class="data-file-meta">
            {{ t('data.noDataFile') }}
          </span>
        </div>
        <div v-if="dataFileInfo.exists" class="post-export-actions">
          <button type="button" class="ghost-button" @click="revealDataFileLocation">
            {{ t('data.showInFolder') }}
          </button>
          <button type="button" class="ghost-button" @click="openDataFileLocation">{{ t('data.openFile') }}</button>
        </div>
      </div>
      <div v-if="projectContextExportMessage" class="action-message">
        <span>{{ projectContextExportMessage }}</span>
        <span v-if="lastExportedFilePath" class="post-export-actions">
          <button type="button" class="ghost-button" @click="openLastExport">{{ t('data.openFile') }}</button>
          <button type="button" class="ghost-button" @click="revealLastExport">{{ t('data.showInFolder') }}</button>
        </span>
        <span v-if="lastExportedAiContextFilePath" class="post-export-actions">
          <button type="button" class="ghost-button" @click="openLastAiContextFile">{{ t('data.openAiContext') }}</button>
          <button type="button" class="ghost-button" @click="revealLastDir">{{ t('data.openFolder') }}</button>
        </span>
      </div>
    </section>

    <ProjectDashboard
      v-if="hasProjectDashboard"
      :summaries="projectSummaries"
      :selected-key="selectedProjectKey"
      :default-command-keys="projectDefaultCommandKeys"
      @select="setProjectFilter"
      @copy="copyProjectGroupContext"
      @export="exportProjectGroupContext"
      @export-local-todo="exportProjectLocalTodo"
      @set-repo-path="setProjectRepoPathFromDashboard"
      @set-default-commands="setProjectDefaultCommandsFromDashboard"
    />

    <section class="filter-bar" aria-labelledby="filter-title">
      <div class="filter-header">
        <h2 id="filter-title">{{ t('filter.title') }}</h2>
        <button v-if="hasActiveView" type="button" class="ghost-button" @click="resetFilters">
          {{ t('filter.clear') }}
        </button>
      </div>

      <label class="sr-only" for="task-search">{{ t('filter.search') }}</label>
      <input
        id="task-search"
        class="filter-search"
        type="search"
        :value="filterState.keyword"
        :placeholder="t('filter.searchPlaceholder')"
        @input="setFilterKeyword(($event.target as HTMLInputElement).value)"
      />

      <div class="filter-row" :aria-label="t('filter.quickViews')">
        <span>{{ t('filter.quickViews') }}</span>
        <button
          v-for="quickView in quickViews"
          :key="quickView.id"
          type="button"
          class="filter-chip"
          @click="applyQuickView(quickView.id)"
        >
          {{ t(`quickView.${quickView.id}`) }}
        </button>
      </div>

      <div class="filter-row" :aria-label="t('filter.savedViews')">
        <span>{{ t('filter.savedViews') }}</span>
        <span v-for="view in savedViews" :key="view.id" class="saved-view-chip">
          <button type="button" class="filter-chip saved-view-apply" @click="applySavedView(view.id)">
            {{ view.name }}
          </button>
          <button
            type="button"
            class="saved-view-remove"
            :aria-label="t('filter.deleteSavedView', { name: view.name })"
            @click="deleteSavedFilterView(view.id, view.name)"
          >
            ×
          </button>
        </span>
        <label class="sr-only" for="saved-view-name">{{ t('filter.savedViewName') }}</label>
        <input
          id="saved-view-name"
          v-model="savedViewName"
          class="saved-view-input"
          type="text"
          autocomplete="off"
          :placeholder="t('filter.nameThisView')"
          @keyup.enter="saveCurrentFilterView"
        />
        <button
          type="button"
          class="filter-chip"
          :disabled="!savedViewName.trim()"
          @click="saveCurrentFilterView"
        >
          {{ t('filter.saveView') }}
        </button>
      </div>

      <div class="filter-row" :aria-label="t('filter.sort')">
        <span>{{ t('filter.sort') }}</span>
        <label class="sr-only" for="task-sort">{{ t('filter.sortBy') }}</label>
        <select id="task-sort" :value="sortState.key" @change="changeSortKey(($event.target as HTMLSelectElement).value as TaskSortKey)">
          <option v-for="option in sortOptions" :key="option" :value="option">
            {{ sortLabel(option) }}
          </option>
        </select>
        <button
          type="button"
          class="filter-chip"
          :disabled="sortState.key === 'manual'"
          :aria-label="sortState.direction === 'asc' ? t('filter.sortAscending') : t('filter.sortDescending')"
          @click="toggleSortDirection"
        >
          {{ sortState.direction === 'asc' ? t('filter.asc') : t('filter.desc') }}
        </button>
      </div>

      <div class="filter-row" :aria-label="t('filter.status')">
        <span>{{ t('filter.status') }}</span>
        <button
          v-for="status in taskStatuses"
          :key="status"
          type="button"
          class="filter-chip"
          :class="{ 'is-active': filterState.statuses.includes(status) }"
          :aria-pressed="filterState.statuses.includes(status)"
          @click="toggleStatusFilter(status)"
        >
          {{ statusLabel(status) }}
        </button>
      </div>

      <div class="filter-row" :aria-label="t('filter.priority')">
        <span>{{ t('filter.priority') }}</span>
        <button
          v-for="priority in taskPriorities"
          :key="priority"
          type="button"
          class="filter-chip"
          :class="{ 'is-active': filterState.priorities.includes(priority) }"
          :aria-pressed="filterState.priorities.includes(priority)"
          @click="togglePriorityFilter(priority)"
        >
          {{ priorityLabel(priority) }}
        </button>
      </div>

      <div class="filter-row" :aria-label="t('filter.type')">
        <span>{{ t('filter.type') }}</span>
        <button
          v-for="taskType in taskTypes"
          :key="taskType"
          type="button"
          class="filter-chip"
          :class="{ 'is-active': filterState.types.includes(taskType) }"
          :aria-pressed="filterState.types.includes(taskType)"
          @click="toggleTypeFilter(taskType)"
        >
          {{ typeLabel(taskType) }}
        </button>
      </div>

      <div v-if="availableTags.length > 0" class="filter-row" :aria-label="t('filter.tags')">
        <span>{{ t('filter.tags') }}</span>
        <button
          type="button"
          class="filter-chip"
          :class="{ 'is-active': filterState.tagMatchMode === 'any' }"
          :aria-pressed="filterState.tagMatchMode === 'any'"
          @click="setTagMatchMode(filterState.tagMatchMode === 'any' ? 'all' : 'any')"
        >
          {{ filterState.tagMatchMode === 'any' ? t('filter.matchAny') : t('filter.matchAll') }}
        </button>
        <button
          v-for="tag in availableTags"
          :key="tag"
          type="button"
          class="filter-chip"
          :class="{ 'is-active': filterState.tags.some((selectedTag) => selectedTag.toLowerCase() === tag.toLowerCase()) }"
          :aria-pressed="filterState.tags.some((selectedTag) => selectedTag.toLowerCase() === tag.toLowerCase())"
          @click="toggleTagFilter(tag)"
        >
          {{ tag }}
        </button>
      </div>
    </section>

    <section class="todo-panel" aria-labelledby="active-title">
      <div class="panel-heading">
        <h2 id="active-title">{{ t('panel.active') }}</h2>
        <div class="panel-actions">
          <span v-if="selectedProjectKey">{{ t('panel.project', { name: selectedProjectLabelLocalized }) }}</span>
          <span v-if="hasActiveFilters">{{ t('panel.shown', { shown: activeTodos.length, total: totalActiveCount }) }}</span>
          <span v-else>{{ t('panel.open', { count: activeTodos.length }) }}</span>
          <button
            v-if="activeTodos.length > 0"
            type="button"
            class="ghost-button"
            @click="copyActiveContext"
          >
            {{ t('panel.copyActiveContext') }}
          </button>
        </div>
      </div>

      <p v-if="activeTodos.length === 0" class="empty-state">
        {{ hasActiveFilters ? t('panel.noActiveMatch') : t('panel.noActive') }}
      </p>
      <ul v-else class="todo-list">
        <li
          v-for="todo in activeTodos"
          :key="todo.id"
          class="todo-item"
          :class="{ 'is-selected': selectedTodoId === todo.id }"
          :aria-selected="selectedTodoId === todo.id"
        >
          <label>
            <input type="checkbox" :checked="todo.status === 'done'" @change="toggleTodo(todo.id)" />
            <span>{{ todo.title }}</span>
            <span v-if="todo.sensitive" class="sensitive-badge">{{ t('todo.sensitive') }}</span>
          </label>
          <div class="todo-actions">
            <button type="button" class="ghost-button" @click="selectTodo(todo.id)">{{ t('todo.edit') }}</button>
            <button type="button" class="ghost-button" @click="copyTodoContext(todo.id)">
              {{ t('todo.copyAiContext') }}
            </button>
            <button type="button" class="ghost-button" @click="removeTodo(todo.id)">{{ t('todo.remove') }}</button>
          </div>
        </li>
      </ul>
    </section>

    <section class="todo-panel" aria-labelledby="completed-title">
      <div class="panel-heading">
        <h2 id="completed-title">{{ t('panel.completed') }}</h2>
        <span v-if="hasActiveFilters">{{ t('panel.shown', { shown: completedTodos.length, total: totalCompletedCount }) }}</span>
        <button
          v-if="completedTodos.length > 0"
          type="button"
          class="ghost-button"
          @click="clearCompleted"
        >
          {{ t('panel.clearCompleted') }}
        </button>
      </div>

      <p v-if="completedTodos.length === 0" class="empty-state">
        {{ hasActiveFilters ? t('panel.noCompletedMatch') : t('panel.noCompleted') }}
      </p>
      <ul v-else class="todo-list completed-list">
        <li v-for="todo in completedTodos" :key="todo.id" class="todo-item">
          <label>
            <input type="checkbox" :checked="todo.status === 'done'" @change="toggleTodo(todo.id)" />
            <span>{{ todo.title }}</span>
            <span v-if="todo.sensitive" class="sensitive-badge">{{ t('todo.sensitive') }}</span>
          </label>
          <div class="todo-actions">
            <button type="button" class="ghost-button" @click="selectTodo(todo.id)">{{ t('todo.edit') }}</button>
            <button type="button" class="ghost-button" @click="copyTodoContext(todo.id)">
              {{ t('todo.copyAiContext') }}
            </button>
            <button type="button" class="ghost-button" @click="removeTodo(todo.id)">{{ t('todo.remove') }}</button>
          </div>
        </li>
      </ul>
    </section>

    <TaskDetailPanel
      :task="selectedTodo"
      :all-tasks="todos"
      @update="updateSelectedTodo"
      @add-note="addNoteToSelectedTodo"
      @remove-note="removeNoteFromSelectedTodo"
      @close="selectTodo(null)"
      @copy="copySelectedTodoContext"
      @save-as-template="saveSelectedTaskAsTemplate"
    />
  </main>
</template>
