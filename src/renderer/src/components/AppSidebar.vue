<script setup lang="ts">
// Left nav column. Owns the four selector groups (Quick views / Status /
// Projects / Saved views) plus the collapse toggle in its header. Data
// flows in through props from App.vue (which owns useTodos()) and all
// mutations are emitted upward — this keeps useTodos as a single instance.
//
// Collapsed mode hides labels and shows one-character icons/initials with a
// tooltip via `title`, matching the IDEA/Cursor style referenced in the plan.
import { computed } from 'vue'
import { useLocale } from '@renderer/composables/useLocale'
import type { MessageKey } from '@renderer/locales/en'
import type { ProjectSummary } from '@renderer/domain/projectSummary'
import {
  parseCustomTaskStatus,
  type BuiltinTaskStatus,
  type TaskStatus
} from '@renderer/domain/taskModel'

// Kept in sync with `QuickViewId` in useTodos.ts. Enumerated here so the glyph
// map below is a total mapping — a new quick-view id would fail typecheck.
type QuickViewId = 'recent' | 'blocked' | 'unassigned'

interface QuickView {
  id: QuickViewId
  label: string
}

interface SavedViewItem {
  id: string
  name: string
}

interface Props {
  collapsed: boolean
  quickViews: readonly QuickView[]
  savedViews: readonly SavedViewItem[]
  projectSummaries: readonly ProjectSummary[]
  selectedProjectKey: string | null
  activeStatuses: readonly TaskStatus[]
  statuses: readonly TaskStatus[]
  // Total task count per status across the whole workspace. Derived in App.vue
  // so the sidebar renders a real number next to each status entry.
  statusCounts: Partial<Record<TaskStatus, number>>
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (event: 'toggle-collapsed'): void
  (event: 'apply-quick-view', id: QuickViewId): void
  (event: 'toggle-status', status: TaskStatus): void
  (event: 'select-project', key: string | null): void
  (event: 'apply-saved-view', id: string): void
  (event: 'delete-saved-view', id: string, name: string): void
  (event: 'reset-filters'): void
}>()

const { t } = useLocale()

// One-char glyph shown in collapsed mode. Keep short so it fits in the 56px
// rail. Total maps — TS enforces that new ids in the union add an entry here.
const statusInitials: Record<BuiltinTaskStatus, string> = {
  inbox: 'I',
  todo: 'T',
  doing: 'D',
  blocked: 'B',
  review: 'R',
  done: '✓'
}

const quickViewGlyphs: Record<QuickViewId, string> = {
  recent: '↻',
  blocked: '⚑',
  unassigned: '∅'
}

// "Blocked" is intentionally hidden here — the Status group already exposes
// the same filter (statuses: ['blocked']) with a live count, so a second entry
// would be a duplicate. `recent` (sort by updatedAt) and `unassigned` (project
// filter) remain because Status can't express those.
const visibleQuickViews = computed(() =>
  props.quickViews.filter((view) => view.id !== 'blocked')
)

function statusLabel(status: TaskStatus): string {
  return parseCustomTaskStatus(status)?.label ?? t(`status.${status}` as MessageKey)
}

function statusInitial(status: TaskStatus): string {
  const customLabel = parseCustomTaskStatus(status)?.label

  return customLabel ? customLabel.charAt(0).toUpperCase() : statusInitials[status as BuiltinTaskStatus]
}

// summary.label is the raw English fallback for the unassigned bucket. Only
// swap it for the localized "(No project)" when neither name nor path exist.
function projectLabel(summary: ProjectSummary): string {
  return summary.projectName || summary.repoPath ? summary.label : t('project.noProject')
}

function projectInitial(summary: ProjectSummary): string {
  const label = projectLabel(summary).trim()
  return label ? label.charAt(0).toUpperCase() : '·'
}

// "All tasks" reflects the truly-neutral state: no filters, no project.
// Status entries mirror the middle filter-bar's multi-select semantics via
// `includes` so the two rails stay in sync (see App.vue's toggleStatusFilter).
const isAllTasksActive = computed(
  () =>
    props.activeStatuses.length === 0 &&
    props.selectedProjectKey === null
)

function isStatusActive(status: TaskStatus): boolean {
  return props.activeStatuses.includes(status)
}

function isProjectActive(key: string): boolean {
  return props.selectedProjectKey === key
}
</script>

<template>
  <aside
    class="app-sidebar"
    :class="{ 'is-collapsed': collapsed }"
    :aria-label="t('nav.views')"
  >
    <div class="app-sidebar-head">
      <button
        type="button"
        class="app-sidebar-toggle"
        :aria-label="collapsed ? t('nav.expand') : t('nav.collapse')"
        :aria-pressed="collapsed"
        :title="collapsed ? t('nav.expand') : t('nav.collapse')"
        @click="emit('toggle-collapsed')"
      >
        {{ collapsed ? '›' : '‹' }}
      </button>
    </div>

    <div class="app-sidebar-body">
      <section class="app-sidebar-group" :aria-label="t('nav.views')">
        <h3 v-if="!collapsed" class="app-sidebar-group-title">{{ t('nav.views') }}</h3>
        <ul class="app-sidebar-list">
          <li class="app-sidebar-item">
            <button
              type="button"
              class="app-sidebar-item-btn"
              :class="{ 'is-active': isAllTasksActive }"
              :aria-pressed="isAllTasksActive"
              :title="t('nav.allTasks')"
              @click="emit('reset-filters')"
            >
              <span class="app-sidebar-item-glyph" aria-hidden="true">≡</span>
              <span v-if="!collapsed" class="app-sidebar-item-label">{{ t('nav.allTasks') }}</span>
            </button>
          </li>
          <li
            v-for="quickView in visibleQuickViews"
            :key="quickView.id"
            class="app-sidebar-item"
          >
            <!-- Quick-view rows are actions, not toggle states (each click
                 reshapes the filter or sort in a fixed way), so no is-active
                 styling and no aria-pressed here. -->
            <button
              type="button"
              class="app-sidebar-item-btn"
              :title="t(`quickView.${quickView.id}`)"
              @click="emit('apply-quick-view', quickView.id)"
            >
              <span class="app-sidebar-item-glyph" aria-hidden="true">
                {{ quickViewGlyphs[quickView.id] }}
              </span>
              <span v-if="!collapsed" class="app-sidebar-item-label">
                {{ t(`quickView.${quickView.id}`) }}
              </span>
            </button>
          </li>
        </ul>
      </section>

      <section class="app-sidebar-group" :aria-label="t('nav.status')">
        <h3 v-if="!collapsed" class="app-sidebar-group-title">{{ t('nav.status') }}</h3>
        <ul class="app-sidebar-list">
          <li
            v-for="status in statuses"
            :key="status"
            class="app-sidebar-item"
          >
            <button
              type="button"
              class="app-sidebar-item-btn"
              :class="[{ 'is-active': isStatusActive(status) }, { [`is-status-${status}`]: !status.startsWith('custom-') }]"
              :aria-pressed="isStatusActive(status)"
              :title="statusLabel(status)"
              @click="emit('toggle-status', status)"
            >
              <span class="app-sidebar-item-glyph" aria-hidden="true">
                {{ statusInitial(status) }}
              </span>
              <span v-if="!collapsed" class="app-sidebar-item-label">
                {{ statusLabel(status) }}
              </span>
              <span
                v-if="!collapsed && (statusCounts[status] ?? 0) > 0"
                class="app-sidebar-item-count"
              >
                {{ statusCounts[status] ?? 0 }}
              </span>
            </button>
          </li>
        </ul>
      </section>

      <section
        v-if="projectSummaries.length > 0"
        class="app-sidebar-group"
        :aria-label="t('nav.projects')"
      >
        <h3 v-if="!collapsed" class="app-sidebar-group-title">{{ t('nav.projects') }}</h3>
        <ul class="app-sidebar-list">
          <li
            v-for="summary in projectSummaries"
            :key="summary.key"
            class="app-sidebar-item"
          >
            <button
              type="button"
              class="app-sidebar-item-btn"
              :class="{ 'is-active': isProjectActive(summary.key) }"
              :aria-pressed="isProjectActive(summary.key)"
              :title="projectLabel(summary)"
              @click="emit('select-project', isProjectActive(summary.key) ? null : summary.key)"
            >
              <span class="app-sidebar-item-glyph" aria-hidden="true">
                {{ projectInitial(summary) }}
              </span>
              <span v-if="!collapsed" class="app-sidebar-item-label">
                {{ projectLabel(summary) }}
              </span>
              <span
                v-if="!collapsed && summary.active > 0"
                class="app-sidebar-item-count"
              >
                {{ summary.active }}
              </span>
            </button>
          </li>
        </ul>
      </section>

      <section
        v-if="!collapsed && savedViews.length > 0"
        class="app-sidebar-group"
        :aria-label="t('nav.savedViews')"
      >
        <h3 class="app-sidebar-group-title">{{ t('nav.savedViews') }}</h3>
        <ul class="app-sidebar-list">
          <li
            v-for="view in savedViews"
            :key="view.id"
            class="app-sidebar-item app-sidebar-saved-view"
          >
            <button
              type="button"
              class="app-sidebar-item-btn app-sidebar-item-btn--saved"
              :title="view.name"
              @click="emit('apply-saved-view', view.id)"
            >
              <span class="app-sidebar-item-glyph" aria-hidden="true">★</span>
              <span class="app-sidebar-item-label">{{ view.name }}</span>
            </button>
            <button
              type="button"
              class="app-sidebar-saved-view-remove"
              :aria-label="t('filter.deleteSavedView', { name: view.name })"
              @click="emit('delete-saved-view', view.id, view.name)"
            >
              ×
            </button>
          </li>
        </ul>
      </section>
    </div>
  </aside>
</template>
