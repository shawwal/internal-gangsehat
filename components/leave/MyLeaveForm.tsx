import { useRef } from 'react'
import { CalendarRange, FileText, Upload, X } from 'lucide-react'
import { dayCount } from './types'

const today = new Date().toISOString().split('T')[0]

interface FormState {
  start_date: string
  end_date: string
  reason: string
}

interface Props {
  form: FormState
  proofFile: File | null
  proofPreview: string
  saving: boolean
  onChange: (form: FormState) => void
  onFileChange: (file: File | null, preview: string) => void
  onSubmit: (e: React.SyntheticEvent<HTMLFormElement>) => void
  onClose: () => void
}

export function MyLeaveForm({
  form, proofFile, proofPreview, saving,
  onChange, onFileChange, onSubmit, onClose,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (proofPreview) URL.revokeObjectURL(proofPreview)
    const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : ''
    onFileChange(file, preview)
  }

  function clearProof() {
    if (proofPreview) URL.revokeObjectURL(proofPreview)
    onFileChange(null, '')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="glass-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Form Pengajuan Cuti</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Isi data di bawah dan klik kirim</p>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
        >
          <X size={15} />
        </button>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        {/* Dates */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">Tanggal Mulai</label>
            <input
              required type="date"
              value={form.start_date}
              min={today}
              onChange={e => onChange({ ...form, start_date: e.target.value })}
              className="w-full px-3 py-2.5 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">Tanggal Selesai</label>
            <input
              required type="date"
              value={form.end_date}
              min={form.start_date}
              onChange={e => onChange({ ...form, end_date: e.target.value })}
              className="w-full px-3 py-2.5 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        {/* Duration hint */}
        {form.start_date && form.end_date && form.end_date >= form.start_date && (
          <div className="flex items-center gap-2 text-xs text-primary font-medium">
            <CalendarRange size={13} />
            {dayCount(form.start_date, form.end_date)} hari cuti
          </div>
        )}

        {/* Reason */}
        <div>
          <label className="block text-xs font-medium text-foreground mb-1.5">Alasan</label>
          <textarea
            required rows={3}
            value={form.reason}
            onChange={e => onChange({ ...form, reason: e.target.value })}
            placeholder="Jelaskan alasan pengajuan cuti Anda..."
            className="w-full px-3 py-2.5 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          />
        </div>

        {/* File upload */}
        <div>
          <label className="block text-xs font-medium text-foreground mb-1.5">
            Surat Sakit / Bukti
            <span className="ml-1 text-muted-foreground font-normal">(opsional)</span>
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            onChange={handleFileChange}
            className="hidden"
            id="proof-upload"
          />
          {proofFile ? (
            <div className="flex items-center gap-3 px-4 py-3 border border-border rounded-xl bg-muted/30">
              {proofPreview ? (
                <img src={proofPreview} alt="Preview"
                  className="w-10 h-10 rounded-lg object-cover border border-border shrink-0" />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <FileText size={18} className="text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground truncate">{proofFile.name}</p>
                <p className="text-xs text-muted-foreground">{(proofFile.size / 1024).toFixed(0)} KB</p>
              </div>
              <button
                type="button" onClick={clearProof}
                className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <label
              htmlFor="proof-upload"
              className="flex items-center gap-4 px-4 py-4 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all group"
            >
              <div className="w-10 h-10 rounded-xl bg-muted group-hover:bg-primary/10 flex items-center justify-center shrink-0 transition-colors">
                <Upload size={16} className="text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Unggah surat sakit atau bukti</p>
                <p className="text-xs text-muted-foreground mt-0.5">JPG, PNG, PDF · Maks. 5 MB</p>
              </div>
            </label>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button
            type="button" onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors"
          >
            Batal
          </button>
          <button
            type="submit" disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors"
          >
            {saving ? 'Mengirim...' : 'Kirim Pengajuan'}
          </button>
        </div>
      </form>
    </div>
  )
}
