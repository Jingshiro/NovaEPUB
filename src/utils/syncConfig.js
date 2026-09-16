/** 云同步配置的本地存储（localStorage）。
 *  密码/密钥默认只存本机；rememberCredentials=false 时仅保留在当前会话内存中，刷新即丢。
 */

const KEY = 'novaepub:sync'

const DEFAULT_CONFIG = {
  provider: 'webdav',
  /** true：密码/密钥写入 localStorage；false：仅会话内存，不落盘 */
  rememberCredentials: true,
  // 不预设任何服务商：服务器地址由用户自己填（WebDAV / S3 同理）。
  webdav: { serverUrl: '', username: '', password: '', folder: 'NovaEPUB' },
  s3: { endpoint: '', region: '', bucket: '', accessKeyId: '', secretAccessKey: '', folder: 'NovaEPUB' },
}

/** 仅会话内存中的密钥（rememberCredentials=false 时使用）。 */
let sessionSecrets = {
  webdavPassword: '',
  s3SecretAccessKey: '',
}

/** 把磁盘/表单里的密钥同步进会话缓存（供 rememberCredentials=false 时继续用）。 */
export function cacheSessionSecrets(config = {}) {
  if (config.webdav?.password) sessionSecrets.webdavPassword = config.webdav.password
  if (config.s3?.secretAccessKey) sessionSecrets.s3SecretAccessKey = config.s3.secretAccessKey
}

export function clearSessionSecrets() {
  sessionSecrets = { webdavPassword: '', s3SecretAccessKey: '' }
}

export function loadSyncConfig() {
  try {
    const raw = localStorage.getItem(KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    const merged = {
      ...structuredClone(DEFAULT_CONFIG),
      ...parsed,
      rememberCredentials: parsed.rememberCredentials !== false,
      webdav: { ...DEFAULT_CONFIG.webdav, ...(parsed.webdav || {}) },
      s3: { ...DEFAULT_CONFIG.s3, ...(parsed.s3 || {}) },
    }
    // 磁盘未存密钥时，从会话内存回填（同一标签页内继续可用）
    if (!merged.webdav.password) merged.webdav.password = sessionSecrets.webdavPassword
    if (!merged.s3.secretAccessKey) merged.s3.secretAccessKey = sessionSecrets.s3SecretAccessKey
    return merged
  } catch (err) {
    console.warn('[syncConfig] 读取配置失败', err)
    return structuredClone(DEFAULT_CONFIG)
  }
}

/**
 * 保存配置。rememberCredentials=false 时剥离密码/密钥后再写盘，
 * 同时把密钥留在会话内存，保证本页同步仍可用。
 */
export function saveSyncConfig(config) {
  try {
    const remember = config.rememberCredentials !== false
    cacheSessionSecrets(config)
    const toSave = {
      ...config,
      rememberCredentials: remember,
      webdav: { ...config.webdav },
      s3: { ...config.s3 },
    }
    if (!remember) {
      toSave.webdav.password = ''
      toSave.s3.secretAccessKey = ''
    }
    localStorage.setItem(KEY, JSON.stringify(toSave))
    return true
  } catch (err) {
    console.warn('[syncConfig] 保存配置失败', err)
    return false
  }
}
