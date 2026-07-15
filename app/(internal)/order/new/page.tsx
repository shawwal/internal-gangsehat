'use client'

import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/internal'
import { useProfile } from '@/hooks/useProfile'
import { useCreateOrderForm } from '@/components/order/useCreateOrderForm'
import { OrderPatientSection } from '@/components/order/OrderPatientSection'
import { OrderServiceSection } from '@/components/order/OrderServiceSection'
import { OrderSessionsSection } from '@/components/order/OrderSessionsSection'
import { OrderFormActions } from '@/components/order/OrderFormActions'

export default function NewOrderPage() {
  const router = useRouter()
  const profile = useProfile()
  const isAdmin = profile?.role !== 'therapist' && profile?.role !== 'staff'

  const {
    form, errors, layananOptions, therapists, loadingLayanan,
    saving, submitError, discountAmount, totalAfterDiscount, hargaNum, dpNum,
    field, selectLayanan, selectPatient,
    generateSessions, addSessionRow, removeSessionRow, updateSessionRow, submit,
  } = useCreateOrderForm({ isDirector: false, initialBranchId: profile?.branch_id ?? null })

  if (profile && !isAdmin) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        Anda tidak memiliki akses untuk membuat order.
        <br />
        <button onClick={() => router.push('/order')} className="mt-3 text-sm text-[var(--primary)] underline cursor-pointer">
          Kembali ke daftar order
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Tambah Order" breadcrumb="Order" />

      <div className="space-y-4 max-w-3xl">
        <OrderPatientSection patient={form.patient} error={errors.patient} onSelect={selectPatient} />

        <OrderServiceSection
          form={form}
          errors={errors}
          layananOptions={layananOptions}
          loadingLayanan={loadingLayanan}
          discountAmount={discountAmount}
          totalAfterDiscount={totalAfterDiscount}
          hargaNum={hargaNum}
          dpNum={dpNum}
          field={field}
          selectLayanan={selectLayanan}
        />

        <OrderSessionsSection
          form={form}
          errors={errors}
          therapists={therapists}
          field={field}
          generateSessions={generateSessions}
          addSessionRow={addSessionRow}
          removeSessionRow={removeSessionRow}
          updateSessionRow={updateSessionRow}
        />
      </div>

      <OrderFormActions
        saving={saving}
        submitError={submitError}
        onCancel={() => router.push('/order')}
        onSubmit={submit}
      />
    </div>
  )
}
