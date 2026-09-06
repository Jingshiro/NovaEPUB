<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition ease-out duration-150"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition ease-in duration-100"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center p-6">
        <div class="absolute inset-0 bg-black/30" @click="emit('close')"></div>
        <div class="relative z-10 w-full max-w-lg rounded-card bg-bg-card shadow-card border border-line">
          <header class="flex items-center justify-between border-b border-line px-6 py-4">
            <h2 class="text-base font-medium text-ink">{{ title }}</h2>
            <button class="text-ink-placeholder hover:text-ink transition-colors" @click="emit('close')">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M6 6l12 12M18 6L6 18" stroke-linecap="round"/>
              </svg>
            </button>
          </header>
          <div class="px-6 py-5 max-h-[70vh] overflow-y-auto">
            <slot />
          </div>
          <footer v-if="$slots.footer" class="flex justify-end gap-3 border-t border-line px-6 py-4">
            <slot name="footer" />
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: '' },
})
const emit = defineEmits(['close'])
</script>
