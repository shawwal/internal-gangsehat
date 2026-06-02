interface Props {
  name: string
  size?: 'sm' | 'md' | 'lg'
}

export function UserAvatar({ name, size = 'md' }: Props) {
  const initials = name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase() || '?'
  const cls = size === 'lg' ? 'w-12 h-12 text-sm' : size === 'sm' ? 'w-7 h-7 text-xs' : 'w-9 h-9 text-xs'
  return (
    <div className={`${cls} rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0`}>
      {initials}
    </div>
  )
}
