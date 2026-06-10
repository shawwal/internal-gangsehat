/**
 * Normalize mixed-format birth dates to ISO `yyyy-mm-dd` (or null).
 *
 * Imported patient data contains three formats:
 *  - "1995-02-01"                                       (ISO)
 *  - "29/06/1999"                                       (Indonesian DD/MM/YYYY)
 *  - "Tue Jan 24 2012 23:59:35 GMT+0800 (Malaysia Time)" (JS Date.toString())
 *
 * Slash/dash numeric dates are ALWAYS day-first — never let `new Date()`
 * parse them, since it assumes US MM/DD and silently swaps day/month.
 */
export function normalizeBirthDate(raw: string | null | undefined): string | null {
  if (!raw) return null
  const s = raw.trim()
  if (!s) return null

  // DD/MM/YYYY or DD-MM-YYYY (day first)
  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (dmy) {
    const [, d, m, y] = dmy
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }

  // ISO yyyy-mm-dd (possibly with a time suffix) — keep the date part
  const iso = s.match(/^\d{4}-\d{2}-\d{2}/)
  if (iso) return iso[0]

  // Anything else (JS Date.toString() etc.) — let Date parse it,
  // then rebuild from local parts to avoid a timezone day-shift
  const parsed = new Date(s)
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear()
    const m = String(parsed.getMonth() + 1).padStart(2, '0')
    const d = String(parsed.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  return null
}
