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
import { useLocale } from '@renderer/composables/useLocale'

const { t } = useLocale()

function statusLabel(status: TaskStatus): string {
  return t(`status.${status}` as const)
}

function priorityLabel(priority: TaskPriority): string {
  return t(`priority.${priority}` as const)
}

function typeLabel(taskType: TaskType): string {
  return t(`type.${taskType}` as const)
}

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
  saveAsTemplate: []
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
      <h2 id="task-detail-title">{{ t('detail.title') }}</h2>
      <p>{{ t('detail.empty') }}</p>
    </div>

    <template v-else>
      <div class="task-detail-header">
        <div>
          <p class="eyebrow">{{ t('detail.title') }}</p>
          <h2 id="task-detail-title">{{ task.title }}</h2>
        </div>
        <div class="panel-actions">
          <button type="button" class="ghost-button" @click="emit('copy')">{{ t('detail.copyAiContext') }}</button>
          <button type="button" class="ghost-button" @click="emit('saveAsTemplate')">
            {{ t('detail.saveAsTemplate') }}
          </button>
          <button type="button" class="ghost-button" @click="emit('close')">{{ t('detail.close') }}</button>
        </div>
      </div>

      <div class="field-grid">
        <label>
          <span>{{ t('detail.status') }}</span>
          <select :value="task.status" @change="updateStatus">
            <option v-for="status in taskStatuses" :key="status" :value="status">{{ statusLabel(status) }}</option>
          </select>
        </label>

        <label>
          <span>{{ t('detail.priority') }}</span>
          <select :value="task.priority" @change="updatePriority">
            <option v-for="priority in taskPriorities" :key="priority" :value="priority">
              {{ priorityLabel(priority) }}
            </option>
          </select>
        </label>

        <label>
          <span>{{ t('detail.type') }}</span>
          <select :value="task.type" @change="updateType">
            <option v-for="taskType in taskTypes" :key="taskType" :value="taskType">{{ typeLabel(taskType) }}</option>
          </select>
        </label>
      </div>

      <div class="detail-field">
        <label class="checkbox-label">
          <input type="checkbox" :checked="task.sensitive" @change="updateSensitive" />
          <span>
            {{ t('detail.sensitiveTask') }}
            <small>{{ t('detail.sensitiveHint') }}</small>
          </span>
        </label>
      </div>

      <div class="field-grid detail-field">
        <label>
          <span>{{ t('detail.project') }}</span>
          <input
            v-model="projectNameDraft"
            type="text"
            maxlength="200"
            :placeholder="t('detail.projectPlaceholder')"
            @keydown.enter.prevent="saveProjectName"
            @blur="saveProjectName"
          />
        </label>

        <label>
          <span>{{ t('detail.repoPath') }}</span>
          <div class="repo-path-input">
            <input
              v-model="repoPathDraft"
              type="text"
              maxlength="1000"
              :placeholder="t('detail.repoPathPlaceholder')"
              @keydown.enter.prevent="saveRepoPath"
              @blur="saveRepoPath"
            />
            <button
              v-if="canSelectDirectory"
              type="button"
              class="ghost-button"
              @click="selectRepoPathDirectory"
            >
              {{ t('detail.browse') }}
            </button>
          </div>
          <small v-if="showRepoPathWarning" class="repo-path-warning">
            {{ t('detail.repoPathWarning') }}
          </small>
          <button
            v-if="repoPathSuggestion"
            type="button"
            class="repo-path-suggestion"
            @click="applyRepoPathSuggestion"
          >
            {{ t('detail.useRepoPath', { path: repoPathSuggestion }) }}
          </button>
        </label>
      </div>

      <div class="detail-field">
        <label for="task-tags">{{ t('detail.tags') }}</label>
        <div class="tag-list" :aria-label="t('detail.taskTags')">
          <span v-if="task.tags.length === 0" class="empty-state">{{ t('detail.noTags') }}</span>
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
          :placeholder="t('detail.addTags')"
          @keydown.enter.prevent="addTags"
          @blur="addTags"
        />
      </div>

      <div class="detail-field">
        <label for="task-related-files">{{ t('detail.relatedFiles') }}</label>
        <div class="tag-list" :aria-label="t('detail.relatedFiles')">
          <span v-if="task.relatedFiles.length === 0" class="empty-state">{{ t('detail.noRelatedFiles') }}</span>
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
          :placeholder="t('detail.addRelatedFiles')"
          @keydown.enter.prevent="addRelatedFiles"
          @blur="addRelatedFiles"
        />
      </div>

      <div class="detail-field">
        <label for="task-commands">{{ t('detail.commands') }}</label>
        <div class="tag-list" :aria-label="t('detail.commands')">
          <span v-if="task.commands.length === 0" class="empty-state">{{ t('detail.noCommands') }}</span>
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
          :placeholder="t('detail.addCommands')"
          @keydown.enter.prevent="addCommands"
          @blur="addCommands"
        />
      </div>

      <div class="detail-field">
        <label for="task-description">{{ t('detail.description') }}</label>
        <textarea
          id="task-description"
          v-model="descriptionDraft"
          rows="8"
          :placeholder="t('detail.descriptionPlaceholder')"
          @blur="saveDescription"
          @keydown="saveDescriptionWithShortcut"
        />
      </div>

      <div class="detail-field">
        <label for="task-note">{{ t('detail.activityLog') }}</label>
        <ol v-if="notesNewestFirst.length > 0" class="note-list" :aria-label="t('detail.activityLog')">
          <li v-for="note in notesNewestFirst" :key="note.id" class="note-item">
            <div class="note-meta">
              <time :datetime="note.createdAt">{{ formatNoteTimestamp(note.createdAt) }}</time>
              <button type="button" class="ghost-button" @click="emit('removeNote', note.id)">
                {{ t('todo.remove') }}
              </button>
            </div>
            <p class="note-content">{{ note.content }}</p>
          </li>
        </ol>
        <p v-else class="empty-state">{{ t('detail.noActivity') }}</p>
        <textarea
          id="task-note"
          v-model="noteDraft"
          rows="3"
          :placeholder="t('detail.notePlaceholder')"
          @keydown="addNoteWithShortcut"
        />
        <button type="button" class="ghost-button" @click="addNote">{{ t('detail.addNote') }}</button>
      </div>
    </template>
  </section>
</template>
