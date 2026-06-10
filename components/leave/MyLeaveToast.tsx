import { CheckCircle2, XCircle } from 'lucide-react'

interface Props {
  toast: { msg: string; ok: boolean } | null
}

export function MyLeaveToast({ toast }: Props) {
  if (!toast) return null
  return (
    <div className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl text-sm font-medium ${
      toast.ok
        ? 'bg-chart-4/10 text-chart-4 border border-chart-4/20'
        : 'bg-destructive/10 text-destructive border border-destructive/20'
    }`}>
      {toast.ok ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
      {toast.msg}
    </div>
  )
}
