/**
 * 默认阅读样式（纯函数，无任何依赖）。
 * 单独成模块：预览组件与导出器共用，且不应把 JSZip/file-saver 连带进编辑器首包。
 */

/** 构建默认阅读 CSS，可追加额外样式。 */
export function buildStylesCss(extra = '') {
  return `/* NovaEpub 默认阅读样式 */
body {
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, 'Noto Sans', 'PingFang SC', sans-serif;
  line-height: 1.8;
  color: #37352F;
  margin: 0;
  padding: 0 5% 6% 5%;
  font-size: 1em;
}
.chapter-title {
  font-size: 1.6em;
  font-weight: 700;
  margin: 0 0 1em 0;
}
.chapter-body p { margin: 0 0 1em 0; }
.chapter-body h1 { font-size: 1.8em; }
.chapter-body h2 { font-size: 1.5em; }
.chapter-body h3 { font-size: 1.25em; }
.chapter-body blockquote {
  border-left: 3px solid #E9E8E4;
  margin: 1em 0;
  padding: 0.5em 1em;
  color: #787774;
  background: #F7F6F3;
}
.chapter-body img { max-width: 100%; height: auto; display: block; margin: 1em auto; }
.chapter-body ul, .chapter-body ol { margin: 0 0 1em 0; padding-left: 1.5em; }
.chapter-body a { color: #37352F; }
.chapter-body table {
  border-collapse: collapse;
  margin: 1em 0;
  max-width: 100%;
}
.chapter-body th, .chapter-body td {
  border: 1px solid #E9E8E4;
  padding: 0.4em 0.7em;
  text-align: left;
  vertical-align: top;
}
.chapter-body th { background: #F7F6F3; }
${extra}
`
}
