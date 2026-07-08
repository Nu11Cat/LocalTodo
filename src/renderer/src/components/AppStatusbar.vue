<script setup lang="ts">
// Bottom strip of the workspace grid. Shows the data-file location + size +
// last-saved timestamp, active/completed counts, and Show-in-folder / Open
// buttons that route back through the preload bridge in App.vue.
import { useLocale } from '@renderer/composables/useLocale'
import type { DataFileInfo } from '@renderer/composables/useTodos'

interface Props {
  dataFileInfo: DataFileInfo | null
  activeCount: number
  completedCount: number
}

defineProps<Props>()

const emit = defineEmits<{
  (event: 'reveal-data-file'): void
  (event: 'open-data-file'): void
}>()

const { t, locale } = useLocale()

function formatBytes(size: number): string {
  if (size < 1024) {
    return `${size} B`
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

// Follow the app-wide language switch — 'zh' → Chinese Simplified, 'en' →
// US English (matches the built app; no dynamic negotiation needed for two).
function formatTimestamp(ms: number): string {
  const localeTag = locale.value === 'zh' ? 'zh-CN' : 'en-US'
  return new Date(ms).toLocaleString(localeTag)
}
</script>

<template>
  <footer class="app-statusbar" role="contentinfo">
    <div v-if="dataFileInfo" class="app-statusbar-datafile">
      <span class="app-statusbar-label">{{ t('statusbar.dataFile') }}:</span>
      <span class="app-statusbar-path" :title="dataFileInfo.filePath">{{ dataFileInfo.filePath }}</span>
      <template v-if="dataFileInfo.exists">
        <span class="app-statusbar-sep">·</span>
        <span>{{ formatBytes(dataFileInfo.size ?? 0) }}</span>
        <span class="app-statusbar-sep">·</span>
        <span>{{ t('statusbar.savedAt', { time: formatTimestamp(dataFileInfo.modifiedAtMs ?? 0) }) }}</span>
      </template>
      <template v-else>
        <span class="app-statusbar-sep">·</span>
        <span class="app-statusbar-muted">{{ t('data.noDataFile') }}</span>
      </template>
    </div>
    <span v-else class="app-statusbar-placeholder">&nbsp;</span>

    <div class="app-statusbar-spacer" />

    <span class="app-statusbar-counts">
      {{ t('statusbar.tasks', { active: activeCount, done: completedCount }) }}
    </span>

    <div v-if="dataFileInfo?.exists" class="app-statusbar-actions">
      <button
        type="button"
        class="app-statusbar-button"
        @click="emit('reveal-data-file')"
      >
        {{ t('data.showInFolder') }}
      </button>
      <button
        type="button"
        class="app-statusbar-button"
        @click="emit('open-data-file')"
      >
        {{ t('data.openFile') }}
      </button>
    </div>
  </footer>
</template>
