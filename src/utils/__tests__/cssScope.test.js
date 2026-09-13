// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { scopeCss } from '../cssScope'

describe('scopeCss：书内 CSS 限定到编辑器容器', () => {
  it('body/html/:root 映射为 scope 容器本身', () => {
    const out = scopeCss('body { margin: 5% 8%; }\nhtml { color: red; }\n:root { --x: 1; }', '.SC')
    expect(out).toContain('.SC{ margin: 5% 8%; }')
    expect(out).toContain('.SC{ color: red; }')
    expect(out).toContain('.SC{ --x: 1; }')
    // 不应再有裸的全局 body 选择器
    expect(out).not.toMatch(/(^|[}\s])body\s*\{/)
  })

  it('普通选择器加后代前缀，多选择器逐个处理', () => {
    const out = scopeCss('.bubble { color: #fff; }\np { text-indent: 2em; }\nh1, h2 { font-size: 1.8em; }', '.SC')
    expect(out).toContain('.SC .bubble')
    expect(out).toContain('.SC p{ text-indent: 2em; }')
    expect(out).toContain('.SC h1, .SC h2')
  })

  it('@media 内部递归改写', () => {
    const out = scopeCss('@media (max-width: 600px) { body { margin: 0; } .x { display: none; } }', '.SC')
    expect(out).toMatch(/@media\s*\(\s*max-width:\s*600px\s*\)\s*\{/)
    expect(out).toContain('.SC{ margin: 0; }')
    expect(out).toContain('.SC .x')
  })

  it('@font-face / @keyframes / @namespace 原样保留', () => {
    const css = [
      '@font-face { font-family: "X"; src: url("../Fonts/sysz.ttf"); }',
      '@keyframes blink { 50% { opacity: 0; } }',
      '@namespace epub "http://www.idpf.org/2007/ops";',
      'p { margin: 0; }',
    ].join('\n')
    const out = scopeCss(css, '.SC')
    expect(out).toContain('@font-face')
    expect(out).toContain('font-family: "X"')
    expect(out).toContain('@keyframes blink')
    expect(out).toContain('@namespace')
    expect(out).toContain('.SC p')
  })

  it('真实导出书（带全局 body/p 的样式）注入后不再有裸 body 规则', () => {
    const css = `body { font-family: "ZhenSong"; margin: 5% 8%; }
p { text-indent: 2em; }
.half-page-spacer { height: 35vh; }`
    const out = scopeCss(css, '.novaepub-editor-scope')
    expect(out).not.toMatch(/(^|[}\s])body\s*\{/)
    expect(out).toContain('.novaepub-editor-scope{ font-family: "ZhenSong"; margin: 5% 8%; }')
    expect(out).toContain('.novaepub-editor-scope p')
  })
})
