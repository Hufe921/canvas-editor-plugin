import { defineConfig } from 'vite'

export default defineConfig(() => {
  return {
    base: `/canvas-editor-plugin/`,
    server: {
      host: '0.0.0.0'
    }
  }
})
