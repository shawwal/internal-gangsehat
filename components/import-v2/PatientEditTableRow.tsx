import { useMemo } from 'react'
import { Trash2 } from 'lucide-react'
import { RegionSelect } from '@/components/ui/RegionSelect'
import {
  PROVINSI,
  KABUPATEN_KOTA,
  getKabupatenByProvinsi,
  getKecamatanByKabupaten,
} from '@/lib/indonesia-regions'
import type { EditableRow } from './types'

const AGAMA_OPTIONS = ['ISLAM', 'KRISTEN PROTESTAN', 'KRISTEN KATOLIK', 'HINDU', 'BUDHA', 'KONGHUCU', 'LAINNYA']
const PROVINSI_NAMES = PROVINSI.map((p) => p.nama)

const cellCls = 'px-2 py-2 align-top'
const inputCls =
  'w-full min-w-[9rem] px-2 py-1.5 rounded-lg border border-border bg-background text-xs ' +
  'focus:outline-none focus:ring-2 focus:ring-primary/40'

interface Props {
  row: EditableRow
  onChange: (tempId: string, patch: Partial<EditableRow>) => void
  onRemove: (tempId: string) => void
}

export function PatientEditTableRow({ row, onChange, onRemove }: Props) {
  const set = <K extends keyof EditableRow>(k: K, v: EditableRow[K]) => onChange(row.tempId, { [k]: v } as Partial<EditableRow>)

  const selectedProvinsiKode = useMemo(
    () => PROVINSI.find((p) => p.nama === row.provinsi)?.kode ?? null,
    [row.provinsi],
  )

  const kabupatenOptions = useMemo(
    () => (selectedProvinsiKode ? getKabupatenByProvinsi(selectedProvinsiKode).map((k) => k.nama) : []),
    [selectedProvinsiKode],
  )

  const selectedKabupatenKode = useMemo(
    () => KABUPATEN_KOTA.find((k) => k.provinsi_kode === selectedProvinsiKode && k.nama === row.kabupatenKota)?.kode ?? null,
    [selectedProvinsiKode, row.kabupatenKota],
  )

  const kecamatanOptions = useMemo(
    () => (selectedKabupatenKode ? getKecamatanByKabupaten(selectedKabupatenKode).map((k) => k.nama) : []),
    [selectedKabupatenKode],
  )

  function handleProvinsiChange(v: string) {
    onChange(row.tempId, { provinsi: v, kabupatenKota: '', kecamatan: '' })
  }

  function handleKabupatenChange(v: string) {
    onChange(row.tempId, { kabupatenKota: v, kecamatan: '' })
  }

  const rowTone = row.duplicateInDb
    ? 'bg-secondary/10'
    : !row.include
    ? 'bg-muted/40 opacity-60'
    : ''

  return (
    <tr className={`border-b border-border/50 ${rowTone}`}>
      <td className={cellCls}>
        <input
          type="checkbox"
          checked={row.include}
          onChange={(e) => set('include', e.target.checked)}
          className="w-4 h-4 accent-primary cursor-pointer"
        />
      </td>
      <td className={cellCls}>
        <span className="text-xs text-muted-foreground">{row.sourceRow}</span>
      </td>
      <td className={cellCls}>
        {row.duplicateInDb && (
          <span className="block mb-1 text-[10px] font-medium text-secondary-foreground bg-secondary/30 rounded-full px-1.5 py-0.5 w-fit">
            Sudah ada
          </span>
        )}
        {row.no_rm_cleared && (
          <span className="block mb-1 text-[10px] font-medium text-destructive bg-destructive/10 rounded-full px-1.5 py-0.5 w-fit">
            No. RM bentrok — dikosongkan
          </span>
        )}
        <input
          value={row.no_rm ?? ''}
          onChange={(e) => set('no_rm', e.target.value || null)}
          className={inputCls}
          placeholder="No. RM"
        />
      </td>
      <td className={cellCls}>
        <input value={row.name} onChange={(e) => set('name', e.target.value)} className={inputCls} />
      </td>
      <td className={cellCls}>
        <input value={row.phone} onChange={(e) => set('phone', e.target.value)} className={inputCls} />
      </td>
      <td className={cellCls}>
        <select value={row.gender} onChange={(e) => set('gender', e.target.value as EditableRow['gender'])} className={inputCls + ' cursor-pointer'}>
          <option value="male">Laki-laki</option>
          <option value="female">Perempuan</option>
          <option value="other">Lainnya</option>
        </select>
      </td>
      <td className={cellCls}>
        <input type="date" value={row.birthDate} onChange={(e) => set('birthDate', e.target.value)} className={inputCls} />
      </td>
      <td className={cellCls}>
        <input value={row.address} onChange={(e) => set('address', e.target.value)} className={inputCls} />
      </td>
      <td className={cellCls}>
        {!row.locationMatch.provinsi && row.provinsi && (
          <span className="block mb-1 text-[10px] font-medium text-destructive">tidak cocok persis</span>
        )}
        <RegionSelect options={PROVINSI_NAMES} value={row.provinsi} onChange={handleProvinsiChange} placeholder="Provinsi..." />
      </td>
      <td className={cellCls}>
        {!row.locationMatch.kabupatenKota && row.kabupatenKota && (
          <span className="block mb-1 text-[10px] font-medium text-destructive">tidak cocok persis</span>
        )}
        <RegionSelect
          options={kabupatenOptions}
          value={row.kabupatenKota}
          onChange={handleKabupatenChange}
          placeholder={row.provinsi ? 'Kab/kota...' : 'Pilih provinsi dulu'}
          disabled={!row.provinsi}
        />
      </td>
      <td className={cellCls}>
        {!row.locationMatch.kecamatan && row.kecamatan && (
          <span className="block mb-1 text-[10px] font-medium text-destructive">tidak cocok persis</span>
        )}
        <RegionSelect
          options={kecamatanOptions}
          value={row.kecamatan}
          onChange={(v) => set('kecamatan', v)}
          placeholder={row.kabupatenKota ? 'Kecamatan...' : 'Pilih kab/kota dulu'}
          disabled={!row.kabupatenKota}
        />
      </td>
      <td className={cellCls}>
        <input value={row.kelurahan} onChange={(e) => set('kelurahan', e.target.value)} className={inputCls} />
      </td>
      <td className={cellCls}>
        <select value={row.agama} onChange={(e) => set('agama', e.target.value)} className={inputCls + ' cursor-pointer'}>
          <option value="">-</option>
          {AGAMA_OPTIONS.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </td>
      <td className={cellCls}>
        <input value={row.pekerjaan} onChange={(e) => set('pekerjaan', e.target.value)} className={inputCls} />
      </td>
      <td className={cellCls}>
        <input value={row.hobi} onChange={(e) => set('hobi', e.target.value)} className={inputCls} />
      </td>
      <td className={cellCls}>
        <input value={row.keluhan} onChange={(e) => set('keluhan', e.target.value)} className={inputCls} />
      </td>
      <td className={cellCls}>
        <button
          type="button"
          onClick={() => onRemove(row.tempId)}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          aria-label="Hapus baris"
        >
          <Trash2 size={13} />
        </button>
      </td>
    </tr>
  )
}
