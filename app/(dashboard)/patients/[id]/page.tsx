import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ChevronLeft, ClipboardList } from 'lucide-react'
import type { Patient } from '@/types'

export const dynamic = 'force-dynamic'

export default async function PatientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: patient } = await supabase
    .from('patients')
    .select('*')
    .eq('id', id)
    .single()

  if (!patient) notFound()

  const p = patient as Patient

  const { data: visits } = await supabase
    .from('patient_visits')
    .select('*')
    .eq('patient_id', id)
    .order('visit_date', { ascending: false })
    .limit(20)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/patients" className="p-1.5 rounded-lg border border-border hover:bg-muted transition-colors text-muted-foreground">
          <ChevronLeft size={16} />
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-foreground">{p.full_name}</h1>
          {p.medical_record_number && (
            <p className="text-sm text-muted-foreground">MRN: {p.medical_record_number}</p>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="bg-card rounded-2xl border border-border p-5">
          <h2 className="text-sm font-semibold text-foreground mb-3">Informasi Pasien</h2>
          <dl className="space-y-2 text-sm">
            {[
              ['Tanggal Lahir', p.date_of_birth ?? '—'],
              ['Jenis Kelamin', p.gender === 'male' ? 'Laki-laki' : p.gender === 'female' ? 'Perempuan' : p.gender ?? '—'],
              ['Telepon', p.phone ?? '—'],
              ['Email', p.email ?? '—'],
              ['Alamat', p.address ?? '—'],
            ].map(([label, value]) => (
              <div key={label} className="flex gap-2">
                <dt className="w-28 text-muted-foreground shrink-0">{label}</dt>
                <dd className="text-foreground">{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="bg-card rounded-2xl border border-border p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground">Riwayat Kunjungan</h2>
            <Link href={`/patients/${id}/visits`}
              className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium transition-colors">
              <ClipboardList size={12} /> Lihat Semua
            </Link>
          </div>
          {!visits?.length ? (
            <p className="text-sm text-muted-foreground">Belum ada kunjungan.</p>
          ) : (
            <div className="space-y-2">
              {visits.slice(0, 5).map((v) => (
                <div key={v.id} className="flex items-start justify-between py-2 border-b border-border last:border-0">
                  <div>
                    <p className="text-sm text-foreground">{v.visit_date}</p>
                    {v.chief_complaint && <p className="text-xs text-muted-foreground truncate max-w-[180px]">{v.chief_complaint}</p>}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
                    v.status === 'completed' ? 'bg-chart-4/15 text-chart-4'
                    : v.status === 'cancelled' ? 'bg-destructive/10 text-destructive'
                    : 'bg-secondary/20 text-secondary-foreground'
                  }`}>
                    {v.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
