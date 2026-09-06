import { ref } from 'vue'
import { exportEpubFile } from '../utils/epubExporter'

/** 封装 EPUB 导出：提供导出中的状态。 */
export function useEpubExporter() {
  const exporting = ref(false)

  async function exportBook(book) {
    exporting.value = true
    try {
      await exportEpubFile(book)
    } finally {
      exporting.value = false
    }
  }

  return { exporting, exportBook }
}
