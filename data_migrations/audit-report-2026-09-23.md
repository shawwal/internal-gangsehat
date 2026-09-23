# Package data audit — 2026-09-23

Read-only audit of 875 PAKET orders against 1032 patient_packages rows.

| Category | Count |
|---|---|
| Orphan visit rows | 0 |
| Missing sessions | 0 |
| Status mismatches (unexplained) | 9 |
| Status changes explained by the 2026-08-10 active-guard migration | 29 |
| Orphaned orders (no matching package) | 39 |
| Unverifiable packages (no kode note) | 195 |
| Duplicate kode notes (>1 package per order) | 1 |

## 1. Orphan visit rows

DB rows created in the original migration batch window that match no session in the source order.

None found.

## 2. Missing sessions

Source sessions with no matching visit row in the DB.

None found.

## 3. Status mismatches

Legacy STATUS vs current patient_packages.status (mapping: Booking/Proses→active, Stop→stopped, Selesai/Evaluasi→completed). Excludes rows explained by the 2026-08-10 active-guard migration (listed separately below) — those are an intentional data-integrity fix, not a bug.

| Kode | Pasien | Legacy STATUS | DB status | Expected |
|---|---|---|---|---|
| TRX/2026/07/0203 | DWI SANTOSO | Selesai | active | completed |
| TRX/2026/07/0180 | ALDI MAULADI RASYID | Selesai | active | completed |
| TRX/2026/07/0172 | AFIF RIZKY AFRIZA | Proses | completed | active |
| TRX/2026/07/0140 | ANDANG FIRMANSYAH | Selesai | active | completed |
| TRX/2026/07/0122 | NURHASANAH S.AG | Selesai | active | completed |
| TRX/2026/07/0111 | J. MUJIARSO | Selesai | active | completed |
| TRX/2026/07/0095 | PUJI ASTUTI | Selesai | active | completed |
| TRX/2026/07/0083 | AZARYA JADAYN ARYO | Selesai | active | completed |
| TRX/2026/07/0042 | SANTI | Selesai | active | completed |

### 3a. Explained by the 2026-08-10 active-guard migration

`supabase/054-package-stop-and-active-guard.sql` force-stopped every non-newest active package per patient, in one UPDATE — a real, intentional data-integrity fix (patients previously could end up with multiple simultaneously "active" packages). These read as mismatches against the frozen legacy STATUS, but are correct as-is.

| Kode | Pasien | Legacy STATUS | DB status |
|---|---|---|---|
| TRX/2026/07/0190 | SURACHMAD DARUSMAN | Selesai | stopped |
| TRX/2026/07/0178 | SYARIF ABDUURAHMAN ALQADRIE | Proses | stopped |
| TRX/2026/07/0175 | MITHA NOVIANTI | Proses | stopped |
| TRX/2026/07/0086 | ANDI WIRA UTAMA | Proses | stopped |
| TRX/2026/06/0393 | SUYATNO | Proses | stopped |
| TRX/2026/06/0265 | HARDJONO | Proses | stopped |
| TRX/2026/06/0259 | TJANG KHENG | Proses | stopped |
| TRX/2026/06/0257 | SINAH | Proses | stopped |
| TRX/2026/06/0252 | ASEP SETIAWAN | Proses | stopped |
| TRX/2026/06/0234 | SHAFA ANNISA | Proses | stopped |
| TRX/2026/06/0169 | NOVITA ADI HANDAYANI | Proses | stopped |
| TRX/2026/06/0152 | NISAH | Proses | stopped |
| TRX/2026/06/0116 | IPAH SIDA , S.E. | Proses | stopped |
| TRX/2026/06/0045 | RICKY ISKANDAR | Proses | stopped |
| TRX/2026/06/0044 | SALLY ISKANDAR TAN | Proses | stopped |
| TRX/2026/05/0388 | SEKAR KINANTI HERPRADANTI | Proses | stopped |
| TRX/2026/05/0379 | WAHONO | Proses | stopped |
| TRX/2026/05/0367 | DIVO | Proses | stopped |
| TRX/2026/05/0355 | WILLSON LOUISSE HANSEN VILLERY | Proses | stopped |
| TRX/2026/05/0313 | SOBIB | Proses | stopped |
| TRX/2026/05/0244 | RATNA DEWI | Proses | stopped |
| TRX/2026/05/0200 | SENG TJUAN | Proses | stopped |
| TRX/2026/05/0105 | JIMMY CRYSTIAN | Proses | stopped |
| TRX/2026/04/0028 | SYARIF RAIHAN RAFISKI | Proses | stopped |
| TRX/2026/03/0241 | IRENE PRETTY PARDEDE | Proses | stopped |
| TRX/2026/03/0156 | NAIMAH | Proses | stopped |
| TRX/2026/03/0117 | ARIEF SAPTA WENDRIANTO | Proses | stopped |
| TRX/2025/12/0224 | SYARIF HANIF RAMADHAN | Booking | stopped |
| TRX/2025/12/0138 | MERRY | Booking | stopped |

## 4. Orphaned orders (no matching package)

PAKET orders whose kode has no corresponding patient_packages row at all.

### 4a. Concerning — finished orders with real session history, entirely missing (3)

Legacy STATUS is Selesai/Evaluasi (the order was finished) and it has attended sessions, but no package exists at all in the new system. Likely genuine data loss — worth creating these packages manually.

| Kode | Pasien | Layanan | Legacy STATUS | Attended sessions |
|---|---|---|---|---|
| TRX/2026/01/0053 | KOLENIUS KOLAI | PAKET PENYESUAIAN | Selesai | 2 |
| TRX/2025/11/0095 | LIM OI KHIUN ALS RIANA | PAKET 1 | Selesai | 5 |
| TRX/2025/10/0045 | LIM OI KHIUN ALS RIANA | PAKET 1 | Evaluasi | 5 |

### 4b. Likely benign — in-progress at cutover, probably continued live (36)

Legacy STATUS is Booking/Proses (or a Selesai/Evaluasi/Stop order with 0 attended sessions) — most of these cluster right around the 2026-07-16 migration cutoff date, consistent with the order having been picked up and continued directly in the new app instead of the old one.

| Kode | Pasien | Layanan | Legacy STATUS | Attended sessions |
|---|---|---|---|---|
| TRX/2026/07/0378 | JIMMY | PAKET SILVER | Booking | 0 |
| TRX/2026/07/0376 | ARINI | PAKET SILVER | Booking | 0 |
| TRX/2026/07/0375 | RIA VERGINA | PAKET SILVER | Booking | 0 |
| TRX/2026/07/0373 | HERMANSYAH | PAKET SILVER | Booking | 0 |
| TRX/2026/07/0372 | WENI MARGI LESTARI | PAKET SILVER | Booking | 0 |
| TRX/2026/07/0370 | DIAN APRILIA | PAKET SILVER | Booking | 0 |
| TRX/2026/07/0352 | RUSMALA RATINA | PAKET SILVER | Booking | 0 |
| TRX/2026/07/0348 | RINA TJENDERA | PAKET 1 | Booking | 1 |
| TRX/2026/07/0347 | KARTINI | PAKET SILVER | Proses | 2 |
| TRX/2026/07/0345 | RAISAN FIQRI | PAKET GOLD | Booking | 0 |
| TRX/2026/07/0331 | NENENG SAPARIANA | PAKET SILVER | Proses | 2 |
| TRX/2026/07/0329 | SURACHMAD DARUSMAN | PAKET GOLD | Proses | 2 |
| TRX/2026/07/0327 | NOEVAL MUZZAKKI | PAKET SILVER | Proses | 2 |
| TRX/2026/07/0325 | DHIO ASRIL DWIYONO | PAKET SILVER | Proses | 2 |
| TRX/2026/07/0317 | FIRMAN | PAKET GOLD | Proses | 7 |
| TRX/2026/07/0312 | AMALIA RIZKI SURYANDARI | PAKET SILVER | Proses | 2 |
| TRX/2026/07/0310 | HARDJONO | PAKET 2 | Proses | 1 |
| TRX/2026/07/0308 | ERIK RADJALI | PAKET GOLD | Booking | 0 |
| TRX/2026/07/0291 | ENDANG PURWATI | PAKET SILVER | Proses | 3 |
| TRX/2026/07/0279 | CESARIA ANGGUN KINANTY | PAKET SILVER | Booking | 1 |
| TRX/2026/07/0276 | PUJI ASTUTI | PAKET SILVER | Proses | 4 |
| TRX/2026/07/0274 | GEORGE BUDIJANTO SALIM | PAKET PLATINUM | Proses | 7 |
| TRX/2026/07/0265 | ANDRA SAPUTRA | PAKET SILVER | Proses | 4 |
| TRX/2026/07/0258 | AZARYA JADAYN ARYO | PAKET SILVER | Proses | 2 |
| TRX/2026/07/0257 | TEGAR KRISTIAN OMPU SUNGGU ARITONANG | PAKET GOLD | Proses | 2 |
| TRX/2026/07/0247 | LIE KIM FA/KESUMAJADI | PAKET GOLD | Proses | 3 |
| TRX/2026/07/0243 | FREDIRIKA ARIANI NESA | PAKET SILVER | Proses | 2 |
| TRX/2026/07/0242 | JESICHA MARTHALENA TRISNA | PAKET PLATINUM | Booking | 0 |
| TRX/2026/07/0223 | SUYATNO | PAKET SILVER | Proses | 3 |
| TRX/2026/07/0221 | YUNITA | PAKET 2 | Proses | 4 |
| TRX/2026/07/0220 | HUSNUL FIKRI | PAKET SILVER | Proses | 3 |
| TRX/2026/07/0215 | SUHANDA | PAKET SILVER | Proses | 2 |
| TRX/2026/07/0156 | DIVO | PAKET SILVER | Booking | 1 |
| TRX/2026/07/0102 | SILVIA VITA | PAKET SILVER | Proses | 4 |
| TRX/2026/06/0414 | SUMIATI 498 | PAKET GOLD | Proses | 4 |
| TRX/2025/11/0067 | LANDON CRYSANDER ALI | PAKET 1 | Stop | 0 |

## 5. Duplicate kode notes

More than one `patient_packages` row claiming the same source order. Never legitimate on its own — investigate the underlying patient records for each case; two different `patient_id`s sharing a kode most likely means two duplicate `patients` rows for the same real person (found once already: see report notes / chat).

| Kode | Package ID | Patient ID | Status |
|---|---|---|---|
| TRX/2026/07/0095 | 9cbdc0a7-d63a-4d43-9525-dff684e42f57 | 6b2ec9db-b2ff-47b2-ad27-e75f7afb113c | active |
| TRX/2026/07/0095 | 91450f88-8e9d-4856-ae1d-8ecf8ef37ae9 | 2d98dd0a-8e58-4493-89a1-599ed1ea957a | active |

## 6. Unverifiable packages

195 packages have no `kode:` note, so they can't be cross-checked against the legacy export. These are expected to be packages created directly in the app after launch — not itemized here.
