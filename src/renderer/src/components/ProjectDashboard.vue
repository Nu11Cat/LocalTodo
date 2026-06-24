<script setup lang="ts">
import type { ProjectSummary } from '../domain/projectSummary'
import { useLocale } from '../composables/useLocale'

const { t } = useLocale()

const props = defineProps<{
  summaries: ProjectSummary[]
  selectedKey: string | null
  defaultCommandKeys?: string[]
}>()

const emit = defineEmits<{
  select: [key: string | null]
  copy: [key: string]
  export: [key: string]
  exportLocalTodo: [key: string]
  setRepoPath: [key: string]
  setDefaultCommands: [key: string]
}>()

function hasSingleRepoPath(summary: ProjectSummary): boolean {
  const repoPaths = summary.tasks
    .map((task) => task.repoPath)
    .filter((repoPath): repoPath is string => typeof repoPath === 'string' && repoPath.trim().length > 0)

  return new Set(repoPaths).size === 1
}

// Default commands only make sense for a real project group, not the catch-all
// "no project" bucket (which has neither a name nor a repo path).
function canHaveDefaultCommands(summary: ProjectSummary): boolean {
  return Boolean(summary.projectName || summary.repoPath)
}

function hasDefaultCommands(summary: ProjectSummary): boolean {
  return props.defaultCommandKeys?.includes(summary.key) ?? false
}

// summary.label is the canonical English fallback ("(No project)") for an
// unassigned group; localize that label here without mutating stored data.
function projectLabel(summary: ProjectSummary): string {
  return summary.projectName || summary.repoPath ? summary.label : t('project.noProject')
}

function selectProject(key: string): void {
  emit('select', props.selectedKey === key ? null : key)
}
</script>

<template>
  <section class="todo-panel project-dashboard" aria-labelledby="project-dashboard-title">
    <div class="panel-heading">
      <div>
        <p class="eyebrow">{{ t('project.eyebrow') }}</p>
        <h2 id="project-dashboard-title">{{ t('project.title') }}</h2>
      </div>
      <button
        type="button"
        class="ghost-button"
        :class="{ 'is-active': selectedKey === null }"
        :aria-pressed="selectedKey === null"
        @click="emit('select', null)"
      >
        {{ t('project.allProjects') }}
      </button>
    </div>

    <div class="project-card-list">
      <article
        v-for="summary in summaries"
        :key="summary.key"
        class="project-card"
        :class="{ 'is-active': selectedKey === summary.key }"
      >
        <button
          type="button"
          class="project-card-main"
          :aria-pressed="selectedKey === summary.key"
          @click="selectProject(summary.key)"
        >
          <span class="project-card-title">{{ projectLabel(summary) }}</span>
          <span v-if="summary.repoPath" class="project-card-subtitle">{{ summary.repoPath }}</span>
          <span class="project-card-counts">
            <span>{{ t('project.active', { count: summary.active }) }}</span>
            <span>{{ t('project.done', { count: summary.done }) }}</span>
            <span v-if="summary.doing > 0">{{ t('project.doing', { count: summary.doing }) }}</span>
            <span v-if="summary.blocked > 0">{{ t('project.blocked', { count: summary.blocked }) }}</span>
            <span v-if="summary.review > 0">{{ t('project.review', { count: summary.review }) }}</span>
          </span>
        </button>

        <div class="project-card-actions">
          <button type="button" class="ghost-button" @click="emit('setRepoPath', summary.key)">
            {{ t('project.setRepoPath') }}
          </button>
          <button
            v-if="canHaveDefaultCommands(summary)"
            type="button"
            class="ghost-button"
            @click="emit('setDefaultCommands', summary.key)"
          >
            {{ hasDefaultCommands(summary) ? t('project.editDefaultCommands') : t('project.setDefaultCommands') }}
          </button>
          <button type="button" class="ghost-button" @click="emit('copy', summary.key)">
            {{ t('project.copyContext') }}
          </button>
          <button
            v-if="hasSingleRepoPath(summary)"
            type="button"
            class="ghost-button"
            @click="emit('export', summary.key)"
          >
            {{ t('project.exportContext') }}
          </button>
          <button
            v-if="hasSingleRepoPath(summary)"
            type="button"
            class="ghost-button"
            @click="emit('exportLocalTodo', summary.key)"
          >
            {{ t('project.exportLocalTodo') }}
          </button>
        </div>
      </article>
    </div>
  </section>
</template>
