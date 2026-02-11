export interface IMenstrualHistoryData {
  /** 初潮年龄 */
  menarcheAge: string
  /** 行经期天数 */
  menstrualDuration: string
  /** 月经周期天数 */
  menstrualCycle: string
  /** 末次月经时间 */
  lastMenstrualPeriod: string
}

export interface IMenstrualHistoryOption {
  /** 初始数据（用于二次编辑） */
  data?: IMenstrualHistoryData
  /** 弹窗关闭回调 */
  onConfirm?: (
    data: IMenstrualHistoryData & { svg: string; width: number; height: number }
  ) => void
  /** 弹窗取消回调 */
  onCancel?: () => void
}
