import { describe, it, expect } from 'vitest'
import { parseBackupBundle, sanitizeBackupBook, serializeLibrary } from '../backup'
import { createBook } from '../../stores/book'

describe('backup schema 校验', () => {
  it('sanitizeBackupBook 丢弃缺少 id / 章节的书', () => {
    expect(sanitizeBackupBook(null)).toBeNull()
    expect(sanitizeBackupBook({ title: 'x' })).toBeNull()
    expect(sanitizeBackupBook({ id: 'b1', chapters: [] })).toBeNull()
    expect(sanitizeBackupBook({ id: 'b1', chapters: [{ title: 'no-id' }] })).toBeNull()
  })

  it('sanitizeBackupBook 保留白名单字段并类型纠偏', () => {
    const raw = {
      id: 'b1',
      title: '好书',
      author: '作者',
      cover: 'data:image/png;base64,xx',
      chapters: [
        { id: 'c1', title: '第一章', content: '<p>hi</p>', wordCount: 2 },
        { id: 123, title: '坏章', content: '<p>x</p>' }, // id 非 string → 丢弃
        { id: 'c2', content: 42 }, // content 非 string → 空串
        'not-an-object',
      ],
      images: [{ id: 'i1', dataUrl: 'data:...' }, { noId: true }, null],
      styles: ['.a{}', 1, '<script>x</script>'],
      extraEvil: '<script>alert(1)</script>',
    }
    const book = sanitizeBackupBook(raw)
    expect(book.id).toBe('b1')
    expect(book.title).toBe('好书')
    expect(book.chapters).toHaveLength(2)
    expect(book.chapters[0].content).toBe('<p>hi</p>')
    expect(book.chapters[1].content).toBe('')
    expect(book.images).toHaveLength(1)
    expect(book.images[0].id).toBe('i1')
    expect(book.styles).toEqual(['.a{}', '<script>x</script>']) // 类型过滤，内容消毒交给 sanitizeImportedBook
    expect(book.extraEvil).toBeUndefined()
  })

  it('parseBackupBundle 清洗后 books 只含合法书', () => {
    const good = createBook({ id: 'g1', title: '合法' })
    const payload = {
      format: 'novaepub-library-backup',
      version: 2,
      books: [good, { id: 'bad', chapters: 'nope' }, null, 42],
    }
    const { books } = parseBackupBundle(JSON.stringify(payload))
    expect(books).toHaveLength(1)
    expect(books[0].id).toBe('g1')
  })

  it('serializeLibrary → parseBackupBundle 往返保持章节', () => {
    const book = createBook({ id: 'r1', title: '往返' })
    book.chapters[0].content = '<p>正文</p>'
    const text = JSON.stringify(serializeLibrary({ r1: book }))
    const { books } = parseBackupBundle(text)
    expect(books[0].title).toBe('往返')
    expect(books[0].chapters[0].content).toBe('<p>正文</p>')
  })
})
