<script setup lang="ts">
// Titlebar is the top strip of the three-column workspace. Phase A: a static
// placeholder with the app name so the layout has something visible while the
// old hero card still owns the real controls. Phase B will migrate the
// new-task form and theme/language switchers into this component.

import { useLocale } from '@renderer/composables/useLocale'

const { t } = useLocale()
</script>

<template>
  <header class="app-titlebar" role="banner">
    <div class="app-titlebar-brand">
      <span class="app-titlebar-name">{{ t('app.title') }}</span>
    </div>
    <div class="app-titlebar-actions">
      <!-- Phase B: theme/language switchers + new-task input land here. -->
    </div>
  </header>
</template>
