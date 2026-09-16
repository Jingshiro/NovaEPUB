// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import {
  loadSyncConfig, saveSyncConfig, cacheSessionSecrets, clearSessionSecrets,
} from '../syncConfig'

describe('syncConfig 凭据落盘策略', () => {
  beforeEach(() => {
    localStorage.clear()
    clearSessionSecrets()
  })

  it('默认 rememberCredentials=true，密钥写入 localStorage', () => {
    const cfg = loadSyncConfig()
    expect(cfg.rememberCredentials).toBe(true)
    cfg.webdav.password = 'secret-dav'
    cfg.s3.secretAccessKey = 'secret-s3'
    expect(saveSyncConfig(cfg)).toBe(true)
    const raw = JSON.parse(localStorage.getItem('novaepub:sync'))
    expect(raw.webdav.password).toBe('secret-dav')
    expect(raw.s3.secretAccessKey).toBe('secret-s3')
  })

  it('rememberCredentials=false 时密钥不落盘，但会话内仍可读', () => {
    const cfg = loadSyncConfig()
    cfg.rememberCredentials = false
    cfg.webdav.serverUrl = 'https://dav.example.com'
    cfg.webdav.password = 'session-only'
    cfg.s3.secretAccessKey = 's3-session'
    saveSyncConfig(cfg)

    const raw = JSON.parse(localStorage.getItem('novaepub:sync'))
    expect(raw.webdav.password).toBe('')
    expect(raw.s3.secretAccessKey).toBe('')
    expect(raw.rememberCredentials).toBe(false)
    expect(raw.webdav.serverUrl).toBe('https://dav.example.com')

    // 同一会话内 load 回填内存缓存
    const loaded = loadSyncConfig()
    expect(loaded.webdav.password).toBe('session-only')
    expect(loaded.s3.secretAccessKey).toBe('s3-session')
  })

  it('clearSessionSecrets 后 load 不再回填密钥', () => {
    const cfg = loadSyncConfig()
    cfg.rememberCredentials = false
    cfg.webdav.password = 'temp'
    saveSyncConfig(cfg)
    expect(loadSyncConfig().webdav.password).toBe('temp')
    clearSessionSecrets()
    expect(loadSyncConfig().webdav.password).toBe('')
  })

  it('cacheSessionSecrets 可独立预热会话缓存', () => {
    cacheSessionSecrets({ webdav: { password: 'pre' } })
    const loaded = loadSyncConfig()
    expect(loaded.webdav.password).toBe('pre')
  })
})
