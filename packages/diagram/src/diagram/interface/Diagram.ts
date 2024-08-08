import { Lang } from '../enum/Lang'

export interface IDiagramOption {
  lang?: Lang
  data?: string
  onDestroy?: (message?: any) => void
}
