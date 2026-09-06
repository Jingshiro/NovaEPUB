import { ref } from 'vue'
import { exportEpubFile } from '../utils/epubExporter'

/** 封装 EPUB 导出：提供导出中的状态，可传入额外选项（如 templates）。 */
export function useEpubExporter() {
  const exporting = ref(false)

  async function exportBook(book, options = {}) {
    exporting.value = true
    try {
      await exportEpubFile(book, options)
    } finally {
      exporting.value = false
    }
  }

  return { exporting, exportBook }
}
