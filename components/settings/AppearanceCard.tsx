'use client'

import { useEffect, useState } from 'react'
import { Sun, Moon } from 'lucide-react'

export function AppearanceCard() {
  const [dark, setDark] = useState(false)

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'))
  }, [])

  function toggleTheme() {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('gs_theme', next ? 'dark' : 'light')
  }

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
          {dark ? <Moon size={15} /> : <Sun size={15} />}
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">
            {dark ? 'Mode Gelap' : 'Mode Terang'}
          </p>
          <p className="text-xs text-muted-foreground">
            {dark ? 'Tampilan gelap aktif' : 'Tampilan terang aktif'}
          </p>
        </div>
      </div>

      {/* Toggle switch — container: 44×24px, knob: 18×18px, 3px gap each side */}
      <button
        type="button"
        role="switch"
        aria-checked={dark}
        aria-label="Toggle tema gelap"
        onClick={toggleTheme}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
          dark ? 'bg-primary' : 'bg-muted'
        }`}
      >
        <span
          className={`absolute top-[3px] h-[18px] w-[18px] rounded-full bg-white shadow-md transition-all duration-200 ${
            dark ? 'left-[23px]' : 'left-[3px]'
          }`}
        />
      </button>
    </div>
  )
}
