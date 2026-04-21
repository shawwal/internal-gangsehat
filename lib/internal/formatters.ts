export function formatTrxCode(year: number, month: number, seq: number): string {
  const mm = String(month).padStart(2, '0')
  const nnnn = String(seq).padStart(4, '0')
  return `TRX/${year}/${mm}/${nnnn}`
}

export function formatRmCode(name: string, date: Date, seq: number): string {
  const initial = name.charAt(0).toUpperCase()
  const dd = String(date.getDate()).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  return `${initial}${dd}${mm}${seq}`
}
