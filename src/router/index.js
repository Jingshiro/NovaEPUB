import { createRouter, createWebHistory } from 'vue-router'
import LibraryView from '../views/LibraryView.vue'
import EditorView from '../views/EditorView.vue'

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
