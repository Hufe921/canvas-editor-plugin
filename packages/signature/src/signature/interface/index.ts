export interface ISignatureResult {
  value: string
  width: number
  height: number
}

// 签名图片导出格式
export type SignatureExportType = 'png' | 'svg'

export interface ISignatureLang {
  // 弹窗标题文案
  titleText: string
  // 撤销按钮文案
  undoText: string
  // 清空按钮文案
  clearText: string
  // 取消按钮文案
  cancelText: string
  // 确定按钮文案
  confirmText: string
}

export interface ISignatureOptions {
  width?: number
  height?: number
  // 导出图片格式，默认 svg
  exportType?: SignatureExportType
  // 弹窗语言（内置 zhCN、en），默认取编辑器 locale 配置
  locale?: string
  // 覆盖对应语言的弹窗文案
  lang?: Partial<ISignatureLang>
  onClose?: () => void
  onCancel?: () => void
  onConfirm?: (payload: ISignatureResult | null) => void
}
