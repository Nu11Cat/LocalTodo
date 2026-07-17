<script setup lang="ts">
// One row inside the Active or Completed list. Extracted from App.vue where
// two near-identical <li> blocks lived side by side; both consumed the same
// state (todo + selectedTodoId) and emitted the same four actions. Keeping
// them in one place means priority-bar / hover-reveal / a11y attributes stay
// in lockstep between Active and Completed forever.
//
// The row itself is the listbox option — `role="option"` with `aria-selected`
// live on the <li>. The parent `<ul role="listbox">` is what makes the
// `aria-selected` attribute a legitimate a11y hook rather than a hint that
// screen readers ignore. The stable DOM id `todo-row-<id>` lets App.vue move
// focus and scroll after roving-tabindex keyboard navigation.
import { useLocale } from '@renderer/composables/useLocale'
import type { Task } from '@renderer/domain/taskModel'

interface Props {
  todo: Task
  selected: boolean
  tabIndex: 0 | -1
}

defineProps<Props>()

const emit = defineEmits<{
  (event: 'toggle', id: string): void
  (event: 'select', id: string): void
  (event: 'copy', id: string): void
  (event: 'remove', id: string): void
}>()

const { t } = useLocale()
</script>

<template>
  <li
    :id="`todo-row-${todo.id}`"
    class="todo-item"
    :class="{ 'is-selected': selected }"
    :data-priority="todo.priority"
    role="option"
    :aria-selected="selected"
    :tabindex="tabIndex"
    @focusin="emit('select', todo.id)"
  >
    <label>
      <input
        type="checkbox"
        :checked="todo.status === 'done'"
        :tabindex="selected ? 0 : -1"
        @change="emit('toggle', todo.id)"
      />
      <span>{{ todo.title }}</span>
      <span v-if="todo.sensitive" class="sensitive-badge">{{ t('todo.sensitive') }}</span>
    </label>
    <div class="todo-actions">
      <button
        type="button"
        class="ghost-button"
        :tabindex="selected ? 0 : -1"
        @click="emit('select', todo.id)"
      >
        {{ t('todo.edit') }}
      </button>
      <button
        type="button"
        class="ghost-button"
        :tabindex="selected ? 0 : -1"
        @click="emit('copy', todo.id)"
      >
        {{ t('todo.copyAiContext') }}
      </button>
      <button
        type="button"
        class="ghost-button"
        :tabindex="selected ? 0 : -1"
        @click="emit('remove', todo.id)"
      >
        {{ t('todo.remove') }}
      </button>
    </div>
  </li>
</template>
