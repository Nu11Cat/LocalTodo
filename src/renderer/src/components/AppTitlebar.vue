<script setup lang="ts">
// Top strip of the workspace grid. Owns the global new-task form (title +
// template + Add), theme/language switchers, and the data-actions button
// group (Export/Import JSON + Copy/Export AI Context). App.vue still owns
// the state — this component is presentational, wired via props + emits so
// useTodos stays a single instance in the parent.
import { ref } from 'vue'
import { useLocale, availableLocales } from '@renderer/composables/useLocale'
import { useTheme, availableThemes } from '@renderer/composables/useTheme'
import { isBuiltinTaskTemplateId } from '@renderer/domain/taskTemplate'
import type { MessageKey } from '@renderer/locales/en'

interface TemplateOption {
  id: string
  label: string
}

interface Props {
  draftTitle: string
  selectedTemplateId: string
  availableTemplates: TemplateOption[]
  isCustomTemplateSelected: boolean
  isLoaded: boolean
  hasAnyTodos: boolean
}

defineProps<Props>()

const emit = defineEmits<{
  (event: 'update:draftTitle', value: string): void
  (event: 'update:selectedTemplateId', value: string): void
  (event: 'add-todo'): void
  (event: 'delete-selected-template'): void
  (event: 'copy-project-context'): void
  (event: 'export-project-context'): void
  (event: 'download-json'): void
  (event: 'import-file', nativeEvent: Event): void
}>()

const { t, locale, setLocale } = useLocale()
const { theme, setTheme } = useTheme()

// Local ref for the hidden <input type="file">. The dialog is opened by
// programmatically clicking it when the user picks "Import JSON"; the picked
// file is then handed to the parent via the `import-file` event.
const fileInput = ref<HTMLInputElement | null>(null)

function openImportDialog(): void {
  fileInput.value?.click()
}

// Built-in templates carry English labels; render them via the active locale
// using the shared source-of-truth id list. Custom templates ship user-provided
// names, so those pass through verbatim.
function templateLabel(template: TemplateOption): string {
  return isBuiltinTaskTemplateId(template.id)
    ? t(`template.${template.id}` as MessageKey)
    : template.label
}
</script>

<template>
  <header class="app-titlebar" role="banner">
    <div class="app-titlebar-brand">
      <span class="app-titlebar-name">{{ t('app.title') }}</span>
    </div>

    <form class="app-titlebar-form" @submit.prevent="emit('add-todo')">
      <label class="sr-only" for="titlebar-todo-title">{{ t('form.newTodo') }}</label>
      <input
        id="titlebar-todo-title"
        class="app-titlebar-input"
        type="text"
        autocomplete="off"
        :value="draftTitle"
        :placeholder="t('form.titlePlaceholder')"
        :disabled="!isLoaded"
        @input="emit('update:draftTitle', ($event.target as HTMLInputElement).value)"
      />
      <label class="sr-only" for="titlebar-todo-template">{{ t('form.taskTemplate') }}</label>
      <select
        id="titlebar-todo-template"
        class="app-titlebar-select"
        :value="selectedTemplateId"
        :disabled="!isLoaded"
        @change="emit('update:selectedTemplateId', ($event.target as HTMLSelectElement).value)"
      >
        <option v-for="template in availableTemplates" :key="template.id" :value="template.id">
          {{ templateLabel(template) }}
        </option>
      </select>
      <button
        v-if="isCustomTemplateSelected"
        type="button"
        class="ghost-button"
        :disabled="!isLoaded"
        @click="emit('delete-selected-template')"
      >
        {{ t('form.deleteTemplate') }}
      </button>
      <button type="submit" class="app-titlebar-add" :disabled="!isLoaded">
        {{ t('form.add') }}
      </button>
    </form>

    <div class="app-titlebar-actions">
      <div class="app-titlebar-data-actions" role="group" :aria-label="t('titlebar.dataActions')">
        <button
          v-if="hasAnyTodos"
          type="button"
          class="ghost-button"
          @click="emit('copy-project-context')"
        >
          {{ t('data.copyProjectContext') }}
        </button>
        <button
          v-if="hasAnyTodos"
          type="button"
          class="ghost-button"
          @click="emit('export-project-context')"
        >
          {{ t('data.exportProjectContext') }}
        </button>
        <button
          type="button"
          class="ghost-button"
          :disabled="!isLoaded"
          @click="emit('download-json')"
        >
          {{ t('data.exportJson') }}
        </button>
        <button
          type="button"
          class="ghost-button"
          :disabled="!isLoaded"
          @click="openImportDialog"
        >
          {{ t('data.importJson') }}
        </button>
        <input
          ref="fileInput"
          class="sr-only"
          type="file"
          accept="application/json,.json"
          @change="emit('import-file', $event)"
        />
      </div>

      <label class="language-switcher">
        <span class="sr-only">{{ t('app.theme') }}</span>
        <select
          :value="theme"
          @change="setTheme(($event.target as HTMLSelectElement).value as 'light' | 'dark' | 'system')"
        >
          <option v-for="option in availableThemes" :key="option.value" :value="option.value">
            {{ t(option.labelKey) }}
          </option>
        </select>
      </label>

      <label class="language-switcher">
        <span class="sr-only">{{ t('app.language') }}</span>
        <select
          :value="locale"
          @change="setLocale(($event.target as HTMLSelectElement).value as 'en' | 'zh')"
        >
          <option v-for="option in availableLocales" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </label>
    </div>
  </header>
</template>
