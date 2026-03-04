import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Canvas Editor Plugin',
  description: 'Plugins for canvas-editor',
  base: '/canvas-editor-plugin/',
  cleanUrls: true,
  locales: {
    root: {
      label: '中文',
      lang: 'zh-CN',
      themeConfig: {
        nav: [
          { text: '首页', link: '/' },
          { text: '指南', link: '/guide/' },
          { text: '插件', link: '/plugins/' },
          {
            text: 'Demo',
            link: 'https://codesandbox.io/embed/nostalgic-grothendieck-fwm59s?fontsize=14&hidenavigation=1&theme=dark'
          }
        ],
        sidebar: {
          '/guide/': [
            {
              text: '指南',
              items: [
                { text: '快速开始', link: '/guide/' },
                { text: '安装', link: '/guide/installation' },
                { text: '使用', link: '/guide/usage' }
              ]
            }
          ],
          '/plugins/': [
            {
              text: '插件列表',
              items: [
                { text: '概览', link: '/plugins/' },
                { text: '条形码 1D', link: '/plugins/barcode1d' },
                { text: '条形码 2D', link: '/plugins/barcode2d' },
                { text: '代码块', link: '/plugins/codeblock' },
                { text: 'DOCX 导入导出', link: '/plugins/docx' },
                { text: 'Excel 导入', link: '/plugins/excel' },
                { text: '浮动工具栏', link: '/plugins/floating-toolbar' },
                { text: '图表绘制', link: '/plugins/diagram' },
                { text: '大小写转换', link: '/plugins/case' },
                { text: '特殊字符', link: '/plugins/special-characters' },
                { text: '月经史', link: '/plugins/menstrual-history' }
              ]
            }
          ]
        },
        outline: {
          label: '页面导航'
        },
        docFooter: {
          prev: '上一页',
          next: '下一页'
        },
        lastUpdated: {
          text: '最后更新于'
        },
        darkModeSwitchLabel: '外观',
        returnToTopLabel: '返回顶部',
        langMenuLabel: '多语言'
      }
    },
    en: {
      label: 'English',
      lang: 'en-US',
      link: '/en/',
      themeConfig: {
        nav: [
          { text: 'Home', link: '/en/' },
          { text: 'Guide', link: '/en/guide/' },
          { text: 'Plugins', link: '/en/plugins/' },
          {
            text: 'Demo',
            link: 'https://codesandbox.io/embed/nostalgic-grothendieck-fwm59s?fontsize=14&hidenavigation=1&theme=dark'
          }
        ],
        sidebar: {
          '/en/guide/': [
            {
              text: 'Guide',
              items: [
                { text: 'Quick Start', link: '/en/guide/' },
                { text: 'Installation', link: '/en/guide/installation' },
                { text: 'Usage', link: '/en/guide/usage' }
              ]
            }
          ],
          '/en/plugins/': [
            {
              text: 'Plugins',
              items: [
                { text: 'Overview', link: '/en/plugins/' },
                { text: 'Barcode 1D', link: '/en/plugins/barcode1d' },
                { text: 'Barcode 2D', link: '/en/plugins/barcode2d' },
                { text: 'Code Block', link: '/en/plugins/codeblock' },
                { text: 'DOCX Import/Export', link: '/en/plugins/docx' },
                { text: 'Excel Import', link: '/en/plugins/excel' },
                {
                  text: 'Floating Toolbar',
                  link: '/en/plugins/floating-toolbar'
                },
                { text: 'Diagram', link: '/en/plugins/diagram' },
                { text: 'Case Converter', link: '/en/plugins/case' },
                {
                  text: 'Special Characters',
                  link: '/en/plugins/special-characters'
                },
                {
                  text: 'Menstrual History',
                  link: '/en/plugins/menstrual-history'
                }
              ]
            }
          ]
        },
        outline: {
          label: 'On this page'
        },
        docFooter: {
          prev: 'Previous page',
          next: 'Next page'
        },
        lastUpdated: {
          text: 'Last updated'
        },
        darkModeSwitchLabel: 'Appearance',
        returnToTopLabel: 'Return to top',
        langMenuLabel: 'Languages'
      }
    }
  },
  themeConfig: {
    socialLinks: [
      {
        icon: 'github',
        link: 'https://github.com/hufe921/canvas-editor-plugin'
      }
    ],
    search: {
      provider: 'local'
    }
  }
})
