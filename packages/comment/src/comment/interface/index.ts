// 批注数据模型，id 即编辑器成组 groupId
export interface IComment {
  id: string
  content: string
  createdAt: string
  user?: string
}

export interface ICommentLang {
  // 右键菜单-添加批注
  addCommentText: string
  // 右键菜单/卡片按钮-删除批注
  removeCommentText: string
  // 批注输入占位符
  placeholderText: string
  // 确认按钮文案
  confirmText: string
  // 取消按钮文案
  cancelText: string
}

export interface ICommentOptions {
  // 批注高亮色，默认 #fde7e9
  highlightColor?: string
  // 当前用户名（写入批注元数据）
  user?: string
  // 右侧批注栏宽度，默认 220
  railWidth?: number
  // 批注连接线颜色，默认 #f54a45
  lineColor?: string
  // 批注卡片作者名颜色，默认 #f54a45
  userColor?: string
  // 弹层语言（内置 zhCN、en），默认取编辑器 locale 配置
  locale?: string
  // 覆盖对应语言的弹层文案
  lang?: Partial<ICommentLang>
  onAdd?: (comment: IComment) => void
  onRemove?: (id: string) => void
}
