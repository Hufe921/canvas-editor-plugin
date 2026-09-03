import { defineConfig } from 'vite'
import typescript from '@rollup/plugin-typescript'
import * as path from 'path'

export default defineConfig(({ mode }) => {
  const name = 'formula'
  if (mode === 'lib') {
    return {
      plugins: [
        // 剔除 KaTeX 样式中的 woff/truetype 字体引用，仅内联 woff2，减小产物体积
        {
          name: 'strip-non-woff2-font',
          enforce: 'pre',
          transform(code, id) {
            if (id.includes('katex.min.css')) {
              return {
                code: code.replace(
                  /,?\s*url\([^)]*\)\s*format\(['"](?:woff|truetype)['"]\)/g,
                  ''
                ),
                map: { mappings: '' }
              }
            }
          }
        },
        {
          ...typescript({
            tsconfig: './tsconfig.json',
            include: ['./src/formula/**', './src/vite-env.d.ts']
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
          entry: path.resolve(__dirname, 'src/formula/index.ts')
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
