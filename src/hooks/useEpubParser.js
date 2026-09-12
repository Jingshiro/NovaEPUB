import { ref } from 'vue'
import { parseEpubFile } from '../utils/epubParser'
import { isTextImportFile, parseTextImportFile } from '../utils/textImport'

/** 封装文件导入：支持 EPUB / TXT / Markdown，提供解析中的状态与错误信息。 */
export function useEpubParser() {
  const parsing = ref(false)
  const error = ref('')

  async function parseFile(file) {
    parsing.value = true
    error.value = ''
    try {
      if (isTextImportFile(file)) return await parseTextImportFile(file)
      return await parseEpubFile(file)
    } catch (err) {
      error.value = '解析失败，请确认文件格式正确（支持 .epub / .txt / .md）'
      throw err
    } finally {
      parsing.value = false
    }
  }

  return { parsing, error, parseFile }
}
