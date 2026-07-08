<script setup lang="ts">
import { ref } from 'vue'

// Vertical drag handle between two columns. The parent owns the actual column
// widths (via useLayout); this component only reports pointer deltas via
// `update:size` so the parent's clamp / persistence rules stay authoritative.
// `origin` decides which edge the delta is measured from:
//   'left'  → dragging right INCREASES size (e.g. nav column on the left)
//   'right' → dragging left  INCREASES size (e.g. detail column on the right)
// This lets the same handle drive columns on either side without a sign hack in
// the parent template.

interface Props {
  size: number
  min: number
  max: number
  origin?: 'left' | 'right'
  ariaLabel?: string
}

const props = withDefaults(defineProps<Props>(), {
  origin: 'left',
  ariaLabel: 'Resize column'
})

const emit = defineEmits<{
  (event: 'update:size', value: number): void
}>()

const dragging = ref(false)
// Snapshotted at pointerdown so pointermove computes an absolute new size from
// the starting geometry — this stays correct even if the parent throttles the
// reactive update and the handle DOM position lags one frame behind.
let dragStartX = 0
let dragStartSize = 0

function clamp(value: number): number {
  return Math.min(Math.max(value, props.min), props.max)
}

function handlePointerDown(event: PointerEvent): void {
  const target = event.currentTarget as HTMLElement

  target.setPointerCapture(event.pointerId)
  dragging.value = true
  dragStartX = event.clientX
  dragStartSize = props.size
  event.preventDefault()
}

function handlePointerMove(event: PointerEvent): void {
  if (!dragging.value) {
    return
  }

  const delta = event.clientX - dragStartX
  const signedDelta = props.origin === 'left' ? delta : -delta

  emit('update:size', clamp(dragStartSize + signedDelta))
}

function handlePointerUp(event: PointerEvent): void {
  if (!dragging.value) {
    return
  }

  const target = event.currentTarget as HTMLElement

  if (target.hasPointerCapture(event.pointerId)) {
    target.releasePointerCapture(event.pointerId)
  }

  dragging.value = false
}
</script>

<template>
  <div
    class="split-pane"
    :class="{ 'is-dragging': dragging }"
    role="separator"
    aria-orientation="vertical"
    :aria-label="ariaLabel"
    tabindex="-1"
    @pointerdown="handlePointerDown"
    @pointermove="handlePointerMove"
    @pointerup="handlePointerUp"
    @pointercancel="handlePointerUp"
  >
    <div class="split-pane-line" aria-hidden="true" />
  </div>
</template>

<style scoped>
.split-pane {
  /* An 8px-wide hit target centered on a 1px visual line — matches IDEA / VS
     Code density. The line itself is styled by the parent via the shared
     --border token so both light and dark themes track automatically. */
  position: relative;
  width: var(--split-hit, 8px);
  cursor: col-resize;
  user-select: none;
  touch-action: none;
  align-self: stretch;
  background: transparent;
}

.split-pane-line {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  width: 1px;
  transform: translateX(-50%);
  background: var(--border);
  transition: background 120ms ease;
}

.split-pane:hover .split-pane-line,
.split-pane.is-dragging .split-pane-line {
  background: var(--accent);
}
</style>
