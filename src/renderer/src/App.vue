<script setup lang="ts">
import { ref } from 'vue'
import ProjectDashboard from './components/ProjectDashboard.vue'
import TaskDetailPanel from './components/TaskDetailPanel.vue'
import { useTodos } from './composables/useTodos'
import { taskPriorities, taskStatuses, taskTypes } from './domain/taskModel'

const fileInput = ref<HTMLInputElement | null>(null)
const projectContextExportMessage = ref('')
const lastExportedFilePath = ref<string | null>(null)
const lastExportedAiContextFilePath = ref<string | null>(null)

const {
  draftTitle,
  selectedTodoId,
  filterState,
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
  downloadTodosJson,
  importTodosJson
} = useTodos()

function openImportDialog(): void {
  fileInput.value?.click()
}

async function importSelectedFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]

  if (file) {
    await importTodosJson(file)
  }

  input.value = ''
}

function updateSelectedTodo(patch: Parameters<typeof updateTodo>[1]): void {
  if (selectedTodo.value) {
    updateTodo(selectedTodo.value.id, patch)
  }
}

function copySelectedTodoContext(): void {
  if (selectedTodo.value) {
    void copyTaskAiContext(selectedTodo.value.id)
  }
}

async function handleProjectContextExport(
  exporter: () => ReturnType<typeof exportProjectAiContext>
): Promise<void> {
  projectContextExportMessage.value = 'Exporting project context...'
  lastExportedFilePath.value = null
  lastExportedAiContextFilePath.value = null

  const result = await exporter()

  if (result.status === 'written') {
    lastExportedFilePath.value = result.filePath
    projectContextExportMessage.value = `Saved to ${result.filePath}`
    return
  }

  if (result.status === 'cancelled') {
    projectContextExportMessage.value = 'Export cancelled.'
    return
  }

  projectContextExportMessage.value = `Export failed: ${result.message}`
}

async function exportProjectContext(): Promise<void> {
  await handleProjectContextExport(exportProjectAiContext)
}

async function exportProjectGroupContext(key: string): Promise<void> {
  await handleProjectContextExport(() => exportProjectGroupAiContext(key))
}

async function exportProjectLocalTodo(key: string): Promise<void> {
  projectContextExportMessage.value = 'Exporting .localtodo workspace...'
  lastExportedFilePath.value = null
  lastExportedAiContextFilePath.value = null

  const result = await exportLocalTodoProject(key)

  if (result.status === 'written') {
    lastExportedAiContextFilePath.value = result.aiContextFilePath
    projectContextExportMessage.value = `Saved .localtodo workspace to ${result.dirPath}`
    return
  }

  projectContextExportMessage.value = `Export failed: ${result.message}`
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
        />
        <button type="submit">Add</button>
      </form>

      <div class="data-actions">
        <button
          v-if="totalActiveCount + totalCompletedCount > 0"
          type="button"
          class="ghost-button"
          @click="copyProjectAiContext"
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
        <button type="button" class="ghost-button" @click="downloadTodosJson">Export JSON</button>
        <button type="button" class="ghost-button" @click="openImportDialog">Import JSON</button>
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
      @copy="copyProjectGroupAiContext"
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
            @click="copyActiveAiContext"
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
          </label>
          <div class="todo-actions">
            <button type="button" class="ghost-button" @click="selectTodo(todo.id)">Edit</button>
            <button type="button" class="ghost-button" @click="copyTaskAiContext(todo.id)">
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
          </label>
          <div class="todo-actions">
            <button type="button" class="ghost-button" @click="selectTodo(todo.id)">Edit</button>
            <button type="button" class="ghost-button" @click="copyTaskAiContext(todo.id)">
              Copy AI Context
            </button>
            <button type="button" class="ghost-button" @click="removeTodo(todo.id)">Remove</button>
          </div>
        </li>
      </ul>
    </section>

    <TaskDetailPanel
      :task="selectedTodo"
      @update="updateSelectedTodo"
      @close="selectTodo(null)"
      @copy="copySelectedTodoContext"
    />
  </main>
</template>
