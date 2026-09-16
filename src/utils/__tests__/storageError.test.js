// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { saveLibrary, getLastStorageError } from '../storage'
import { useBookStore } from '../../stores/book'
import { useUiStore } from '../../stores/ui'

function mockQuotaExceeded() {
  return vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
    const err = new Error('QuotaExceededError')
    err.name = 'QuotaExceededError'
    throw err
  })
}

describe('storage 配额失败可见性', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('saveLibrary 成功时返回 true 且无错误', () => {
    expect(saveLibrary({ a: { id: 'a' } })).toBe(true)
    expect(getLastStorageError()).toBeNull()
  })

  it('localStorage 抛错时 saveLibrary 返回 false 并记录错误', () => {
    mockQuotaExceeded()
    expect(saveLibrary({ a: { id: 'a' } })).toBe(false)
    expect(getLastStorageError()).toBeTruthy()
  })

  it('bookStore.persist 失败时向 ui store 写入 storageError', () => {
    mockQuotaExceeded()
    const bookStore = useBookStore()
    const ui = useUiStore()
    bookStore.createBook()
    expect(ui.storageError).toBeTruthy()
    expect(ui.storageError).toContain('存储')
    ui.clearStorageError()
    expect(ui.storageError).toBeNull()
  })
})
