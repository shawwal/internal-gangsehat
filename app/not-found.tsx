import Link from 'next/link'

export const metadata = { title: '404 — Halaman tidak ditemukan' }

export default function NotFound() {
  return (
    <main className="nf-root relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
      <style>{`
        @keyframes nfBlob { 0%,100% { transform: translate(0,0) scale(1) } 33% { transform: translate(40px,-30px) scale(1.1) } 66% { transform: translate(-30px,20px) scale(0.95) } }
        @keyframes nfFloat { 0%,100% { transform: translateY(0) rotate(-2deg) } 50% { transform: translateY(-18px) rotate(2deg) } }
        @keyframes nfIn { from { opacity: 0; transform: translateY(16px) } to { opacity: 1; transform: none } }
        @keyframes nfPulse { 0%,100% { transform: scale(1); opacity: .6 } 50% { transform: scale(1.4); opacity: 0 } }
        @keyframes nfSpin { to { transform: rotate(360deg) } }
        .nf-blob { animation: nfBlob 14s ease-in-out infinite }
        .nf-float { animation: nfFloat 5s ease-in-out infinite }
        .nf-in { opacity: 0; animation: nfIn .7s ease-out forwards }
        .nf-pulse { animation: nfPulse 2.4s ease-out infinite }
        .nf-spin { animation: nfSpin 20s linear infinite }
        @media (prefers-reduced-motion: reduce) {
          .nf-root *, .nf-root *::before { animation: none !important; opacity: 1 !important }
        }
      `}</style>

      <div className="nf-blob pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-[#FF0090]/30 blur-3xl" />
      <div className="nf-blob pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-[#FFB35C]/30 blur-3xl" style={{ animationDelay: '-7s' }} />

      <div className="glass-card relative z-10 w-full max-w-md p-8 text-center sm:p-10">
        <div className="nf-float relative mx-auto mb-6 flex h-40 items-center justify-center">
          <div className="nf-spin absolute h-36 w-36 rounded-full border-2 border-dashed border-[#FF0090]/40" />
          <span className="bg-gradient-to-br from-[#FF0090] to-[#FFB35C] bg-clip-text text-8xl font-bold tracking-tighter text-transparent">
            404
          </span>
          <span className="absolute right-10 top-4 flex h-3 w-3">
            <span className="nf-pulse absolute inline-flex h-full w-full rounded-full bg-[#FF0090]" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-[#FF0090]" />
          </span>
        </div>

        <h1 className="nf-in text-2xl font-semibold text-foreground" style={{ animationDelay: '.15s' }}>
          Halaman tidak ditemukan
        </h1>
        <p className="nf-in mt-2 text-sm text-muted-foreground" style={{ animationDelay: '.3s' }}>
          Halaman yang Anda cari tidak ada atau sudah dipindahkan.
        </p>

        <div className="nf-in mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center" style={{ animationDelay: '.45s' }}>
          <Link
            href="/dashboard"
            className="rounded-full bg-[#FF0090] px-6 py-2.5 text-sm font-medium text-white shadow-lg shadow-[#FF0090]/30 transition hover:scale-105 hover:bg-[#FF0090]/90"
          >
            Kembali ke Dashboard
          </Link>
          <Link
            href="/login"
            className="rounded-full border border-foreground/20 px-6 py-2.5 text-sm font-medium text-foreground transition hover:bg-foreground/5"
          >
            Login
          </Link>
        </div>
      </div>
    </main>
  )
}
