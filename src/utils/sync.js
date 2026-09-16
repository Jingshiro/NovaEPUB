/**
 * 云同步统一封装：对上层隐藏 WebDAV / S3 的差异。
 * 备份布局：{folder}/backups/{时间戳}.novaepub + {folder}/latest.novaepub
 * 上传后自动清理旧快照（保留最近 KEEP 数量的时间戳备份）。
 */

import {
  davTestConnection, davPutText, davGetText, davListBackups, davDelete,
} from './webdav'
import {
  s3TestConnection, s3PutText, s3GetText, s3ListBackups, s3DeleteObject,
} from './s3'
import { backupFileName } from './backup'

export const KEEP_BACKUPS = 10

const drive = {
  webdav: {
    test: davTestConnection,
    put: davPutText,
    get: davGetText,
    list: davListBackups,
    remove: davDelete,
  },
  s3: {
    test: s3TestConnection,
    put: s3PutText,
    get: s3GetText,
    list: s3ListBackups,
    remove: s3DeleteObject,
  },
}

export function assertSupported(provider) {
  if (!drive[provider]) throw new Error(`不支持的同步方式：${provider}`)
  return drive[provider]
}

export async function testConnection(provider, cfg, fetchImpl = fetch) {
  return assertSupported(provider).test(cfg, fetchImpl)
}

/** 上传一份备份快照（同时写备 latest）。返回备份文件名。 */
export async function uploadBackup(provider, cfg, payloadText = '', { now = new Date(), fetchImpl = fetch } = {}) {
  const impl = assertSupported(provider)
  const name = backupFileName(now)
  await impl.put(cfg, `backups/${name}`, payloadText, fetchImpl)
  await impl.put(cfg, 'latest.novaepub', payloadText, fetchImpl)
  // 清理旧快照（best-effort）：只删 backups/ 里的时间戳文件
  try {
    const files = await impl.list(cfg, fetchImpl)
    const stems = (files || [])
      .map((f) => (f.endsWith('.novaepub') ? f.replace(/\.novaepub$/, '') : null))
      .filter((s) => /^\d{8}-\d{6}$/.test(s))
      .sort()
      .reverse()
    for (const old of stems.slice(KEEP_BACKUPS)) {
      await impl.remove(cfg, `backups/${old}.novaepub`, fetchImpl)
    }
  } catch (err) {
    // 清理失败不影响上传结果
    console.warn('[sync] 清理旧快照失败', err)
  }
  return name
}

/** 列出远端可恢复的备份（含 latest），返回 { name, label } 列表，最新在前。 */
export async function listRemoteBackups(provider, cfg, fetchImpl = fetch) {
  const impl = assertSupported(provider)
  const files = await impl.list(cfg, fetchImpl)
  const snaps = (files || [])
    .filter((f) => f.endsWith('.novaepub'))
    .map((f) => f.replace(/\.novaepub$/, ''))
    .sort((a, b) => {
      if (a === 'latest') return -1
      if (b === 'latest') return 1
      if (a.length !== b.length) return a.length - b.length
      return b.localeCompare(a)
    })
    .map((stem) => ({
      name: `${stem}.novaepub`,
      label: stem === 'latest' ? '最新（latest）' : labelFromStamp(stem),
    }))
  return snaps
}

/** 下载一份备份文本。name 为远端文件名（不含 backups/ 前缀）。 */
export async function downloadBackup(provider, cfg, name, fetchImpl = fetch) {
  const impl = assertSupported(provider)
  if (name === 'latest.novaepub') {
    return impl.get(cfg, 'latest.novaepub', fetchImpl)
  }
  return impl.get(cfg, `backups/${name}`, fetchImpl)
}

/** 20260912-120405 → 2026-09-12 12:04:05 (UTC) */
function labelFromStamp(stem) {
  const m = /^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})$/.exec(stem)
  if (!m) return stem
  return `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}:${m[6]} (UTC)`
}
