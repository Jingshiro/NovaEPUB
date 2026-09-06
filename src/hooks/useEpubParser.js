import { ref } from 'vue'
import { parseEpubFile } from '../utils/epubParser'

/** 封装 EPUB 解析：提供解析中的状态与错误信息。 */
export function useEpubParser() {
  const parsing = ref(false)
  const error = ref('')

  async function parseFile(file) {
    parsing.value = true
    error.value = ''
    try {
      return await parseEpubFile(file)
    } catch (err) {
      error.value = '解析失败，请确认是合法的 EPUB 文件'
      throw err
    } finally {
      parsing.value = false
    }
  }

  return { parsing, error, parseFile }
}
