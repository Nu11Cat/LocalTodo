<script setup lang="ts">
// Bottom status bar. Phase A ships a minimal empty strip so the workspace
// grid has its floor row. Phase B moves the dataFileInfo (path / size / last
// saved) + Show in folder / Open file buttons here.
</script>

<template>
  <footer class="app-statusbar" role="contentinfo">
    <!-- Phase B: data file path/size, last-saved timestamp, reveal/open actions. -->
    <span class="app-statusbar-placeholder">&nbsp;</span>
  </footer>
</template>
