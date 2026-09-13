import { ref } from 'vue'
import { useBookStore } from '../stores/book'

/** 封装 EPUB 导出：提供导出中的状态，可传入额外选项（如 templates）。
 *  epubExporter（连带 JSZip）在真正导出时才动态加载；
 *  导出前等待资产水合（IndexedDB 里的 dataURL 回填），否则 zip 会缺图/缺字体。 */
export function useEpubExporter() {
  const exporting = ref(false)

  async function exportBook(book, options = {}) {
    const bookStore = useBookStore()
    exporting.value = true
    try {
      await bookStore.ensureHydrated()
      const { exportEpubFile } = await import('../utils/epubExporter')
      await exportEpubFile(book, options)
    } finally {
      exporting.value = false
    }
  }

  return { exporting, exportBook }
}
