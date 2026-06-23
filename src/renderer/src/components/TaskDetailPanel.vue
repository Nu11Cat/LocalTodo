<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  taskPriorities,
  taskStatuses,
  taskTypes,
  type Task,
  type TaskPriority,
  type TaskStatus,
  type TaskType
} from '@renderer/domain/taskModel'
import { isAbsoluteRepoPath } from '@renderer/domain/repoPath'

type TaskPatch = Partial<{
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

const props = withDefaults(
  defineProps<{
    task: Task | null
    allTasks?: Task[]
  }>(),
  {
    allTasks: () => []
  }
)

const emit = defineEmits<{
  update: [patch: TaskPatch]
  addNote: [content: string]
  removeNote: [noteId: string]
  close: []
  copy: []
}>()

const projectNameDraft = ref('')
const repoPathDraft = ref('')
const tagDraft = ref('')
const relatedFileDraft = ref('')
const commandDraft = ref('')
const descriptionDraft = ref('')
const noteDraft = ref('')

watch(
  () => props.task,
  (task) => {
    projectNameDraft.value = task?.projectName ?? ''
    repoPathDraft.value = task?.repoPath ?? ''
    tagDraft.value = ''
    relatedFileDraft.value = ''
    commandDraft.value = ''
    descriptionDraft.value = task?.description ?? ''
    noteDraft.value = ''
  },
  { immediate: true }
)

function updateStatus(event: Event): void {
  emit('update', { status: (event.target as HTMLSelectElement).value as TaskStatus })
}

function updatePriority(event: Event): void {
  emit('update', { priority: (event.target as HTMLSelectElement).value as TaskPriority })
}

function updateType(event: Event): void {
  emit('update', { type: (event.target as HTMLSelectElement).value as TaskType })
}

function updateSensitive(event: Event): void {
  emit('update', { sensitive: (event.target as HTMLInputElement).checked })
}

function saveProjectName(): void {
  if (!props.task) {
    return
  }

  const nextProjectName = projectNameDraft.value.trim()

  if (nextProjectName !== (props.task.projectName ?? '')) {
    emit('update', { projectName: nextProjectName || null })
  }
}

function saveRepoPath(): void {
  if (!props.task) {
    return
  }

  const nextRepoPath = repoPathDraft.value.trim()

  if (nextRepoPath !== (props.task.repoPath ?? '')) {
    emit('update', { repoPath: nextRepoPath || null })
  }
}

const canSelectDirectory = computed(() => typeof window.api?.selectDirectory === 'function')

const notesNewestFirst = computed(() => (props.task ? [...props.task.notes].reverse() : []))

const showRepoPathWarning = computed(() => {
  const value = repoPathDraft.value.trim()

  return value.length > 0 && !isAbsoluteRepoPath(value)
})

const repoPathSuggestion = computed<string | null>(() => {
  const projectName = props.task?.projectName?.trim()

  if (!projectName) {
    return null
  }

  const countsByPath = new Map<string, number>()

  for (const task of props.allTasks) {
    if (task.id === props.task?.id) {
      continue
    }

    if ((task.projectName ?? '').trim() !== projectName) {
      continue
    }

    const repoPath = task.repoPath?.trim()

    if (!repoPath) {
      continue
    }

    countsByPath.set(repoPath, (countsByPath.get(repoPath) ?? 0) + 1)
  }

  let suggestion: string | null = null
  let highestCount = 0

  for (const [repoPath, count] of countsByPath) {
    if (count > highestCount) {
      highestCount = count
      suggestion = repoPath
    }
  }

  if (suggestion === null || suggestion === repoPathDraft.value.trim()) {
    return null
  }

  return suggestion
})

function applyRepoPathSuggestion(): void {
  if (repoPathSuggestion.value === null) {
    return
  }

  repoPathDraft.value = repoPathSuggestion.value
  saveRepoPath()
}

async function selectRepoPathDirectory(): Promise<void> {
  if (!window.api?.selectDirectory) {
    return
  }

  const result = await window.api.selectDirectory()

  if (result.status === 'selected') {
    repoPathDraft.value = result.dirPath
    saveRepoPath()
  }
}

function addStringListItems(
  draft: typeof tagDraft,
  existingItems: string[],
  emitItems: (items: string[]) => void
): void {
  const nextItems = draft.value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

  if (nextItems.length === 0) {
    return
  }

  const existingKeys = new Set(existingItems.map((item) => item.toLowerCase()))
  const itemsToAdd = nextItems.filter((item) => {
    const key = item.toLowerCase()

    if (existingKeys.has(key)) {
      return false
    }

    existingKeys.add(key)
    return true
  })

  if (itemsToAdd.length > 0) {
    emitItems([...existingItems, ...itemsToAdd])
  }

  draft.value = ''
}

function addTags(): void {
  if (!props.task) {
    return
  }

  addStringListItems(tagDraft, props.task.tags, (tags) => emit('update', { tags }))
}

function removeTag(tagToRemove: string): void {
  if (!props.task) {
    return
  }

  emit('update', { tags: props.task.tags.filter((tag) => tag !== tagToRemove) })
}

function addRelatedFiles(): void {
  if (!props.task) {
    return
  }

  addStringListItems(relatedFileDraft, props.task.relatedFiles, (relatedFiles) =>
    emit('update', { relatedFiles })
  )
}

function removeRelatedFile(fileToRemove: string): void {
  if (!props.task) {
    return
  }

  emit('update', { relatedFiles: props.task.relatedFiles.filter((file) => file !== fileToRemove) })
}

function addCommands(): void {
  if (!props.task) {
    return
  }

  addStringListItems(commandDraft, props.task.commands, (commands) => emit('update', { commands }))
}

function removeCommand(commandToRemove: string): void {
  if (!props.task) {
    return
  }

  emit('update', { commands: props.task.commands.filter((command) => command !== commandToRemove) })
}

function saveDescription(): void {
  if (!props.task || descriptionDraft.value === props.task.description) {
    return
  }

  emit('update', { description: descriptionDraft.value })
}

function saveDescriptionWithShortcut(event: KeyboardEvent): void {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    saveDescription()
  }
}

function addNote(): void {
  if (!props.task) {
    return
  }

  const content = noteDraft.value.trim()

  if (!content) {
    return
  }

  emit('addNote', content)
  noteDraft.value = ''
}

function addNoteWithShortcut(event: KeyboardEvent): void {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    event.preventDefault()
    addNote()
  }
}

function formatNoteTimestamp(value: string): string {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString()
}
</script>

<template>
  <section class="task-detail-panel" aria-labelledby="task-detail-title">
    <div v-if="!task" class="task-detail-empty">
      <h2 id="task-detail-title">Task details</h2>
      <p>Select a task to edit status, priority, type, tags, project context, and Markdown notes.</p>
    </div>

    <template v-else>
      <div class="task-detail-header">
        <div>
          <p class="eyebrow">Task details</p>
          <h2 id="task-detail-title">{{ task.title }}</h2>
        </div>
        <div class="panel-actions">
          <button type="button" class="ghost-button" @click="emit('copy')">Copy AI Context</button>
          <button type="button" class="ghost-button" @click="emit('close')">Close</button>
        </div>
      </div>

      <div class="field-grid">
        <label>
          <span>Status</span>
          <select :value="task.status" @change="updateStatus">
            <option v-for="status in taskStatuses" :key="status" :value="status">{{ status }}</option>
          </select>
        </label>

        <label>
          <span>Priority</span>
          <select :value="task.priority" @change="updatePriority">
            <option v-for="priority in taskPriorities" :key="priority" :value="priority">
              {{ priority }}
            </option>
          </select>
        </label>

        <label>
          <span>Type</span>
          <select :value="task.type" @change="updateType">
            <option v-for="taskType in taskTypes" :key="taskType" :value="taskType">{{ taskType }}</option>
          </select>
        </label>
      </div>

      <div class="detail-field">
        <label class="checkbox-label">
          <input type="checkbox" :checked="task.sensitive" @change="updateSensitive" />
          <span>
            Sensitive task
            <small>Sensitive tasks are excluded from AI Context exports by default.</small>
          </span>
        </label>
      </div>

      <div class="field-grid detail-field">
        <label>
          <span>Project</span>
          <input
            v-model="projectNameDraft"
            type="text"
            maxlength="200"
            placeholder="Project name"
            @keydown.enter.prevent="saveProjectName"
            @blur="saveProjectName"
          />
        </label>

        <label>
          <span>Repository path</span>
          <div class="repo-path-input">
            <input
              v-model="repoPathDraft"
              type="text"
              maxlength="1000"
              placeholder="G:/path/to/repo"
              @keydown.enter.prevent="saveRepoPath"
              @blur="saveRepoPath"
            />
            <button
              v-if="canSelectDirectory"
              type="button"
              class="ghost-button"
              @click="selectRepoPathDirectory"
            >
              Browse…
            </button>
          </div>
          <small v-if="showRepoPathWarning" class="repo-path-warning">
            Repository path should be an absolute path (e.g. G:/path/to/repo).
          </small>
          <button
            v-if="repoPathSuggestion"
            type="button"
            class="repo-path-suggestion"
            @click="applyRepoPathSuggestion"
          >
            Use {{ repoPathSuggestion }}
          </button>
        </label>
      </div>

      <div class="detail-field">
        <label for="task-tags">Tags</label>
        <div class="tag-list" aria-label="Task tags">
          <span v-if="task.tags.length === 0" class="empty-state">No tags yet.</span>
          <button
            v-for="tag in task.tags"
            :key="tag"
            type="button"
            class="tag-chip"
            @click="removeTag(tag)"
          >
            {{ tag }} ×
          </button>
        </div>
        <input
          id="task-tags"
          v-model="tagDraft"
          type="text"
          placeholder="Add tags, separated by commas"
          @keydown.enter.prevent="addTags"
          @blur="addTags"
        />
      </div>

      <div class="detail-field">
        <label for="task-related-files">Related files</label>
        <div class="tag-list" aria-label="Related files">
          <span v-if="task.relatedFiles.length === 0" class="empty-state">No related files yet.</span>
          <button
            v-for="file in task.relatedFiles"
            :key="file"
            type="button"
            class="tag-chip"
            @click="removeRelatedFile(file)"
          >
            {{ file }} ×
          </button>
        </div>
        <input
          id="task-related-files"
          v-model="relatedFileDraft"
          type="text"
          placeholder="Add file paths, separated by commas"
          @keydown.enter.prevent="addRelatedFiles"
          @blur="addRelatedFiles"
        />
      </div>

      <div class="detail-field">
        <label for="task-commands">Commands</label>
        <div class="tag-list" aria-label="Commands">
          <span v-if="task.commands.length === 0" class="empty-state">No commands yet.</span>
          <button
            v-for="command in task.commands"
            :key="command"
            type="button"
            class="tag-chip"
            @click="removeCommand(command)"
          >
            <code>{{ command }}</code> ×
          </button>
        </div>
        <input
          id="task-commands"
          v-model="commandDraft"
          type="text"
          placeholder="Add commands, separated by commas"
          @keydown.enter.prevent="addCommands"
          @blur="addCommands"
        />
      </div>

      <div class="detail-field">
        <label for="task-description">Description</label>
        <textarea
          id="task-description"
          v-model="descriptionDraft"
          rows="8"
          placeholder="Write Markdown notes, context, acceptance criteria, or logs. Ctrl/Cmd+Enter saves."
          @blur="saveDescription"
          @keydown="saveDescriptionWithShortcut"
        />
      </div>

      <div class="detail-field">
        <label for="task-note">Activity log</label>
        <ol v-if="notesNewestFirst.length > 0" class="note-list" aria-label="Activity log">
          <li v-for="note in notesNewestFirst" :key="note.id" class="note-item">
            <div class="note-meta">
              <time :datetime="note.createdAt">{{ formatNoteTimestamp(note.createdAt) }}</time>
              <button type="button" class="ghost-button" @click="emit('removeNote', note.id)">
                Remove
              </button>
            </div>
            <p class="note-content">{{ note.content }}</p>
          </li>
        </ol>
        <p v-else class="empty-state">No activity yet.</p>
        <textarea
          id="task-note"
          v-model="noteDraft"
          rows="3"
          placeholder="Add a progress note: what you did, why it's blocked, next step. Ctrl/Cmd+Enter adds."
          @keydown="addNoteWithShortcut"
        />
        <button type="button" class="ghost-button" @click="addNote">Add note</button>
      </div>
    </template>
  </section>
</template>
