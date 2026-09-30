'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { Loader2, Upload, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { uploadErrorMessage } from '@/lib/storageErrors'

const BUCKET = 'assessment-photos'
const MAX_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB — matches bucket file_size_limit (migration 087)

interface Props {
  /** Object paths inside the `assessment-photos` bucket. */
  paths: string[]
  onChange: (paths: string[]) => void
  max: number
  folder: string
  label: string
  readOnly?: boolean
}

export function PhotoUploadField({ paths, onChange, max, folder, label, readOnly }: Props) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Private bucket — resolve paths to short-lived signed URLs for preview.
  useEffect(() => {
    const missing = paths.filter((p) => !urls[p])
    if (!missing.length) return
    let cancelled = false
    createClient().storage.from(BUCKET).createSignedUrls(missing, 60 * 60).then(({ data }) => {
      if (cancelled || !data) return
      setUrls((prev) => {
        const next = { ...prev }
        for (const d of data) if (d.path && d.signedUrl) next[d.path] = d.signedUrl
        return next
      })
    })
    return () => { cancelled = true }
  }, [paths, urls])

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (inputRef.current) inputRef.current.value = ''
    if (!files.length) return
    setError(null)

    const room = max - paths.length
    if (files.length > room) setError(`Maksimal ${max} foto.`)
    const accepted = files.slice(0, room).filter((f) => {
      if (f.size > MAX_SIZE_BYTES) { setError('Ukuran file maksimal 5 MB.'); return false }
      return true
    })
    if (!accepted.length) return

    setUploading(true)
    const supabase = createClient()
    const uploaded: string[] = []
    for (const file of accepted) {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false })
      if (upErr) { setError(uploadErrorMessage(upErr.message)); continue }
      uploaded.push(path)
    }
    setUploading(false)
    if (uploaded.length) onChange(max === 1 ? uploaded.slice(0, 1) : [...paths, ...uploaded])
  }

  function remove(path: string) {
    // Only detach from the form — the storage object is kept so an unsaved
    // removal never leaves the saved assessment pointing at a deleted file.
    onChange(paths.filter((p) => p !== path))
  }

  const canAdd = !readOnly && paths.length < max

  return (
    <div className="space-y-2">
      {paths.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {paths.map((p) => (
            <div key={p} className="relative aspect-square rounded-xl overflow-hidden border border-border bg-muted">
              {urls[p] ? (
                <a href={urls[p]} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={urls[p]} alt={label} className="w-full h-full object-cover" />
                </a>
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Loader2 size={16} className="animate-spin text-muted-foreground" />
                </div>
              )}
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => remove(p)}
                  aria-label="Hapus foto"
                  className="absolute top-1 right-1 p-1 rounded-lg bg-black/60 text-white hover:bg-black/80 transition-colors"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {canAdd && (
        <>
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept="image/*"
            multiple={max > 1}
            onChange={handleFiles}
            className="hidden"
          />
          <label
            htmlFor={inputId}
            className="flex items-center gap-4 px-4 py-4 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-muted group-hover:bg-primary/10 flex items-center justify-center shrink-0 transition-colors">
              {uploading
                ? <Loader2 size={16} className="animate-spin text-primary" />
                : <Upload size={16} className="text-muted-foreground group-hover:text-primary transition-colors" />}
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                {uploading ? 'Mengunggah...' : `Unggah foto ${label}`}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                JPG, PNG · Maks. 5 MB{max > 1 ? ` · ${paths.length}/${max} foto` : ' · 1 foto'}
              </p>
            </div>
          </label>
        </>
      )}

      {readOnly && paths.length === 0 && <p className="text-xs text-muted-foreground">—</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
