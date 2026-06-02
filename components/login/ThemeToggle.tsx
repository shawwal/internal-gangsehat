'use client'

import { useEffect, useState } from 'react'
import { Sun, Moon } from 'lucide-react'

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('gs_theme')
    setIsDark(
      stored === 'dark' || document.documentElement.classList.contains('dark')
    )
  }, [])

  const toggle = () => {
    const next = !isDark
    setIsDark(next)
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('gs_theme', next ? 'dark' : 'light')
  }

  return (
    <button
      onClick={toggle}
      aria-label={isDark ? 'Ganti ke mode terang' : 'Ganti ke mode gelap'}
      className="fixed top-4 right-4 z-50 w-11 h-11 flex items-center justify-center rounded-2xl bg-card border border-border shadow-sm text-foreground hover:bg-muted transition-colors duration-200 cursor-pointer"
    >
      {isDark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  )
}
