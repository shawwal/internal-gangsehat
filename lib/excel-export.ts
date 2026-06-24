import * as XLSX from 'xlsx'

export interface ExportColumn<T> {
  header: string
  value: (row: T) => string | number | null | undefined
}

export function exportToExcel<T>(
  data: T[],
  columns: ExportColumn<T>[],
  filename: string,
): void {
  const rows = data.map((row) => {
    const obj: Record<string, string | number> = {}
    for (const col of columns) {
      const v = col.value(row)
      obj[col.header] = v ?? ''
    }
    return obj
  })

  const ws = XLSX.utils.json_to_sheet(rows, { header: columns.map((c) => c.header) })
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Data')
  XLSX.writeFile(wb, `${filename}.xlsx`)
}
