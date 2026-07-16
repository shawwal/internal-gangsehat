'use client'

interface Props {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  minLabel?: string
  maxLabel?: string
  gradient?: boolean
  disabled?: boolean
}

export function RangeSlider({
  value, onChange, min = 0, max = 10, step = 1, minLabel, maxLabel, gradient = false, disabled = false,
}: Props) {
  return (
    <div>
      <div className="flex items-center justify-center mb-2">
        <span className="flex items-center justify-center w-11 h-11 rounded-2xl bg-primary text-primary-foreground text-lg font-bold">
          {value}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`range-slider ${gradient ? 'range-slider--pain-gradient' : ''}`}
      />
      {(minLabel || maxLabel) && (
        <div className="flex items-center justify-between mt-1.5 text-[11px] text-muted-foreground">
          <span>{minLabel}</span>
          <span>{maxLabel}</span>
        </div>
      )}
    </div>
  )
}
