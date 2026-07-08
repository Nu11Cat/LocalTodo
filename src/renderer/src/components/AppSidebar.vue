<script setup lang="ts">
// Left navigation column. Phase A ships placeholder groups (Views / Status /
// Projects) so the collapse toggle and drag handle have something visible to
// resize. Phase B wires these entries to quickViews, filterState.statuses, and
// projectSummaries via useTodos.

import { useLocale } from '@renderer/composables/useLocale'

interface Props {
  collapsed: boolean
}

defineProps<Props>()

const emit = defineEmits<{
  (event: 'toggle-collapsed'): void
}>()

const { t } = useLocale()

// Placeholder groups — real entries come from useTodos in Phase B.
const placeholderGroups: { title: string; items: string[] }[] = [
  { title: 'Views', items: ['All tasks', 'Recently updated', 'Blocked'] },
  { title: 'Status', items: ['Inbox', 'Todo', 'Doing', 'Blocked', 'Review', 'Done'] },
  { title: 'Projects', items: ['(No project)'] }
]
</script>

<template>
  <aside class="app-sidebar" :class="{ 'is-collapsed': collapsed }" aria-label="Workspace navigation">
    <div class="app-sidebar-head">
      <button
        type="button"
        class="app-sidebar-toggle"
        :aria-label="collapsed ? 'Expand navigation' : 'Collapse navigation'"
        :aria-pressed="collapsed"
        @click="emit('toggle-collapsed')"
      >
        {{ collapsed ? '›' : '‹' }}
      </button>
      <span v-if="!collapsed" class="app-sidebar-title">{{ t('app.title') }}</span>
    </div>

    <div v-if="!collapsed" class="app-sidebar-body">
      <section
        v-for="group in placeholderGroups"
        :key="group.title"
        class="app-sidebar-group"
      >
        <h3 class="app-sidebar-group-title">{{ group.title }}</h3>
        <ul class="app-sidebar-list">
          <li
            v-for="item in group.items"
            :key="item"
            class="app-sidebar-item"
          >
            <button type="button" class="app-sidebar-item-btn">{{ item }}</button>
          </li>
        </ul>
      </section>
    </div>

    <!-- Collapsed placeholder: Phase B renders group icons here with tooltips. -->
    <div v-else class="app-sidebar-collapsed-hint" aria-hidden="true">•</div>
  </aside>
</template>
