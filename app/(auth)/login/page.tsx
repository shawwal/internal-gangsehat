import { ThemeToggle } from '@/components/login/ThemeToggle'
import { BrandPanel } from '@/components/login/BrandPanel'
import { MobileLogo } from '@/components/login/MobileLogo'
import { LoginForm } from '@/components/login/LoginForm'

export const dynamic = 'force-dynamic'

export default function LoginPage() {
  return (
    <div className="min-h-screen flex bg-background relative overflow-hidden">
      <ThemeToggle />

      <BrandPanel />

      {/* Right / main form panel */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-10 lg:p-12 relative">
        {/* Mobile background blobs */}
        <div className="absolute inset-0 lg:hidden overflow-hidden pointer-events-none">
          <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-[#FF0090]/8 blur-3xl" />
          <div className="absolute -bottom-16 -left-16 w-64 h-64 rounded-full bg-[#FFB35C]/8 blur-3xl" />
        </div>

        <div className="w-full max-w-sm relative z-10">
          <MobileLogo />
          <LoginForm />
          <p className="text-center text-xs text-muted-foreground mt-5">
            © 2026 Gang Sehat. Semua hak dilindungi
          </p>
        </div>
      </div>
    </div>
  )
}
