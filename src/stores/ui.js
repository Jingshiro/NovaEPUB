import { defineStore } from 'pinia'

export const useUiStore = defineStore('ui', {
  state: () => {
    const hasMatchMedia = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    const isWide = hasMatchMedia ? window.matchMedia('(min-width: 1024px)').matches : true
    return {
      /** 左侧目录：桌面默认展开，窄屏（<lg）浮层默认收起，避免盖住正文 */
      sidebarCollapsed: !isWide,
      /** 右侧「样式模板 + 属性」面板；窄屏（<lg）默认收起，桌面默认展开。 */
      stylePanelOpen: isWide,
      previewMode: false,
      theme: 'light', // MVP 仅明亮
      metadataModalOpen: false,
      /** 本地存储写入失败提示（配额满等）；每次失败只展示一次 */
      storageError: null,
    }
  },
  actions: {
    toggleSidebar() {
      this.sidebarCollapsed = !this.sidebarCollapsed
    },
    togglePanel() {
      this.stylePanelOpen = !this.stylePanelOpen
    },
    setPreviewMode(value) {
      this.previewMode = value
    },
    toggleTheme() {
      this.theme = this.theme === 'light' ? 'dark' : 'light'
    },
    openMetadataModal() {
      this.metadataModalOpen = true
    },
    closeMetadataModal() {
      this.metadataModalOpen = false
    },
    /** 记录一次本地存储写入失败（UI 层弹一次后调用 clearStorageError）。 */
    setStorageError(message) {
      this.storageError = message || '本地存储写入失败，修改可能不会被保存'
    },
    clearStorageError() {
      this.storageError = null
    },
  },
})
