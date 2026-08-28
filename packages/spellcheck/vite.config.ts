import { defineConfig } from 'vite'
import typescript from '@rollup/plugin-typescript'
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js'
import * as path from 'path'
import { fileURLToPath } from 'node:url'

export default defineConfig(({ mode }) => {
  const name = 'spellcheck'
  const resolve = {
    alias: {
      '@cspell-en-us-dictionary': `${fileURLToPath(
        new URL(
          './node_modules/@cspell/dict-en_us/en_US.trie.gz',
          import.meta.url
        )
      )}?url`
    }
  }
  if (mode === 'lib') {
    return {
      resolve,
      plugins: [
        cssInjectedByJsPlugin({
          styleId: `${name}-style`,
          topExecutionPriority: true
        }),
        {
          ...typescript({
            tsconfig: './tsconfig.json',
            include: ['./src/spellcheck/**']
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
          entry: path.resolve(__dirname, 'src/spellcheck/index.ts')
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
    resolve,
    base: `/${name}/`,
    server: {
      host: '0.0.0.0'
    }
  }
})
