import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'TeamFGS Internal System',
  description: 'Fisioterapi Internal Management System',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className="h-full">
      <body className="h-full">{children}</body>
    </html>
  )
}
