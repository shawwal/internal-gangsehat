import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'TeamFGS Internal System',
  description: 'Fisioterapi Internal Management System',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className="h-full" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem('teamfgs_theme');if(t==='dark')document.documentElement.classList.add('dark')})()`,
          }}
        />
      </head>
      <body className="h-full">{children}</body>
    </html>
  )
}
