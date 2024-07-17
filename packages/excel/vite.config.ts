import { defineConfig } from 'vite'
import typescript from '@rollup/plugin-typescript'
import * as path from 'path'

export default defineConfig(({ mode }) => {
  const name = 'excel'
  if (mode === 'lib') {
    return {
      plugins: [
        {
          ...typescript({
            tsconfig: './tsconfig.json',
            include: ['./src/excel/**']
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
          entry: path.resolve(__dirname, 'src/excel/index.ts')
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
