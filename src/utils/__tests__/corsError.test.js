// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { explainNetworkError, CORS_DOC_PATH } from '../webdav'

describe('explainNetworkError（跨域/网络失败友好化）', () => {
  it('TypeError Failed to fetch → 标记 corsLikely 并带文档路径', () => {
    const err = explainNetworkError(new TypeError('Failed to fetch'), 'WebDAV')
    expect(err.corsLikely).toBe(true)
    expect(err.docPath).toBe(CORS_DOC_PATH)
    expect(err.message).toContain('跨域')
    expect(err.message).toContain('S3')
  })

  it('S3 文案指向桶 CORS 配置', () => {
    const err = explainNetworkError(new TypeError('Failed to fetch'), 'S3')
    expect(err.message).toContain('桶')
    expect(err.message).toContain('跨域')
    expect(err.corsLikely).toBe(true)
  })

  it('普通 HTTP 错误不误判为跨域', () => {
    const err = explainNetworkError(new Error('上传失败（403）'), 'WebDAV')
    expect(err.message).toBe('上传失败（403）')
    expect(err.corsLikely).toBeUndefined()
  })

  it('NetworkError 文案也识别', () => {
    const err = explainNetworkError(new TypeError('NetworkError when attempting to fetch resource.'), 'WebDAV')
    expect(err.corsLikely).toBe(true)
  })
})
