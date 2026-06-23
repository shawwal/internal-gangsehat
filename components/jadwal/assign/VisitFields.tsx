'use client'

interface Props {
  chiefComplaint: string
  setChiefComplaint: (v: string) => void
  notes: string
  setNotes: (v: string) => void
}

export function VisitFields({ chiefComplaint, setChiefComplaint, notes, setNotes }: Props) {
  return (
    <>
      {/* Chief complaint */}
      <div>
        <label className="block text-xs font-medium text-foreground mb-1.5">
          Keluhan Utama <span className="font-normal text-muted-foreground">(opsional)</span>
        </label>
        <input
          value={chiefComplaint}
          onChange={(e) => setChiefComplaint(e.target.value)}
          placeholder="Contoh: Nyeri punggung, sakit kepala..."
          className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-shadow"
        />
      </div>

      {/* Notes */}
      <div>
        <label className="block text-xs font-medium text-foreground mb-1.5">
          Catatan <span className="font-normal text-muted-foreground">(opsional)</span>
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Catatan tambahan..."
          className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-shadow resize-none"
        />
      </div>
    </>
  )
}
