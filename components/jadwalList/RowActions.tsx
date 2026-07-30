'use client'

import { useState } from 'react'
import { FaWhatsapp } from 'react-icons/fa'
import { ConfirmDialog } from '@/components/leave/ConfirmDialog'
import type { JadwalListRow } from './types'

interface Props {
  row: JadwalListRow
  onRemind: (row: JadwalListRow) => void
  onCancel: (row: JadwalListRow) => void | Promise<void>
}

export function RowActions({ row, onRemind, onCancel }: Props) {
  const [confirming, setConfirming] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const hasPhone = !!row.patient_phone

  async function handleConfirmCancel() {
    setCancelling(true)
    try {
      await onCancel(row)
    } finally {
      setCancelling(false)
      setConfirming(false)
    }
  }

  return (
    <>
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onRemind(row)}
          disabled={!hasPhone}
          title="Ingatkan pasien via WhatsApp"
          className="w-8 h-8 flex items-center justify-center rounded-full bg-[#34C759]/15 text-[#34C759] hover:bg-[#34C759]/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          <FaWhatsapp size={14} />
        </button>
        <button
          onClick={() => setConfirming(true)}
          disabled={!hasPhone}
          title="Batalkan & beri tahu pasien"
          className="w-8 h-8 flex items-center justify-center rounded-full bg-destructive/15 text-destructive hover:bg-destructive/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          <FaWhatsapp size={14} />
        </button>
      </div>

      {confirming && (
        <ConfirmDialog
          title="Batalkan Kunjungan"
          description={`Batalkan jadwal ${row.patient_name} pada ${row.visit_date}${row.visit_time ? ` pukul ${row.visit_time}` : ''}? Pasien akan diberi tahu via WhatsApp.`}
          confirmLabel="Batalkan"
          danger
          loading={cancelling}
          onConfirm={handleConfirmCancel}
          onCancel={() => setConfirming(false)}
        />
      )}
    </>
  )
}
