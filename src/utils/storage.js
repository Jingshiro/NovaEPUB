import { reactive } from 'vue'

const LIBRARY_KEY = 'novaepub:library'

/** 从 localStorage 读取书目（map: id -> book）。失败时返回空对象。 */
export function loadLibrary() {
  try {
    const raw = localStorage.getItem(LIBRARY_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch (err) {
    console.warn('[storage] 读取书目失败', err)
    return {}
  }
}

/** 将书目写回 localStorage。使用 reactive 包装以保持响应式。 */
export function saveLibrary(library) {
  try {
    localStorage.setItem(LIBRARY_KEY, JSON.stringify(library))
  } catch (err) {
    console.warn('[storage] 保存书目失败', err)
  }
}

/** 为 store 构建一个响应式的书目容器。 */
export function createLibraryContainer() {
  const library = reactive(loadLibrary())
  return function save() {
    saveLibrary(library)
  }
}
