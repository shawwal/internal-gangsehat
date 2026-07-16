/** Turn a Supabase Storage upload error into a specific, user-facing reason. */
export function uploadErrorMessage(message: string): string {
  const lower = message.toLowerCase()
  if (lower.includes('exceeded the maximum allowed size')) return 'Ukuran file melebihi batas maksimal.'
  if (lower.includes('mime type')) return 'Format file tidak didukung.'
  return 'Gagal mengunggah. Coba lagi.'
}
