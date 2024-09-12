import { convertInchesToTwip } from 'docx'

export function saveAs(blob: Blob, name: string) {
  const a = document.createElement('a')
  a.href = window.URL.createObjectURL(blob)
  a.download = name
  a.click()
  window.URL.revokeObjectURL(a.href)
}

export function convertPxToSize(pxSize: number): number {
  const inches = (pxSize / 96)
  return convertInchesToTwip(inches)
}