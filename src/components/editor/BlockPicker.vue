<template>
  <div
    v-if="visible"
    class="absolute z-30 w-56 overflow-hidden rounded-card bg-bg-card border border-line shadow-card"
    :style="{ top: `${y + 8}px`, left: `${x}px` }"
  >
    <div class="px-3 py-2 text-xs text-ink-placeholder border-b border-line">块类型</div>
    <div class="py-1">
      <button
        v-for="opt in options"
        :key="opt.type"
        class="flex w-full items-center gap-3 px-3 py-2 text-left text-sm text-ink hover:bg-bg-muted transition-colors"
        @mousedown.prevent
        @click="select(opt.type)"
      >
        <span class="flex h-6 w-6 items-center justify-center rounded-md bg-bg-muted text-ink-secondary">
          {{ opt.icon }}
        </span>
        <span>{{ opt.label }}</span>
      </button>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  visible: { type: Boolean, default: false },
  x: { type: Number, default: 0 },
  y: { type: Number, default: 0 },
  options: { type: Array, default: () => [] },
})
const emit = defineEmits(['select'])
function select(type) {
  emit('select', type)
}
</script>
