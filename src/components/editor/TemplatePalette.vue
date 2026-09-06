<template>
  <div
    v-if="visible"
    class="absolute z-40 w-64 overflow-hidden rounded-card bg-bg-card border border-line shadow-card"
    :style="{ top: `${y + 8}px`, left: `${x}px` }"
  >
    <div class="flex items-center justify-between border-b border-line px-3 py-2">
      <span class="text-xs text-ink-placeholder">套用模板</span>
      <button class="text-xs text-accent hover:text-accent-hover" @click="emit('manage')">管理…</button>
    </div>
    <div class="max-h-64 overflow-y-auto py-1">
      <button
        v-for="tpl in templates"
        :key="tpl.id"
        class="flex w-full items-center gap-3 px-3 py-2 text-left text-sm text-ink hover:bg-bg-muted transition-colors"
        @mousedown.prevent
        @click="select(tpl)"
      >
        <span class="rounded-md bg-bg-muted px-1.5 py-0.5 text-xs text-ink-secondary">{{ label(tpl.target) }}</span>
        <span class="min-w-0 flex-1 truncate">{{ tpl.name }}</span>
      </button>
      <div v-if="templates.length === 0" class="px-3 py-4 text-center text-xs text-ink-placeholder">
        还没有模板，点「管理…」新建
      </div>
    </div>
  </div>
</template>

<script setup>
import { TARGET_LABELS } from '../../utils/template'

const props = defineProps({
  visible: { type: Boolean, default: false },
  x: { type: Number, default: 0 },
  y: { type: Number, default: 0 },
  templates: { type: Array, default: () => [] },
})
const emit = defineEmits(['select', 'close', 'manage'])

function label(target) {
  return TARGET_LABELS[target] || '模板'
}
function select(tpl) {
  emit('select', tpl)
  emit('close')
}
</script>
