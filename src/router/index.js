import { createRouter, createWebHistory } from 'vue-router'

// 路由级懒加载：书架与编辑器各自分包，TipTap/JSZip 不再打进首屏
const LibraryView = () => import('../views/LibraryView.vue')
const EditorView = () => import('../views/EditorView.vue')

const routes = [
  { path: '/', redirect: '/library' },
  { path: '/library', name: 'library', component: LibraryView },
  { path: '/editor/:bookId', name: 'editor', component: EditorView, props: true },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
