import Link from 'next/link'
import { ShieldOff } from 'lucide-react'

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-4">
          <ShieldOff size={24} className="text-destructive" />
        </div>
        <h1 className="text-xl font-semibold text-foreground mb-2">Akses Ditolak</h1>
        <p className="text-sm text-muted-foreground mb-6">Anda tidak memiliki izin untuk mengakses halaman ini.</p>
        <Link href="/login" className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
          Kembali ke Login
        </Link>
      </div>
    </div>
  )
}
