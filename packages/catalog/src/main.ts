import Editor, { ElementType, TitleLevel } from '@hufe921/canvas-editor'
import catalogPlugin from './catalog'

window.onload = function () {
  const container = document.querySelector<HTMLDivElement>('#editor')!
  const instance = new Editor(container, {
    main: [
      {
        value: '第一章 产品概述',
        type: ElementType.TITLE,
        level: TitleLevel.FIRST,
        valueList: [{ value: '第一章 产品概述' }]
      },
      {
        value: '\ncanvas-editor 是一款基于 Canvas 的富文本编辑器。\n'
      },
      {
        value: '1.1 功能特性',
        type: ElementType.TITLE,
        level: TitleLevel.SECOND,
        valueList: [{ value: '1.1 功能特性' }]
      },
      {
        value: '\n支持分页、页眉页脚、表格、控件等能力。\n'
      },
      {
        value: '1.2 适用场景',
        type: ElementType.TITLE,
        level: TitleLevel.SECOND,
        valueList: [{ value: '1.2 适用场景' }]
      },
      {
        value: '\n合同、报告、论文等长文档编辑场景。\n'
      },
      {
        value: '第二章 快速上手',
        type: ElementType.TITLE,
        level: TitleLevel.FIRST,
        valueList: [{ value: '第二章 快速上手' }]
      },
      {
        value: '2.1 安装',
        type: ElementType.TITLE,
        level: TitleLevel.SECOND,
        valueList: [{ value: '\n2.1 安装' }]
      },
      {
        value: '\nnpm install @hufe921/canvas-editor --save\n'
      },
      {
        value: '2.2 使用',
        type: ElementType.TITLE,
        level: TitleLevel.SECOND,
        valueList: [{ value: '2.2 使用' }]
      },
      {
        value: '\n创建容器并实例化编辑器即可使用。'
      }
    ]
  })
  // 目录渲染到传入的挂载容器内
  instance.use(catalogPlugin, {
    container: document.querySelector<HTMLDivElement>('#catalog-container')!
  })
}
