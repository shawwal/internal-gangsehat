interface SelectProps {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}

export function Select({ value, onChange, options }: SelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="border border-border rounded-xl px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer transition-colors hover:border-primary/50"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}
