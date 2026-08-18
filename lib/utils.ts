export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ')
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount)
}

export function formatDate(date: string | Date): string {
  // Parse date-only strings as local time to avoid UTC offset shifting the day
  const d = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? new Date(date + 'T00:00:00')
    : new Date(date)
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d)
}

// Clinics operate in Asia/Jakarta — compute "today" in that timezone explicitly
// (not local machine time) so entries made late night/early morning WIB don't
// get silently saved under the wrong calendar day when toISOString() would
// shift across the UTC day boundary.
export function todayJakartaISO(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date())
}

export function formatWaNumber(phone: string): string {
  const clean = phone.replace(/\D/g, '')
  if (clean.startsWith('62')) return clean
  if (clean.startsWith('0')) return '62' + clean.slice(1)
  // No leading 0 or 62 (e.g. phone stored/typed without the leading 0) —
  // still needs the country code for wa.me links to resolve.
  return '62' + clean
}

export function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '')
}

export const DEFAULT_REMINDER_TEMPLATE =
  'KONFIRMASI PENDAFTARAN JADWAL FISIOTERAPI\n\nNama: {{nama}}\nTanggal: {{tanggal}}\nJam: {{jam}}\nOrder ID: {{order_id}}\n\nKami dari Fisioterapi Gang Sehat ingin mengingatkan jadwal terapi Anda pada {{tanggal}} pukul {{jam}} di {{cabang}}. Sampai jumpa!'

export const DEFAULT_ORDER_CONFIRMATION_TEMPLATE =
  'KONFIRMASI PENDAFTARAN JADWAL FISIOTERAPI\n\n* Nama: {{nama}}\n* Hari : {{hari}}\n* Tanggal: {{tanggal}}\n* Jam: {{jam}}\n* Order ID: {{order_id}}\nCatatan: admin akan mengingatkan kembali H-1 sebelum jadwal kunjungan anda'

const HARI_ID = ['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', "JUM'AT", 'SABTU']

export function formatHari(date: string | Date): string {
  const d = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? new Date(date + 'T00:00:00')
    : new Date(date)
  return HARI_ID[d.getDay()]
}
