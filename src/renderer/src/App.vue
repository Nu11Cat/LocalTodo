<script setup lang="ts">
import { computed, ref } from 'vue'
import TaskDetailPanel from './components/TaskDetailPanel.vue'
import TodoRow from './components/TodoRow.vue'
import AppTitlebar from './components/AppTitlebar.vue'
import AppSidebar from './components/AppSidebar.vue'
import AppStatusbar from './components/AppStatusbar.vue'
import SplitPane from './components/SplitPane.vue'
import { useTodos } from './composables/useTodos'
import { useLocale } from './composables/useLocale'
import { useTheme } from './composables/useTheme'
import { useLayout, navWidthMin, navWidthMax, detailWidthMin, detailWidthMax } from './composables/useLayout'
import { taskPriorities, taskStatuses, taskTypes, type TaskStatus } from './domain/taskModel'
import type { TaskSortKey } from './domain/taskSort'

const { t } = useLocale()
const { applyTheme } = useTheme()
const {
  navWidth,
  detailWidth,
  navCollapsed,
  setNavWidth,
  setDetailWidth,
  toggleNavCollapsed
} = useLayout()

// Inline CSS vars threaded to the workspace grid so useLayout's reactive widths
// drive `grid-template-columns` directly (no per-column style attribute).
const workspaceStyle = computed(() => ({
  '--nav-w': `${navWidth.value}px`,
  '--detail-w': `${detailWidth.value}px`
}))

// Reflect the persisted/system theme onto <html> as soon as the app script runs.
applyTheme()

const sortOptions: TaskSortKey[] = ['manual', 'updatedAt', 'createdAt', 'priority']

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
  selectedProjectKey,
  selectedProjectLabel,
  availableTags,
  selectedTodo,
  dataFileInfo,
  addTodo,
  toggleTodo,
  selectTodo,
  updateTodo,
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
  exportProjectAiContext,
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

const hasAnyTodos = computed(() => totalActiveCount.value + totalCompletedCount.value > 0)

// Per-status task counts drive the badges in the sidebar Status group. Include
// every status (done too) in a single O(n) pass — the sidebar renders the
// number only when > 0 so an empty bucket stays visually clean.
const statusCounts = computed<Record<TaskStatus, number>>(() => {
  const counts: Record<TaskStatus, number> = {
    inbox: 0,
    todo: 0,
    doing: 0,
    blocked: 0,
    review: 0,
    done: 0
  }

  for (const task of todos.value) {
    counts[task.status] += 1
  }

  return counts
})

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

async function revealLastAiContextFile(): Promise<void> {
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
  <div class="app-workspace" :class="{ 'is-nav-collapsed': navCollapsed }" :style="workspaceStyle">
    <AppTitlebar
      :draft-title="draftTitle"
      :selected-template-id="selectedTemplateId"
      :available-templates="availableTemplates"
      :is-custom-template-selected="isCustomTemplateSelected"
      :is-loaded="isLoaded"
      :has-any-todos="hasAnyTodos"
      @update:draft-title="(value) => (draftTitle = value)"
      @update:selected-template-id="(value) => (selectedTemplateId = value)"
      @add-todo="addTodo"
      @delete-selected-template="deleteSelectedTemplate"
      @copy-project-context="copyProjectContext"
      @export-project-context="exportProjectContext"
      @download-json="downloadTodosJson"
      @import-file="importSelectedFile"
    />

    <AppSidebar
      :collapsed="navCollapsed"
      :quick-views="quickViews"
      :saved-views="savedViews"
      :project-summaries="projectSummaries"
      :selected-project-key="selectedProjectKey"
      :active-statuses="filterState.statuses"
      :status-counts="statusCounts"
      @toggle-collapsed="toggleNavCollapsed"
      @apply-quick-view="applyQuickView"
      @toggle-status="toggleStatusFilter"
      @select-project="setProjectFilter"
      @apply-saved-view="applySavedView"
      @delete-saved-view="deleteSavedFilterView"
      @reset-filters="resetFilters"
    />

    <SplitPane
      class="app-workspace-nav-split"
      :size="navWidth"
      :min="navWidthMin"
      :max="navWidthMax"
      origin="left"
      aria-label="Resize navigation column"
      @update:size="setNavWidth"
    />

    <main class="app-workspace-main">
      <div class="app-shell">
        <p v-if="!isLoaded" class="empty-state">{{ t('state.loading') }}</p>
        <p v-else-if="loadErrorMessage" class="empty-state">{{ loadErrorMessage }}</p>

        <div v-if="projectContextExportMessage" class="action-message">
          <span>{{ projectContextExportMessage }}</span>
          <span v-if="lastExportedFilePath" class="post-export-actions">
            <button type="button" class="ghost-button" @click="openLastExport">{{ t('data.openFile') }}</button>
            <button type="button" class="ghost-button" @click="revealLastExport">{{ t('data.showInFolder') }}</button>
          </span>
          <span v-if="lastExportedAiContextFilePath" class="post-export-actions">
            <button type="button" class="ghost-button" @click="openLastAiContextFile">{{ t('data.openAiContext') }}</button>
            <button type="button" class="ghost-button" @click="revealLastAiContextFile">{{ t('data.openFolder') }}</button>
          </span>
        </div>

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

          <div class="filter-row" :aria-label="t('filter.savedViews')">
            <span>{{ t('filter.savedViews') }}</span>
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
          <ul v-else class="todo-list" role="listbox" :aria-label="t('panel.active')">
            <TodoRow
              v-for="todo in activeTodos"
              :key="todo.id"
              :todo="todo"
              :selected="selectedTodoId === todo.id"
              @toggle="toggleTodo"
              @select="selectTodo"
              @copy="copyTodoContext"
              @remove="removeTodo"
            />
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
          <ul
            v-else
            class="todo-list completed-list"
            role="listbox"
            :aria-label="t('panel.completed')"
          >
            <TodoRow
              v-for="todo in completedTodos"
              :key="todo.id"
              :todo="todo"
              :selected="selectedTodoId === todo.id"
              @toggle="toggleTodo"
              @select="selectTodo"
              @copy="copyTodoContext"
              @remove="removeTodo"
            />
          </ul>
        </section>
      </div>
    </main>

    <SplitPane
      class="app-workspace-detail-split"
      :size="detailWidth"
      :min="detailWidthMin"
      :max="detailWidthMax"
      origin="right"
      aria-label="Resize detail column"
      @update:size="setDetailWidth"
    />

    <aside class="app-workspace-detail" aria-label="Task detail">
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
    </aside>

    <AppStatusbar
      :data-file-info="dataFileInfo"
      :active-count="totalActiveCount"
      :completed-count="totalCompletedCount"
      @reveal-data-file="revealDataFileLocation"
      @open-data-file="openDataFileLocation"
    />
  </div>
</template>
