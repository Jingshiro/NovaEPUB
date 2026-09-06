# 轻墨 LightInk · NovaEPUB

> 像写 Notion 文档一样制作 EPUB 电子书。

一款**纯前端、零安装**的 EPUB 可视化编辑器，替代 Sigil 的复杂代码视图，提供 Notion 风格的分块写作体验与极致的排版预览。

## 功能特性

- **书架 / 导入**：左侧书目列表 + 中央「新建 EPUB」卡片（点击创建空白书）；支持拖拽或点击「导入 .epub」上传并自动解析（JSZip 解压 → 解析 OPF / NCX）。
- **三栏编辑器**：左目录 / 中 TipTap 画布 / 右属性面板。
  - 键入 `/` 唤出块类型菜单（正文 / 标题 / 引用 / 列表 / 代码块）。
  - 粘贴纯文本自动清理格式（清除 Word 垃圾标记）。
  - 目录支持新增 / 删除 / 重命名（双击）/ 上移下移排序。
- **元数据管理**：书名、作者、出版日期、语言、唯一标识（UUID）。
- **预览模式**：手机尺寸（375px 居中）iframe 模拟阅读器。
- **导出 EPUB**：自动生成 OPF + NCX + XHTML + CSS，JSZip 打包并下载，符合 W3C EPUB 规范（mimetype 首项且不压缩）。

## 技术栈

- Vue 3 (Composition API) + Vite
- Pinia（状态管理）、Vue Router（`/library` 与 `/editor/:bookId`）
- TipTap (ProseMirror) 富文本内核
- JSZip（EPUB 打包 / 解析）、FileSaver（下载）
- Tailwind CSS（自定义设计系统）

## 设计系统

柔和、留白、功能性；**全局禁用蓝紫色系**。

| 用途 | 颜色 |
| --- | --- |
| 主背景 | `#FBFBFB` |
| 卡片背景 | `#FFFFFF` |
| 分割背景 | `#F4F4F4` |
| 主文字 | `#1E1E1E` |
| 次级文字 | `#6B6B6B` |
| 占位文字 | `#9B9B9B` |
| **主色调（朱砂红）** | `#E16259` |
| 辅助色（暖驼） | `#D4A373` |
| 边框 | `#E8E8E8` |
| 危险色 | `#C84E4E` |

## 快速开始

```bash
npm install
npm run dev      # 开发：http://localhost:5173
npm run build    # 生产构建 → dist/
npm test         # 单元测试（Vitest）
```

## 目录结构

```
/src
  /assets
  /components
    /common      # AppButton, AppInput, AppModal
    /editor      # EditorCanvas, EditorMenuBar, BlockPicker, BookMetadataModal
    /sidebar     # ChapterTree, MetadataPanel
    /preview     # MobilePreviewFrame
  /stores        # book, editor, ui
  /hooks
  /utils         # id, storage, epubParser, epubExporter
  /styles        # tailwind.css（设计 token）
  /router
  /views         # LibraryView, EditorView
  App.vue
  main.js
```

## 数据流

- 完全基于 `localStorage`（键 `novaepub:library` 存储 `{ bookId: book }`）。
- `bookStore` 管理书籍对象与章节数组；`editorStore` 记录当前章节与 TipTap 实例；`uiStore` 管理侧边栏、预览模式、元数据弹窗。
- 导出流程：`bookStore` → 生成 OPF / NCX / XHTML / CSS → JSZip 打包 `mimetype`、`META-INF`、`OEBPS` → 生成 Blob 并下载。

## 未来移植

- **APK**：纯静态，可用 PWA Builder / Nitron 直接指向 `index.html` 打包。
- **小程序**：仅规划；TipTap 在 webview 中运行，未来用 `web-view` 组件内嵌本网页。广告位预留在底部（开发阶段忽略）。
