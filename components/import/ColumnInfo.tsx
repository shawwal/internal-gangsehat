import { Info } from 'lucide-react'

export function ColumnInfo() {
  return (
    <details className="text-xs">
      <summary className="cursor-pointer flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors select-none">
        <Info size={12} /> Kolom yang dikenali
      </summary>
      <div className="mt-2 p-3 bg-muted/50 rounded-xl text-muted-foreground leading-relaxed">
        <p className="font-medium text-foreground mb-1">Header Excel yang dikenali (tidak case-sensitif):</p>
        <ul className="grid grid-cols-2 gap-x-4 gap-y-0.5">
          <li><span className="font-mono">NO.RM / No. RM</span> — No. Rekam Medis</li>
          <li><span className="font-mono">NAMA / Nama Pasien</span> — Nama <span className="text-primary">*</span></li>
          <li><span className="font-mono">NO. HP / No. HP/WhatsApp / No. WA</span> — Telepon <span className="text-primary">*</span></li>
          <li><span className="font-mono">ALAMAT</span> — Alamat</li>
          <li><span className="font-mono">TGL LAHIR / Tanggal Lahir</span> — Tgl. Lahir</li>
          <li><span className="font-mono">JK / Jenis Kelamin</span> — Gender</li>
          <li><span className="font-mono">PEKERJAAN</span> — Pekerjaan</li>
          <li><span className="font-mono">AGAMA</span> — Agama</li>
          <li><span className="font-mono">HOBI / Hobi/Aktivitas Sehari-hari</span> — Hobi</li>
          <li><span className="font-mono">KELURAHAN / Kelurahan/Desa</span> — Kelurahan</li>
          <li><span className="font-mono">KECAMATAN</span> — Kecamatan</li>
          <li><span className="font-mono">KAB/KOTA / Kabupaten/Kota</span> — Kab./Kota</li>
          <li><span className="font-mono">PROVINSI</span> — Provinsi</li>
        </ul>
        <p className="mt-1.5 text-primary/80"><span className="text-primary">*</span> Wajib ada. Baris tanpa Nama atau No. HP akan dilewati.</p>
      </div>
    </details>
  )
}
