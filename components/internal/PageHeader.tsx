'use client'

interface Props {
  title: string
  breadcrumb?: string
  actions?: React.ReactNode
}

export function PageHeader({ title, breadcrumb, actions }: Props) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        {breadcrumb && (
          <p className="text-sm text-gray-500 mb-0.5">{breadcrumb}</p>
        )}
        <h1 className="text-2xl font-semibold text-gray-900" style={{ fontFamily: 'Sora, sans-serif' }}>
          {title}
        </h1>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
