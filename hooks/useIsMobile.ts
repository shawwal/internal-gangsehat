'use client'

import { useEffect, useState } from 'react'

/** True below Tailwind's `sm` breakpoint (640px) — for layouts sized in JS (grid column widths). */
export function useIsMobile(query = '(max-width: 639px)') {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const apply = () => setIsMobile(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [query])
  return isMobile
}
