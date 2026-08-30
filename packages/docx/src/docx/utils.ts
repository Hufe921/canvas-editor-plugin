export function saveAs(blob: Blob, name: string) {
  const a = document.createElement('a')
  a.href = window.URL.createObjectURL(blob)
  a.download = name
  // 部分浏览器（如 Safari）要求锚点挂载到文档中才能触发下载
  a.style.display = 'none'
  document.body.append(a)
  a.click()
  a.remove()
  window.URL.revokeObjectURL(a.href)
}
