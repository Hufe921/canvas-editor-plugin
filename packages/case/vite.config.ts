import { defineConfig } from 'vite'
import typescript from '@rollup/plugin-typescript'
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js'
import * as path from 'path'

export default defineConfig(({ mode }) => {
  const name = 'case'
  if (mode === 'lib') {
    return {
      plugins: [
        cssInjectedByJsPlugin({
          styleId: `${name}-style`,
          topExecutionPriority: true
        }),
        {
          ...typescript({
            tsconfig: './tsconfig.json',
            include: ['./src/case/**']
          }),
          apply: 'build',
          declaration: true,
          declarationDir: 'types/',
          rootDir: '/'
        }
      ],
      build: {
        lib: {
          name,
          fileName: name,
          entry: path.resolve(__dirname, 'src/case/index.ts')
        },
        rollupOptions: {
          output: {
            sourcemap: true
          },
          external: ['@hufe921/canvas-editor']
        }
      }
    }
  }
  return {
    base: `/${name}/`,
    server: {
      host: '0.0.0.0'
    }
  }
})
