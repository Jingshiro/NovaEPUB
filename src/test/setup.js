// Vitest 环境下的 localStorage 桩，保证 store 测试可用且无噪音
const memory = {}
globalThis.localStorage = {
  getItem: (key) => (key in memory ? memory[key] : null),
  setItem: (key, value) => {
    memory[key] = String(value)
  },
  removeItem: (key) => {
    delete memory[key]
  },
  clear: () => {
    Object.keys(memory).forEach((key) => delete memory[key])
  },
}
