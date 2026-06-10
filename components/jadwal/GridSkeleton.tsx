export function GridSkeleton() {
  return (
    <div className="animate-pulse">
      {/* Header */}
      <div
        className="flex border-b border-white/10 p-4 gap-4"
        style={{ background: 'linear-gradient(135deg, #3B0764 0%, #6D28D9 50%, #FF0090 100%)' }}
      >
        <div className="w-[72px] shrink-0" />
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="w-[176px] shrink-0 flex flex-col items-center gap-2 py-2">
            <div className="w-11 h-11 rounded-full bg-white/20" />
            <div className="h-3 w-24 rounded bg-white/20" />
            <div className="h-2 w-16 rounded bg-white/10" />
          </div>
        ))}
      </div>
      {/* Body rows */}
      {[1, 2, 3, 4, 5, 6].map((r) => (
        <div key={r} className="flex border-b border-border/10" style={{ height: 80 }}>
          <div className="w-[72px] shrink-0 flex items-start justify-end pr-3 pt-2">
            <div className="h-2.5 w-10 rounded bg-white/5" />
          </div>
          {[1, 2, 3, 4].map((c) => (
            <div key={c} className="w-[176px] shrink-0 border-l border-border/10 p-1">
              {r === 2 && c === 1 && <div className="h-14 rounded-lg bg-[#34C759]/10" />}
              {r === 3 && c === 3 && <div className="h-14 rounded-lg bg-blue-500/10" />}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
