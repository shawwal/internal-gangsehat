'use client'

import { useEffect, useState } from 'react'
import { Bell, BellOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { UserNotification } from '@/types'

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<UserNotification[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    const { data } = await createClient()
      .from('user_notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
    setNotifications((data ?? []) as UserNotification[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function markRead(id: string) {
    await createClient().from('user_notifications').update({ is_read: true }).eq('id', id)
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n))
  }

  async function markAllRead() {
    await createClient().from('user_notifications').update({ is_read: true }).eq('is_read', false)
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
  }

  const unread = notifications.filter((n) => !n.is_read).length

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1)  return 'baru saja'
    if (mins < 60) return `${mins} menit lalu`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs} jam lalu`
    const days = Math.floor(hrs / 24)
    return `${days} hari lalu`
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Notifikasi</h1>
          <p className="text-sm text-muted-foreground">{unread > 0 ? `${unread} belum dibaca` : 'Semua sudah dibaca'}</p>
        </div>
        {unread > 0 && (
          <button onClick={markAllRead}
            className="text-xs text-primary hover:text-primary/80 font-medium transition-colors">
            Tandai semua dibaca
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Memuat...</p>
      ) : !notifications.length ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <BellOff size={32} className="mb-3 opacity-40" />
          <p className="text-sm">Tidak ada notifikasi</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <button
              key={n.id}
              onClick={() => !n.is_read && markRead(n.id)}
              className={`w-full text-left bg-card rounded-2xl border p-4 transition-colors hover:bg-muted/40 ${
                n.is_read ? 'border-border opacity-70' : 'border-primary/30'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                  n.is_read ? 'bg-muted' : 'bg-primary/10'
                }`}>
                  <Bell size={14} className={n.is_read ? 'text-muted-foreground' : 'text-primary'} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-sm font-medium ${n.is_read ? 'text-muted-foreground' : 'text-foreground'}`}>
                      {n.title}
                    </p>
                    {!n.is_read && <span className="w-2 h-2 bg-primary rounded-full shrink-0" />}
                  </div>
                  {n.message && <p className="text-xs text-muted-foreground mt-0.5 truncate">{n.message}</p>}
                  <p className="text-xs text-muted-foreground mt-1">{timeAgo(n.created_at)}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
