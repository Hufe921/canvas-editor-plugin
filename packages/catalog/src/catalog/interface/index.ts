export interface ICatalogLang {
  // 面板标题文案
  titleText: string
  // 无标题时的占位文案
  emptyText: string
}

export interface ICatalogPluginOption {
  // 目录挂载容器（必传），目录渲染到该容器内并填满容器
  container: HTMLElement
  // 目录语言（内置 zhCN、en），默认取编辑器 locale 配置
  locale?: string
  // 覆盖对应语言的目录文案
  lang?: Partial<ICatalogLang>
}
