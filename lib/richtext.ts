// Strip Tiptap-generated HTML (StarterKit output: p/ul/ol/li/strong/em/br — a
// known-safe subset) down to plain text, for syncing rich assessment fields into
// patient_visits' plain-text columns (diagnosis/treatment/chief_complaint).
// Regex-based, not a general HTML sanitizer — runs in Server Actions, no DOM APIs.
export function stripHtml(html: string | null | undefined): string | null {
  if (!html) return null

  const withBreaks = html
    .replace(/<\/(p|li|h[1-6])>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')

  const stripped = withBreaks.replace(/<[^>]+>/g, '')

  const decoded = stripped
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")

  const collapsed = decoded.replace(/\n{3,}/g, '\n\n').trim()
  return collapsed || null
}
