'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Loader2, X } from 'lucide-react'
import { FaWhatsapp } from 'react-icons/fa'
import { getResumeShareData, type ResumeShareData } from '@/app/actions/resumeLinks'
import { downloadPatientResumePdf } from '@/lib/downloadPatientResumePdf'
import { DEFAULT_RESUME_SHARE_MESSAGE, fillTemplate, formatDate, formatWaNumber } from '@/lib/utils'
import { useToast } from '@/context/ToastContext'

interface Props {
  visitId: string
  patientName: string
  onClose: () => void
}

// "Bagikan ke Pasien": lets the admin edit the WhatsApp message, then opens the
// patient's chat with it prefilled and downloads the resume PDF to attach —
// wa.me links can only carry text, not a file.
export function ShareResumeDialog({ visitId, patientName, onClose }: Props) {
  const { showToast } = useToast()
  const [data, setData] = useState<ResumeShareData | null>(null)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    let cancelled = false
    getResumeShareData(visitId).then((result) => {
      if (cancelled) return
      setData(result)
      // Default text comes from Template Pesan WA (per branch), still editable here.
      setMessage(fillTemplate(result.template || DEFAULT_RESUME_SHARE_MESSAGE, {
        nama:    result.resume?.patientName ?? patientName,
        tanggal: result.resume ? formatDate(result.resume.visitDate) : '',
      }))
    })
    return () => { cancelled = true }
  }, [visitId, patientName])

  async function send() {
    if (!data?.resume) return
    // Opened synchronously inside the click, before the PDF render's awaits,
    // so the browser doesn't block it as a popup.
    if (data.phone) {
      window.open(`https://wa.me/${formatWaNumber(data.phone)}?text=${encodeURIComponent(message.trim())}`, '_blank')
    }
    setSending(true)
    try {
      await downloadPatientResumePdf(data.resume, 'Resume')
      showToast(
        data.phone ? 'Chat WhatsApp dibuka — lampirkan PDF resume yang baru diunduh' : 'PDF resume diunduh',
        'success',
      )
      onClose()
    } catch {
      showToast('Gagal membuat PDF resume', 'error')
    } finally {
      setSending(false)
    }
  }

  // Portalled to <body>: the card this opens from is a .glass-card, whose
  // backdrop-filter would otherwise trap a fixed overlay inside the card.
  return createPortal(
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="glass-card w-full max-w-md max-h-[88vh] flex flex-col p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">Bagikan ke Pasien</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{patientName}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 cursor-pointer"><X size={16} /></button>
        </div>

        {!data ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 size={18} className="animate-spin" />
          </div>
        ) : data.error ? (
          <p className="text-sm text-destructive py-4">{data.error}</p>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-3">
            {data.phone ? (
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Pesan WhatsApp ke {data.phone}
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={5}
                  className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
              </div>
            ) : (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Nomor WhatsApp pasien belum diisi — hanya PDF resume yang bisa diunduh.
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              PDF resume akan diunduh otomatis. Lampirkan file tersebut di chat WhatsApp yang terbuka.
            </p>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-4">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted cursor-pointer">Batal</button>
          {data?.resume && (
            <button
              onClick={send}
              disabled={sending || (!!data.phone && !message.trim())}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 cursor-pointer"
            >
              {sending ? <Loader2 size={14} className="animate-spin" /> : data.phone ? <FaWhatsapp size={14} /> : null}
              {data.phone ? 'Kirim via WhatsApp' : 'Unduh PDF'}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
