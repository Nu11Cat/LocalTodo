<script setup lang="ts">
import { computed, ref } from 'vue'
import ProjectDashboard from './components/ProjectDashboard.vue'
import TaskDetailPanel from './components/TaskDetailPanel.vue'
import { useTodos } from './composables/useTodos'
import { taskPriorities, taskStatuses, taskTypes } from './domain/taskModel'

const fileInput = ref<HTMLInputElement | null>(null)
const projectContextExportMessage = ref('')
const lastExportedFilePath = ref<string | null>(null)
const lastExportedAiContextFilePath = ref<string | null>(null)

const {
  todos,
  draftTitle,
  selectedTodoId,
  filterState,
  isLoaded,
  loadErrorMessage,
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
  cleanupStaleLocalTodoTaskFiles,
  openExportedAiContext,
  revealExportedAiContext,
  downloadTodosJson,
  previewTodosJsonImport,
  applyTodosJsonImport
} = useTodos()

const todosSensitiveCount = computed(() => todos.value.filter((todo) => todo.sensitive).length)

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
    projectContextExportMessage.value = `Import failed: ${preview.message}`
    input.value = ''
    return
  }

  const confirmed = window.confirm(
    `Import JSON will replace your current ${preview.currentTaskCount} task${preview.currentTaskCount === 1 ? '' : 's'} with ${preview.importTaskCount} task${preview.importTaskCount === 1 ? '' : 's'} from the selected file.\n\nLocalTodo will first create a restore point of your current tasks. Continue?`
  )

  if (!confirmed) {
    projectContextExportMessage.value = 'Import cancelled.'
    input.value = ''
    return
  }

  projectContextExportMessage.value = 'Creating restore point and importing JSON...'

  const result = await applyTodosJsonImport(preview.tasks)

  if (result.status === 'imported') {
    projectContextExportMessage.value = `Imported ${result.importedTaskCount} task${result.importedTaskCount === 1 ? '' : 's'}. Replaced ${result.previousTaskCount} task${result.previousTaskCount === 1 ? '' : 's'}. Restore point saved to ${result.restorePointPath}.`
  } else {
    projectContextExportMessage.value = `Import failed before overwrite: ${result.message}`
  }

  input.value = ''
}

function updateSelectedTodo(patch: Parameters<typeof updateTodo>[1]): void {
  if (selectedTodo.value) {
    updateTodo(selectedTodo.value.id, patch)
  }
}

function formatSensitiveExclusionMessage(count: number): string {
  if (count <= 0) {
    return ''
  }

  return ` Excluded ${count} sensitive task${count === 1 ? '' : 's'} by default.`
}

function confirmIncludeSensitiveTasks(count: number): boolean {
  if (count <= 0) {
    return false
  }

  return window.confirm(
    `${count} sensitive task${count === 1 ? '' : 's'} would be excluded by default. Include sensitive tasks for this action?`
  )
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
    ? window.confirm('This task is marked sensitive. Copy its AI Context anyway?')
    : false
  const result = await copyTaskAiContext(todo.id, { includeSensitive })

  if (result.status === 'copied') {
    projectContextExportMessage.value = 'Copied task AI context.'
    return
  }

  if (result.status === 'sensitive-blocked') {
    projectContextExportMessage.value = 'Sensitive task context was not copied.'
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
    projectContextExportMessage.value = `Copied active AI context.${formatSensitiveExclusionMessage(result.excludedSensitiveCount)}`
  }
}

async function copyProjectContext(): Promise<void> {
  const result = await copyProjectAiContext()

  if (result.status === 'copied') {
    projectContextExportMessage.value = `Copied project AI context.${formatSensitiveExclusionMessage(result.excludedSensitiveCount)}`
  }
}

async function copyProjectGroupContext(key: string): Promise<void> {
  const result = await copyProjectGroupAiContext(key)

  if (result.status === 'copied') {
    projectContextExportMessage.value = `Copied project AI context.${formatSensitiveExclusionMessage(result.excludedSensitiveCount)}`
  }
}

async function handleProjectContextExport(
  exporter: (options?: { includeSensitive?: boolean }) => ReturnType<typeof exportProjectAiContext>,
  sensitiveCount = 0
): Promise<void> {
  const includeSensitive = confirmIncludeSensitiveTasks(sensitiveCount)

  projectContextExportMessage.value = 'Exporting project context...'
  lastExportedFilePath.value = null
  lastExportedAiContextFilePath.value = null

  const result = await exporter({ includeSensitive })

  if (result.status === 'written') {
    lastExportedFilePath.value = result.filePath
    projectContextExportMessage.value = `Saved to ${result.filePath}.${formatSensitiveExclusionMessage(result.excludedSensitiveCount)}`
    return
  }

  if (result.status === 'cancelled') {
    projectContextExportMessage.value = 'Export cancelled.'
    return
  }

  projectContextExportMessage.value = `Export failed: ${result.message}`
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
    return ' Updated .gitignore with LocalTodo generated-file entries.'
  }

  if (result.gitignore.status === 'already-configured') {
    return ' Recommended .gitignore entries are already present.'
  }

  if (result.gitignore.status === 'error') {
    return ` Export succeeded, but .gitignore was not updated: ${result.gitignore.message}`
  }

  return ` Reminder: add ${result.gitignore.entries.join(', ')} to .gitignore if these should stay local.`
}

async function exportProjectLocalTodo(key: string): Promise<void> {
  const includeSensitive = confirmIncludeSensitiveTasks(countSensitiveTasks(key))
  const writeGitignore = window.confirm(
    'LocalTodo exports generated task files into this repository. Add recommended .gitignore entries so they stay local? Choose Cancel to export without changing .gitignore.'
  )

  projectContextExportMessage.value = 'Exporting .localtodo workspace...'
  lastExportedFilePath.value = null
  lastExportedAiContextFilePath.value = null

  const result = await exportLocalTodoProject(key, { includeSensitive, writeGitignore })

  if (result.status === 'written') {
    lastExportedAiContextFilePath.value = result.aiContextFilePath
    projectContextExportMessage.value = `Saved .localtodo workspace to ${result.dirPath} (${result.taskFilePaths.length} task files).${formatSensitiveExclusionMessage(result.excludedSensitiveCount)}${formatGitignoreExportMessage(result)}`
    await cleanupStaleLocalTodoTaskFilesWithConfirm(key, result.staleTaskFiles)
    return
  }

  projectContextExportMessage.value = `Export failed: ${result.message}`
}

async function cleanupStaleLocalTodoTaskFilesWithConfirm(
  key: string,
  staleTaskFiles: string[]
): Promise<void> {
  if (staleTaskFiles.length === 0) {
    return
  }

  const confirmed = window.confirm(
    `LocalTodo found ${staleTaskFiles.length} stale task file${staleTaskFiles.length === 1 ? '' : 's'} in .localtodo/tasks/ that no longer match this project:\n\n${staleTaskFiles.join('\n')}\n\nDelete these files? Choose Cancel to keep them.`
  )

  if (!confirmed) {
    projectContextExportMessage.value += ` Kept ${staleTaskFiles.length} stale task file${staleTaskFiles.length === 1 ? '' : 's'}.`
    return
  }

  const cleanup = await cleanupStaleLocalTodoTaskFiles(key, staleTaskFiles)

  if (cleanup.status === 'deleted') {
    projectContextExportMessage.value += ` Deleted ${cleanup.deletedFileNames.length} stale task file${cleanup.deletedFileNames.length === 1 ? '' : 's'}.`
    return
  }

  projectContextExportMessage.value += ` Failed to delete stale task files: ${cleanup.message}`
}

async function openLastExport(): Promise<void> {
  if (!lastExportedFilePath.value) {
    return
  }

  const result = await openExportedAiContext(lastExportedFilePath.value)

  if (result.status === 'error') {
    projectContextExportMessage.value = `Open failed: ${result.message}`
  }
}

async function revealLastExport(): Promise<void> {
  if (!lastExportedFilePath.value) {
    return
  }

  const result = await revealExportedAiContext(lastExportedFilePath.value)

  if (result.status === 'error') {
    projectContextExportMessage.value = `Reveal failed: ${result.message}`
  }
}

async function openLastAiContextFile(): Promise<void> {
  if (!lastExportedAiContextFilePath.value) {
    return
  }

  const result = await openExportedAiContext(lastExportedAiContextFilePath.value)

  if (result.status === 'error') {
    projectContextExportMessage.value = `Open failed: ${result.message}`
  }
}

async function revealLastDir(): Promise<void> {
  if (!lastExportedAiContextFilePath.value) {
    return
  }

  const result = await revealExportedAiContext(lastExportedAiContextFilePath.value)

  if (result.status === 'error') {
    projectContextExportMessage.value = `Reveal failed: ${result.message}`
  }
}
</script>

<template>
  <main class="app-shell">
    <section class="hero-card" aria-labelledby="app-title">
      <p class="eyebrow">Local-first desktop app</p>
      <h1 id="app-title">LocalTodo</h1>
      <p class="intro">Keep a lightweight task list on this device.</p>

      <form class="todo-form" @submit.prevent="addTodo">
        <label class="sr-only" for="todo-title">New todo</label>
        <input
          id="todo-title"
          v-model="draftTitle"
          type="text"
          autocomplete="off"
          placeholder="What needs to be done?"
          :disabled="!isLoaded"
        />
        <button type="submit" :disabled="!isLoaded">Add</button>
      </form>

      <p v-if="!isLoaded" class="empty-state">Loading saved tasks...</p>
      <p v-else-if="loadErrorMessage" class="empty-state">{{ loadErrorMessage }}</p>

      <div class="data-actions">
        <button
          v-if="totalActiveCount + totalCompletedCount > 0"
          type="button"
          class="ghost-button"
          @click="copyProjectContext"
        >
          Copy project context
        </button>
        <button
          v-if="totalActiveCount + totalCompletedCount > 0"
          type="button"
          class="ghost-button"
          @click="exportProjectContext"
        >
          Export project context
        </button>
        <button type="button" class="ghost-button" :disabled="!isLoaded" @click="downloadTodosJson">
          Export JSON
        </button>
        <button type="button" class="ghost-button" :disabled="!isLoaded" @click="openImportDialog">
          Import JSON
        </button>
        <input
          ref="fileInput"
          class="sr-only"
          type="file"
          accept="application/json,.json"
          @change="importSelectedFile"
        />
      </div>
      <div v-if="projectContextExportMessage" class="action-message">
        <span>{{ projectContextExportMessage }}</span>
        <span v-if="lastExportedFilePath" class="post-export-actions">
          <button type="button" class="ghost-button" @click="openLastExport">Open file</button>
          <button type="button" class="ghost-button" @click="revealLastExport">Show in folder</button>
        </span>
        <span v-if="lastExportedAiContextFilePath" class="post-export-actions">
          <button type="button" class="ghost-button" @click="openLastAiContextFile">Open AI context</button>
          <button type="button" class="ghost-button" @click="revealLastDir">Open folder</button>
        </span>
      </div>
    </section>

    <ProjectDashboard
      v-if="hasProjectDashboard"
      :summaries="projectSummaries"
      :selected-key="selectedProjectKey"
      @select="setProjectFilter"
      @copy="copyProjectGroupContext"
      @export="exportProjectGroupContext"
      @export-local-todo="exportProjectLocalTodo"
    />

    <section class="filter-bar" aria-labelledby="filter-title">
      <div class="filter-header">
        <h2 id="filter-title">Find tasks</h2>
        <button v-if="hasActiveFilters" type="button" class="ghost-button" @click="resetFilters">
          Clear filters
        </button>
      </div>

      <label class="sr-only" for="task-search">Search tasks</label>
      <input
        id="task-search"
        class="filter-search"
        type="search"
        :value="filterState.keyword"
        placeholder="Search title, description, or tags"
        @input="setFilterKeyword(($event.target as HTMLInputElement).value)"
      />

      <div class="filter-row" aria-label="Status filters">
        <span>Status</span>
        <button
          v-for="status in taskStatuses"
          :key="status"
          type="button"
          class="filter-chip"
          :class="{ 'is-active': filterState.statuses.includes(status) }"
          :aria-pressed="filterState.statuses.includes(status)"
          @click="toggleStatusFilter(status)"
        >
          {{ status }}
        </button>
      </div>

      <div class="filter-row" aria-label="Priority filters">
        <span>Priority</span>
        <button
          v-for="priority in taskPriorities"
          :key="priority"
          type="button"
          class="filter-chip"
          :class="{ 'is-active': filterState.priorities.includes(priority) }"
          :aria-pressed="filterState.priorities.includes(priority)"
          @click="togglePriorityFilter(priority)"
        >
          {{ priority }}
        </button>
      </div>

      <div class="filter-row" aria-label="Type filters">
        <span>Type</span>
        <button
          v-for="taskType in taskTypes"
          :key="taskType"
          type="button"
          class="filter-chip"
          :class="{ 'is-active': filterState.types.includes(taskType) }"
          :aria-pressed="filterState.types.includes(taskType)"
          @click="toggleTypeFilter(taskType)"
        >
          {{ taskType }}
        </button>
      </div>

      <div v-if="availableTags.length > 0" class="filter-row" aria-label="Tag filters">
        <span>Tags</span>
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
        <h2 id="active-title">Active</h2>
        <div class="panel-actions">
          <span v-if="selectedProjectKey">Project: {{ selectedProjectLabel }}</span>
          <span v-if="hasActiveFilters">{{ activeTodos.length }} of {{ totalActiveCount }} shown</span>
          <span v-else>{{ activeTodos.length }} open</span>
          <button
            v-if="activeTodos.length > 0"
            type="button"
            class="ghost-button"
            @click="copyActiveContext"
          >
            Copy active context
          </button>
        </div>
      </div>

      <p v-if="activeTodos.length === 0" class="empty-state">
        {{ hasActiveFilters ? 'No active tasks match the current filters.' : 'No active todos. Add one above.' }}
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
            <span v-if="todo.sensitive" class="sensitive-badge">Sensitive</span>
          </label>
          <div class="todo-actions">
            <button type="button" class="ghost-button" @click="selectTodo(todo.id)">Edit</button>
            <button type="button" class="ghost-button" @click="copyTodoContext(todo.id)">
              Copy AI Context
            </button>
            <button type="button" class="ghost-button" @click="removeTodo(todo.id)">Remove</button>
          </div>
        </li>
      </ul>
    </section>

    <section class="todo-panel" aria-labelledby="completed-title">
      <div class="panel-heading">
        <h2 id="completed-title">Completed</h2>
        <span v-if="hasActiveFilters">{{ completedTodos.length }} of {{ totalCompletedCount }} shown</span>
        <button
          v-if="completedTodos.length > 0"
          type="button"
          class="ghost-button"
          @click="clearCompleted"
        >
          Clear completed
        </button>
      </div>

      <p v-if="completedTodos.length === 0" class="empty-state">
        {{ hasActiveFilters ? 'No completed tasks match the current filters.' : 'Completed todos will appear here.' }}
      </p>
      <ul v-else class="todo-list completed-list">
        <li v-for="todo in completedTodos" :key="todo.id" class="todo-item">
          <label>
            <input type="checkbox" :checked="todo.status === 'done'" @change="toggleTodo(todo.id)" />
            <span>{{ todo.title }}</span>
            <span v-if="todo.sensitive" class="sensitive-badge">Sensitive</span>
          </label>
          <div class="todo-actions">
            <button type="button" class="ghost-button" @click="selectTodo(todo.id)">Edit</button>
            <button type="button" class="ghost-button" @click="copyTodoContext(todo.id)">
              Copy AI Context
            </button>
            <button type="button" class="ghost-button" @click="removeTodo(todo.id)">Remove</button>
          </div>
        </li>
      </ul>
    </section>

    <TaskDetailPanel
      :task="selectedTodo"
      :all-tasks="todos"
      @update="updateSelectedTodo"
      @close="selectTodo(null)"
      @copy="copySelectedTodoContext"
    />
  </main>
</template>
