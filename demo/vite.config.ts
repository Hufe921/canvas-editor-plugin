import { defineConfig } from 'vite'

export default defineConfig(() => {
  return {
    base: `/canvas-editor-plugin-demo/`,
    resolve: {
      // 插件包内嵌旧版 canvas-editor，运行时统一去重到 demo 使用的版本
      dedupe: ['@hufe921/canvas-editor']
    },
    server: {
      host: '0.0.0.0'
    }
  }
})
