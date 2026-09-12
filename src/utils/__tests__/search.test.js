// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import {
  replaceInText,
  replaceAllInHtml,
  countMatchesInHtml,
  countInBook,
  replaceAllInBook,
} from '../search'

describe('全局查找替换', () => {
  it('纯文本替换支持忽略大小写', () => {
    const result = replaceInText('Abc abc ABC', 'abc', 'X')
    expect(result.count).toBe(3)
    expect(result.text).toBe('X X X')
  })

  it('纯文本替换支持区分大小写', () => {
    const result = replaceInText('Abc abc ABC', 'abc', 'X', { caseSensitive: true })
    expect(result.count).toBe(1)
    expect(result.text).toBe('Abc X ABC')
  })

  it('HTML 文本节点替换保留标签', () => {
    const html = '<p>你好 <strong>世界</strong> 你好</p>'
    const result = replaceAllInHtml(html, '你好', '您好')
    expect(result.count).toBe(2)
    expect(result.html).toContain('<strong>世界</strong>')
    expect(result.html).toContain('<p>您好 <strong>世界</strong> 您好</p>')
  })

  it('HTML 计数只看文本节点', () => {
    const html = '<p title="你好">你好</p>'
    expect(countMatchesInHtml(html, '你好')).toBe(1)
  })

  it('全书计数包含正文与章节标题', () => {
    const book = {
      chapters: [
        { id: 'a', title: '第一章', content: '<p>主角出现了</p>' },
        { id: 'b', title: '第二章', content: '<p>主角还在</p>' },
      ],
    }
    const counts = countInBook(book, '主角')
    expect(counts.total).toBe(2)
    expect(counts.content).toBe(2)
  })

  it('全书替换修改正文与标题并返回数量', () => {
    const book = {
      chapters: [
        { id: 'a', title: '第一章', content: '<p>主角出现了</p><p>主角还在</p>' },
      ],
    }
    const result = replaceAllInBook(book, '主角', '英雄', { includeTitles: false })
    expect(result.count).toBe(2)
    expect(book.chapters[0].content).toContain('英雄出现了')
    expect(book.chapters[0].content).not.toContain('主角')
    expect(book.chapters[0].title).toBe('第一章')
  })

  it('标题替换默认开启', () => {
    const book = { chapters: [{ id: 'a', title: '主角传', content: '<p>内容</p>' }] }
    const result = replaceAllInBook(book, '主角', '英雄')
    expect(result.modifiedTitles).toBe(1)
    expect(book.chapters[0].title).toBe('英雄传')
  })
})
