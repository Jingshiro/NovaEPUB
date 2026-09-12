import { defineStore } from 'pinia'

export const useUiStore = defineStore('ui', {
  state: () => ({
    sidebarCollapsed: false,
    /** 右侧「样式模板 + 属性」面板；窄屏（<lg）默认收起，桌面默认展开。 */
    stylePanelOpen: typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(min-width: 1024px)').matches
      : true,
    previewMode: false,
    theme: 'light', // MVP 仅明亮
    metadataModalOpen: false,
  }),
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
  },
})
