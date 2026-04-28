'use client'

import { useEffect, useState } from 'react'
import { Plus, Megaphone } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Campaign, CampaignChannel, CampaignStatus } from '@/types'

const CHANNEL_LABELS: Record<CampaignChannel, string> = {
  social_media: 'Media Sosial', whatsapp: 'WhatsApp', email: 'Email', flyer: 'Flyer', other: 'Lainnya',
}

const STATUS_BADGE: Record<CampaignStatus, string> = {
  draft:     'bg-muted text-muted-foreground',
  active:    'bg-chart-4/15 text-chart-4',
  completed: 'bg-chart-5/15 text-chart-5',
  cancelled: 'bg-destructive/10 text-destructive',
}

const STATUS_FLOW: Record<CampaignStatus, CampaignStatus | null> = {
  draft: 'active', active: 'completed', completed: null, cancelled: null,
}

function formatRp(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
}

const CHANNELS: CampaignChannel[] = ['social_media', 'whatsapp', 'email', 'flyer', 'other']

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [editItem, setEditItem]   = useState<Campaign | null>(null)
  const [form, setForm]           = useState({
    title: '', description: '', channel: 'social_media' as CampaignChannel,
    start_date: '', end_date: '', budget: '', target_reach: '',
  })
  const [saving, setSaving] = useState(false)

  async function load() {
    const { data } = await createClient()
      .from('campaigns')
      .select('*')
      .order('created_at', { ascending: false })
    setCampaigns((data ?? []) as Campaign[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openNew() {
    setEditItem(null)
    setForm({ title: '', description: '', channel: 'social_media', start_date: '', end_date: '', budget: '', target_reach: '' })
    setShowForm(true)
  }

  function openEdit(c: Campaign) {
    setEditItem(c)
    setForm({
      title: c.title, description: c.description ?? '', channel: c.channel ?? 'social_media',
      start_date: c.start_date ?? '', end_date: c.end_date ?? '',
      budget: String(c.budget), target_reach: String(c.target_reach ?? ''),
    })
    setShowForm(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const payload = {
      title: form.title, description: form.description || null,
      channel: form.channel, start_date: form.start_date || null, end_date: form.end_date || null,
      budget: Number(form.budget) || 0, target_reach: Number(form.target_reach) || null,
    }
    if (editItem) {
      await createClient().from('campaigns').update(payload).eq('id', editItem.id)
    } else {
      await createClient().from('campaigns').insert({ ...payload, status: 'draft' })
    }
    setSaving(false)
    setShowForm(false)
    load()
  }

  async function advance(c: Campaign) {
    const next = STATUS_FLOW[c.status]
    if (!next) return
    await createClient().from('campaigns').update({ status: next }).eq('id', c.id)
    load()
  }

  async function cancel(id: string) {
    await createClient().from('campaigns').update({ status: 'cancelled' }).eq('id', id)
    load()
  }

  const totals = campaigns.reduce((acc, c) => ({
    count: acc.count + 1,
    budget: acc.budget + c.budget,
    spend: acc.spend + c.actual_spend,
  }), { count: 0, budget: 0, spend: 0 })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Kampanye</h1>
          <p className="text-sm text-muted-foreground">Kelola kampanye marketing cabang</p>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
          <Plus size={16} /> Kampanye Baru
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Kampanye', value: totals.count },
          { label: 'Total Anggaran', value: formatRp(totals.budget) },
          { label: 'Total Pengeluaran', value: formatRp(totals.spend) },
        ].map((s) => (
          <div key={s.label} className="bg-card rounded-2xl border border-border p-4">
            <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
            <p className="text-lg font-semibold text-foreground">{s.value}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Memuat...</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((c) => (
            <div key={c.id} className="bg-card rounded-2xl border border-border p-5 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Megaphone size={14} className="text-primary" />
                  </div>
                  <p className="text-sm font-semibold text-foreground leading-tight">{c.title}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize shrink-0 ${STATUS_BADGE[c.status]}`}>
                  {c.status}
                </span>
              </div>

              {c.description && <p className="text-xs text-muted-foreground">{c.description}</p>}

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-muted-foreground">Channel</p>
                  <p className="font-medium text-foreground">{c.channel ? CHANNEL_LABELS[c.channel] : '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Anggaran</p>
                  <p className="font-medium text-foreground">{formatRp(c.budget)}</p>
                </div>
                {c.start_date && (
                  <div>
                    <p className="text-muted-foreground">Mulai</p>
                    <p className="font-medium text-foreground">{c.start_date}</p>
                  </div>
                )}
                {c.end_date && (
                  <div>
                    <p className="text-muted-foreground">Selesai</p>
                    <p className="font-medium text-foreground">{c.end_date}</p>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button onClick={() => openEdit(c)} className="flex-1 py-1.5 rounded-xl border border-border text-xs font-medium hover:bg-muted transition-colors">
                  Edit
                </button>
                {STATUS_FLOW[c.status] && (
                  <button onClick={() => advance(c)} className="flex-1 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors">
                    {c.status === 'draft' ? 'Aktifkan' : 'Selesaikan'}
                  </button>
                )}
                {c.status === 'active' && (
                  <button onClick={() => cancel(c.id)} className="py-1.5 px-3 rounded-xl border border-destructive/30 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors">
                    Batalkan
                  </button>
                )}
              </div>
            </div>
          ))}
          {!campaigns.length && (
            <p className="text-sm text-muted-foreground col-span-3 text-center py-8">Belum ada kampanye.</p>
          )}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-sm max-h-[90vh] overflow-y-auto">
            <h2 className="text-base font-semibold text-foreground mb-4">
              {editItem ? 'Edit Kampanye' : 'Kampanye Baru'}
            </h2>
            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Judul</label>
                <input required value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Deskripsi</label>
                <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2}
                  className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary resize-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Channel</label>
                <select value={form.channel} onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value as CampaignChannel }))}
                  className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary">
                  {CHANNELS.map((c) => <option key={c} value={c}>{CHANNEL_LABELS[c]}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Tanggal Mulai</label>
                  <input type="date" value={form.start_date} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Tanggal Selesai</label>
                  <input type="date" value={form.end_date} onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Anggaran (Rp)</label>
                  <input type="number" min="0" value={form.budget} onChange={(e) => setForm((f) => ({ ...f, budget: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Target Jangkauan</label>
                  <input type="number" min="0" value={form.target_reach} onChange={(e) => setForm((f) => ({ ...f, target_reach: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">Batal</button>
                <button type="submit" disabled={saving} className="flex-1 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors">
                  {saving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
