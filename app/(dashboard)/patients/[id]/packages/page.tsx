'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ChevronLeft, Plus, Package, CheckCircle2, XCircle, Layers } from 'lucide-react'
import { StatCard }      from '@/components/packages/StatCard'
import { PackageCard }   from '@/components/packages/PackageCard'
import { PackageModal }  from '@/components/packages/PackageModal'
import { DeleteConfirm } from '@/components/packages/DeleteConfirm'
import { usePackages }   from '@/components/packages/usePackages'
import type { PatientPackage } from '@/components/packages/types'

export default function PatientPackagesPage() {
  const { id } = useParams() as { id: string }
  const { packages, patientName, noRm, branchId, loading, stats, load, handleDelete } = usePackages(id)

  const [showModal, setShowModal]     = useState(false)
  const [editTarget, setEditTarget]   = useState<PatientPackage | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  function openAdd() {
    setEditTarget(null)
    setShowModal(true)
  }

  function openEdit(pkg: PatientPackage) {
    setEditTarget(pkg)
    setShowModal(true)
  }

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link
            href={`/patients/${id}`}
            className="p-1.5 rounded-lg border border-border hover:bg-muted transition-colors text-muted-foreground"
          >
            <ChevronLeft size={16} />
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Paket Terapi</h1>
            <p className="text-sm text-muted-foreground">
              {patientName || '—'}
              {noRm && <span className="ml-2 font-mono text-xs text-muted-foreground/70">{noRm}</span>}
            </p>
          </div>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus size={16} /> Tambah Paket
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total Paket" value={stats.total}     icon={Layers}       color="bg-primary/10 text-primary"         loading={loading} />
        <StatCard label="Aktif"       value={stats.active}    icon={Package}      color="bg-[#34C759]/10 text-[#34C759]"     loading={loading} />
        <StatCard label="Selesai"     value={stats.completed} icon={CheckCircle2} color="bg-blue-500/10 text-blue-400"       loading={loading} />
        <StatCard label="Dibatalkan"  value={stats.cancelled} icon={XCircle}      color="bg-destructive/10 text-destructive" loading={loading} />
      </div>

      {/* Package list */}
      {loading ? (
        <div className="grid sm:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="glass-card p-5 space-y-3 animate-pulse">
              <div className="h-4 bg-muted rounded-lg w-1/2" />
              <div className="h-2 bg-muted rounded-full" />
              <div className="h-3 bg-muted rounded-lg w-1/3" />
            </div>
          ))}
        </div>
      ) : packages.length === 0 ? (
        <div className="glass-card p-12 flex flex-col items-center gap-3 text-center">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Package size={26} className="text-primary" />
          </div>
          <p className="text-sm font-medium text-foreground">Belum ada paket terapi</p>
          <p className="text-xs text-muted-foreground">Tekan "Tambah Paket" untuk menambahkan paket baru</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {packages.map((pkg) => (
            <PackageCard
              key={pkg.id}
              pkg={pkg}
              onEdit={openEdit}
              onDelete={(pkgId) => setDeleteTarget(pkgId)}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {showModal && (
        <PackageModal
          editTarget={editTarget}
          branchId={branchId}
          patientId={id}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load() }}
        />
      )}

      {deleteTarget && (
        <DeleteConfirm
          onConfirm={() => { handleDelete(deleteTarget); setDeleteTarget(null) }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
