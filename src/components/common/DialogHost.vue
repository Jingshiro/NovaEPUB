<template>
  <AppModal
    :open="dialog.open"
    :title="dialog.title"
    @close="dialog.settle(false)"
  >
    <p class="whitespace-pre-wrap text-sm leading-relaxed text-ink-secondary">{{ dialog.message }}</p>
    <template #footer>
      <button
        v-if="dialog.mode === 'confirm'"
        class="btn-secondary"
        @click="dialog.settle(false)"
      >取消</button>
      <button
        class="btn-primary"
        @click="dialog.settle(true)"
      >{{ dialog.mode === 'confirm' ? '确定' : '知道了' }}</button>
    </template>
  </AppModal>
</template>

<script setup>
import AppModal from './AppModal.vue'
import { useDialogStore } from '../../stores/dialog'

const dialog = useDialogStore()
</script>
