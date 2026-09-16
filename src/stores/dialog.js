import { defineStore } from 'pinia'

/**
 * 全局对话框：替代 window.alert / window.confirm。
 * alert/confirm 返回 Promise，DialogHost 负责渲染。
 */
export const useDialogStore = defineStore('dialog', {
  state: () => ({
    open: false,
    mode: 'alert',
    title: '提示',
    message: '',
    _resolve: null,
  }),
  actions: {
    alert(message, title = '提示') {
      return new Promise((resolve) => {
        this.open = true
        this.mode = 'alert'
        this.title = title
        this.message = String(message ?? '')
        this._resolve = resolve
      })
    },
    confirm(message, title = '确认') {
      return new Promise((resolve) => {
        this.open = true
        this.mode = 'confirm'
        this.title = title
        this.message = String(message ?? '')
        this._resolve = resolve
      })
    },
    /** DialogHost 在用户点击确定/取消/关闭时调用。 */
    settle(result) {
      this.open = false
      const resolve = this._resolve
      this._resolve = null
      if (resolve) resolve(!!result)
    },
  },
})
