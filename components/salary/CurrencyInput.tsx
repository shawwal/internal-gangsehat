'use client'

import { useState, useRef } from 'react'
import { formatIDR, toHumanIDR } from './types'

interface Props {
  value: number
  onChange: (v: number) => void
  /** Extra classes applied to the <input> */
  inputClassName?: string
  min?: number
}

/**
 * A right-aligned currency input for IDR amounts.
 *
 * • Not focused  → shows dot-separated number  "10.000.000"
 * • Focused      → shows raw digits for easy editing  "10000000"
 * • Below input  → always-present human label row  "10 juta"
 *                  (takes up space even when empty to prevent layout shift)
 */
export function CurrencyInput({ value, onChange, inputClassName = '', min = 0 }: Props) {
  const [focused, setFocused] = useState(false)
  const ref = useRef<HTMLInputElement>(null)

  const displayValue = focused
    ? (value === 0 ? '' : String(value))
    : formatIDR(value)

  function handleFocus() {
    setFocused(true)
    setTimeout(() => ref.current?.select(), 0)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    // Strip everything that isn't a digit
    const digits = e.target.value.replace(/\D/g, '')
    const num = parseInt(digits) || 0
    onChange(Math.max(min, num))
  }

  function handleBlur() {
    setFocused(false)
  }

  const human = toHumanIDR(value)

  return (
    <div>
      <input
        ref={ref}
        type="text"
        inputMode="numeric"
        value={displayValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className={`w-full text-right px-2.5 py-1.5 border border-border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring font-mono tracking-wide ${inputClassName}`}
      />
      {/* Fixed-height hint row — always rendered to prevent layout shift */}
      <p className="h-[14px] mt-0.5 text-[10px] text-right text-muted-foreground/70 leading-none pr-0.5 select-none">
        {!focused && human ? human : ''}
      </p>
    </div>
  )
}
