<template>
  <router-view />
  <DraftRecoveryModal />
  <!-- 本地存储失败提示条：配额满 / 撤销后资产缺失 -->
  <div
    v-if="uiStore.storageError"
    class="fixed bottom-0 left-0 right-0 z-50 flex items-center gap-3 border-t border-danger/40 bg-danger/10 px-4 py-2 text-xs text-danger backdrop-blur"
  >
    <span class="flex-1">{{ uiStore.storageError }}</span>
    <button class="shrink-0 font-medium underline" @click="uiStore.clearStorageError()">知道了</button>
  </div>
</template>

<script setup>
import { watch } from 'vue'
import DraftRecoveryModal from './components/common/DraftRecoveryModal.vue'
import { useUiStore } from './stores/ui'

const uiStore = useUiStore()

// 首次弹出时 console 一份，方便排查；用户点「知道了」后清除
watch(
  () => uiStore.storageError,
  (msg) => {
    if (msg) console.warn('[storage]', msg)
  },
)
</script>
