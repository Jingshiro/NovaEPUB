/** 云同步配置的本地存储（localStorage）。注意：密码/密钥是本机明文保存，不上传给任何第三方。 */

const KEY = 'novaepub:sync'

const DEFAULT_CONFIG = {
  provider: 'webdav',
  // 不预设任何服务商：服务器地址由用户自己填（WebDAV / S3 同理）。
  webdav: { serverUrl: '', username: '', password: '', folder: 'NovaEPUB' },
  s3: { endpoint: '', region: '', bucket: '', accessKeyId: '', secretAccessKey: '', folder: 'NovaEPUB' },
}

export function loadSyncConfig() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return structuredClone(DEFAULT_CONFIG)
    const parsed = JSON.parse(raw)
    return {
      ...structuredClone(DEFAULT_CONFIG),
      ...parsed,
      webdav: { ...DEFAULT_CONFIG.webdav, ...(parsed.webdav || {}) },
      s3: { ...DEFAULT_CONFIG.s3, ...(parsed.s3 || {}) },
    }
  } catch (err) {
    console.warn('[syncConfig] 读取配置失败', err)
    return structuredClone(DEFAULT_CONFIG)
  }
}

export function saveSyncConfig(config) {
  try {
    localStorage.setItem(KEY, JSON.stringify(config))
    return true
  } catch (err) {
    console.warn('[syncConfig] 保存配置失败', err)
    return false
  }
}
