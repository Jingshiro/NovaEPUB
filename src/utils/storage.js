import { reactive } from 'vue'

const LIBRARY_KEY = 'novaepub:library'

/** 最近一次写库失败的原因（null 表示上次成功）。 */
let lastSaveError = null

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

/** 将书目写回 localStorage。成功返回 true；配额满/序列化失败返回 false。 */
export function saveLibrary(library) {
  try {
    localStorage.setItem(LIBRARY_KEY, JSON.stringify(library))
    lastSaveError = null
    return true
  } catch (err) {
    lastSaveError = err
    console.warn('[storage] 保存书目失败', err)
    return false
  }
}

/** 读取最近一次写库错误；无错误返回 null。 */
export function getLastStorageError() {
  return lastSaveError
}

/** 为 store 构建一个响应式的书目容器。 */
export function createLibraryContainer() {
  const library = reactive(loadLibrary())
  return function save() {
    saveLibrary(library)
  }
}
