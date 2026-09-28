import type { WaConfigAll, WaConfigSet } from '@/app/actions/reminder-template'

/** The WA templates + admin phone that apply to a branch: its override, else the global value. */
export function resolveWaConfig(all: WaConfigAll | null, branchId: string | null | undefined): WaConfigSet {
  if (!all) return { reminder: '', confirmation: '', phone: '' }
  const o = branchId ? all.byBranch[branchId] : undefined
  return {
    reminder: o?.reminder ?? all.global.reminder,
    confirmation: o?.confirmation ?? all.global.confirmation,
    phone: o?.phone ?? all.global.phone,
  }
}
