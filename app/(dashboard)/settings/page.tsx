'use client'

import { useSettingsProfile }   from '@/components/settings/useSettingsProfile'
import { SettingsSection }      from '@/components/settings/SettingsSection'
import { ProfileCard }          from '@/components/settings/ProfileCard'
import { AccountInfoCard }      from '@/components/settings/AccountInfoCard'
import { PasswordCard }         from '@/components/settings/PasswordCard'
import { AppearanceCard }       from '@/components/settings/AppearanceCard'
import { SessionCard }          from '@/components/settings/SessionCard'

function SettingsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-6 w-32 bg-muted rounded-lg animate-pulse" />
        <div className="h-4 w-48 bg-muted rounded-lg animate-pulse" />
      </div>
      {/* Profile skeleton — full row */}
      <div className="h-52 bg-muted rounded-2xl animate-pulse" />
      {/* 2-col skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-48 bg-muted rounded-2xl animate-pulse" />
        ))}
      </div>
    </div>
  )
}

export default function SettingsPage() {
  const { profile, loading } = useSettingsProfile()

  if (loading) return <SettingsSkeleton />

  if (!profile) {
    return (
      <p className="text-sm text-muted-foreground">
        Gagal memuat profil. Silakan muat ulang halaman.
      </p>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-foreground">Pengaturan</h1>
        <p className="text-sm text-muted-foreground">Kelola profil dan akun Anda</p>
      </div>

      {/* Profile — full width on all breakpoints */}
      <SettingsSection
        title="Profil"
        description="Foto, nama, dan nomor telepon Anda"
      >
        <ProfileCard initialData={profile} />
      </SettingsSection>

      {/* 2-column grid on desktop, stacked on mobile/tablet */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SettingsSection
          title="Informasi Akun"
          description="Detail akun yang tidak dapat diubah"
        >
          <AccountInfoCard initialData={profile} />
        </SettingsSection>

        <SettingsSection
          title="Ubah Kata Sandi"
          description="Gunakan minimal 6 karakter"
        >
          <PasswordCard />
        </SettingsSection>

        <SettingsSection
          title="Tampilan"
          description="Sesuaikan tema aplikasi"
        >
          <AppearanceCard />
        </SettingsSection>

        <SettingsSection
          title="Sesi"
          description="Kelola sesi login Anda"
        >
          <SessionCard />
        </SettingsSection>
      </div>
    </div>
  )
}
