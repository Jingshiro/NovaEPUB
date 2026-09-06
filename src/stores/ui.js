import { defineStore } from 'pinia'

export const useUiStore = defineStore('ui', {
  state: () => ({
    sidebarCollapsed: false,
    previewMode: false,
    theme: 'light', // MVP 仅明亮
    metadataModalOpen: false,
  }),
  actions: {
    toggleSidebar() {
      this.sidebarCollapsed = !this.sidebarCollapsed
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
