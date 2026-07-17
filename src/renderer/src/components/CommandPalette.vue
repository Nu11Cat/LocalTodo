<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useLocale } from '@renderer/composables/useLocale'
import {
  filterCommandPaletteItems,
  nextCommandPaletteIndex,
  type CommandPaletteCommandId,
  type CommandPaletteItem,
  type CommandPaletteNavigationDirection
} from '@renderer/domain/commandPalette'

interface Props {
  open: boolean
  canClearFilters: boolean
  navCollapsed: boolean
  newTaskShortcutLabel: string
  searchShortcutLabel: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (event: 'close'): void
  (event: 'execute', commandId: CommandPaletteCommandId): void
}>()

const { t } = useLocale()
const query = ref('')
const selectedIndex = ref(0)
const input = ref<HTMLInputElement | null>(null)
const closeButton = ref<HTMLButtonElement | null>(null)

const commands = computed<CommandPaletteItem[]>(() => {
  const items: CommandPaletteItem[] = [
    {
      id: 'new-task',
      label: t('command.newTask'),
      shortcut: props.newTaskShortcutLabel
    },
    {
      id: 'search-tasks',
      label: t('command.searchTasks'),
      shortcut: props.searchShortcutLabel
    }
  ]

  if (props.canClearFilters) {
    items.push({ id: 'clear-filters', label: t('command.clearFilters') })
  }

  items.push({
    id: 'toggle-sidebar',
    label: props.navCollapsed ? t('command.showSidebar') : t('command.hideSidebar')
  })

  return items
})

const filteredCommands = computed(() => filterCommandPaletteItems(commands.value, query.value))
const activeOptionId = computed(() => {
  const command = filteredCommands.value[selectedIndex.value]

  return command ? `command-palette-option-${command.id}` : undefined
})

watch(
  () => props.open,
  async (open) => {
    if (!open) {
      return
    }

    query.value = ''
    selectedIndex.value = 0
    await nextTick()
    input.value?.focus()
  }
)

watch(filteredCommands, (items) => {
  if (items.length === 0) {
    selectedIndex.value = -1
  } else if (selectedIndex.value < 0 || selectedIndex.value >= items.length) {
    selectedIndex.value = 0
  }
})

function navigate(direction: CommandPaletteNavigationDirection): void {
  selectedIndex.value = nextCommandPaletteIndex(
    filteredCommands.value.length,
    selectedIndex.value,
    direction
  )
}

function execute(commandId: CommandPaletteCommandId | undefined): void {
  if (commandId) {
    emit('execute', commandId)
  }
}

function onDialogKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault()
    emit('close')
    return
  }

  if (event.key === 'Tab') {
    event.preventDefault()

    if (event.target === input.value && !event.shiftKey) {
      closeButton.value?.focus()
    } else {
      input.value?.focus()
    }
    return
  }

  if (event.target !== input.value) {
    return
  }

  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault()
      navigate('next')
      break
    case 'ArrowUp':
      event.preventDefault()
      navigate('previous')
      break
    case 'Home':
      event.preventDefault()
      navigate('home')
      break
    case 'End':
      event.preventDefault()
      navigate('end')
      break
    case 'Enter':
      event.preventDefault()
      execute(filteredCommands.value[selectedIndex.value]?.id)
      break
    default:
      break
  }
}
</script>

<template>
  <div v-if="open" class="command-palette-backdrop" @mousedown.self="emit('close')">
    <section
      class="command-palette"
      role="dialog"
      aria-modal="true"
      aria-labelledby="command-palette-title"
      @keydown="onDialogKeydown"
    >
      <header class="command-palette-header">
        <h2 id="command-palette-title">{{ t('palette.title') }}</h2>
        <button
          ref="closeButton"
          type="button"
          class="command-palette-close"
          :aria-label="t('palette.close')"
          @click="emit('close')"
        >
          ×
        </button>
      </header>

      <input
        ref="input"
        v-model="query"
        class="command-palette-input"
        type="search"
        role="combobox"
        autocomplete="off"
        spellcheck="false"
        aria-autocomplete="list"
        aria-expanded="true"
        aria-controls="command-palette-results"
        :aria-activedescendant="activeOptionId"
        :placeholder="t('palette.placeholder')"
      />

      <ul
        v-if="filteredCommands.length > 0"
        id="command-palette-results"
        class="command-palette-results"
        role="listbox"
        :aria-label="t('palette.results')"
      >
        <li
          v-for="(command, index) in filteredCommands"
          :id="`command-palette-option-${command.id}`"
          :key="command.id"
          class="command-palette-option"
          :class="{ 'is-active': index === selectedIndex }"
          role="option"
          :aria-selected="index === selectedIndex"
          @mousemove="selectedIndex = index"
          @mousedown.prevent
          @click="execute(command.id)"
        >
          <span>{{ command.label }}</span>
          <kbd v-if="command.shortcut">{{ command.shortcut }}</kbd>
        </li>
      </ul>
      <p v-else class="command-palette-empty">{{ t('palette.empty') }}</p>
    </section>
  </div>
</template>
