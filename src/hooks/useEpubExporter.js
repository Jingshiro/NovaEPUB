import { ref } from 'vue'

/** 封装 EPUB 导出：提供导出中的状态，可传入额外选项（如 templates）。
 *  epubExporter（连带 JSZip）在真正导出时才动态加载。 */
export function useEpubExporter() {
  const exporting = ref(false)

  async function exportBook(book, options = {}) {
    exporting.value = true
    try {
      const { exportEpubFile } = await import('../utils/epubExporter')
      await exportEpubFile(book, options)
    } finally {
      exporting.value = false
    }
  }

  return { exporting, exportBook }
}
