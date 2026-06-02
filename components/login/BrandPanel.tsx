import Image from 'next/image'

const FEATURES = ['Multi-Cabang', 'Laporan Keuangan', 'Manajemen SDM', 'Marketing']

export function BrandPanel() {
  return (
    <div className="hidden lg:flex lg:w-1/2 relative flex-col items-center justify-center p-12 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-[#FF0090] via-[#ff3da5] to-[#FFB35C]" />

      <div className="absolute -top-16 -left-16 w-80 h-80 rounded-full bg-white/10 blur-3xl animate-float motion-reduce:animate-none" />
      <div
        className="absolute -bottom-10 -right-10 w-96 h-96 rounded-full bg-[#FFB35C]/25 blur-3xl animate-float motion-reduce:animate-none"
        style={{ animationDelay: '1.5s' }}
      />
      <div className="absolute top-1/3 left-1/2 w-56 h-56 rounded-full bg-white/5 blur-2xl" />

      <div className="relative z-10 text-center text-white max-w-xs">
        <div className="flex justify-center mb-10">
          <Image
            src="/white-logo.png"
            alt="Gang Sehat"
            width={200}
            height={58}
            style={{ height: 'auto' }}
            className="object-contain drop-shadow-lg"
            priority
          />
        </div>

        <h1 className="text-3xl font-bold leading-tight mb-4">
          Sistem Manajemen<br />Internal Klinik
        </h1>
        <p className="text-white/75 text-sm leading-relaxed">
          Platform terpadu untuk manajemen cabang, laporan keuangan, HR, dan pemasaran Gangsehat.
        </p>

        <div className="flex flex-wrap gap-2 justify-center mt-8">
          {FEATURES.map((f) => (
            <span
              key={f}
              className="px-3 py-1.5 rounded-full bg-white/15 backdrop-blur-sm text-white/90 text-xs font-medium border border-white/20"
            >
              {f}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
