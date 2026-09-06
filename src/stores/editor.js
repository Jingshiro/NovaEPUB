import { defineStore } from 'pinia'
import { useBookStore } from './book'

export const useEditorStore = defineStore('editor', {
  state: () => ({
    activeChapterId: null,
    // TipTap Editor 实例（非序列化，仅运行时引用）
    editor: null,
  }),
  getters: {
    activeChapter(state) {
      const bookStore = useBookStore()
      return bookStore.getChapter(state.activeChapterId)
    },
  },
  actions: {
    setActiveChapter(id) {
      this.activeChapterId = id
    },
    setEditor(editor) {
      this.editor = editor
    },
  },
})
