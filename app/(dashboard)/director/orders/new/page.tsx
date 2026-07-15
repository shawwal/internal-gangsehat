'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { useCreateOrderForm } from '@/components/order/useCreateOrderForm'
import { OrderPatientSection } from '@/components/order/OrderPatientSection'
import { OrderBranchSelect } from '@/components/order/OrderBranchSelect'
import { OrderServiceSection } from '@/components/order/OrderServiceSection'
import { OrderSessionsSection } from '@/components/order/OrderSessionsSection'
import { OrderFormActions } from '@/components/order/OrderFormActions'

export default function NewDirectorOrderPage() {
  const router = useRouter()

  const {
    form, errors, branches, layananOptions, therapists, loadingLayanan,
    saving, submitError, discountAmount, totalAfterDiscount, hargaNum, dpNum,
    field, selectLayanan, selectBranch, selectPatient,
    generateSessions, addSessionRow, removeSessionRow, updateSessionRow, submit,
  } = useCreateOrderForm({ isDirector: true, initialBranchId: null })

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push('/director/orders')}
          className="p-2 rounded-xl border border-border hover:bg-muted text-muted-foreground transition-colors cursor-pointer"
          aria-label="Kembali"
        >
          <ArrowLeft size={16} />
        </button>
        <div>
          <p className="text-xs text-muted-foreground">Order &gt; Tambah</p>
          <h1 className="text-lg font-semibold text-foreground">Tambah Order</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <OrderPatientSection patient={form.patient} error={errors.patient} onSelect={selectPatient} />

          <OrderBranchSelect
            branches={branches}
            branchId={form.branchId}
            onChange={selectBranch}
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

        <div className="lg:col-span-1">
          <div className="lg:sticky lg:top-4">
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
          </div>
        </div>
      </div>

      <OrderFormActions
        saving={saving}
        submitError={submitError}
        onCancel={() => router.push('/director/orders')}
        onSubmit={submit}
      />
    </div>
  )
}
