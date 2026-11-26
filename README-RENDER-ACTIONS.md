# Render Paralel via GitHub Actions

Workflow generik untuk me-render komposisi Remotion proyek ini di GitHub
Actions dengan **10 job paralel** (matriks shard 0–9). Tiap shard me-render
1/10 rentang frame (video saja), lalu satu job `stitch` menyambung semuanya
dan memasang audio final. Tidak ada nama komposisi yang di-hardcode —
semuanya lewat input workflow.

## Cara pakai

1. Push proyek ini ke sebuah repo GitHub (**disarankan publik** — lihat
   catatan menit gratis di bawah). Pastikan yang ikut ter-commit:
   `src/`, `public/`, `audio/`, `scripts/`, `.github/`, `package.json`,
   `package-lock.json`, `remotion.config.ts` (sudah diatur `.gitignore`).
2. Siapkan audio final komposisi di dalam repo, misalnya
   `audio/perahu-apung/final-audio.m4a` — audio yang **sudah**
   dinormalisasi loudness-nya (± −14 LUFS, AAC). Job stitch tidak melakukan
   loudnorm; ia hanya menempelkan audio ini apa adanya (stream copy).
3. Di GitHub: **Actions → Parallel Remotion Render → Run workflow**, isi:
   - `composition_id` — id komposisi persis seperti terdaftar di
     `src/Root.tsx`.
   - `slug` — nama pendek untuk artefak hasil, mis. `perahu-apung`.
   - `total_frames` — total frame komposisi; isi `0` bila ingin dideteksi
     otomatis di runner (lebih lambat ±30 detik per job).
   - `audio_file` — path audio final di repo; kosongkan untuk video bisu.
4. Tunggu ±10 job render selesai, lalu job stitch. Unduh artefak
   **`<slug>-final`** — isinya `final.mp4` siap pakai.

### Contoh utama — "Kenapa Perahu Besi Raksasa Bisa Mengapung?"

| Input | Nilai |
|---|---|
| `composition_id` | *(id komposisi perahu di `src/Root.tsx` — sesuaikan saat komposisinya sudah jadi)* |
| `slug` | `perahu-apung` |
| `total_frames` | *(total frame dari file proyek komposisi perahu — sesuaikan; atau `0`)* |
| `audio_file` | `audio/perahu-apung/final-audio.m4a` |

### Contoh yang sudah terverifikasi lokal — Menara Pisa (935 frame)

| Input | Nilai |
|---|---|
| `composition_id` | `PisaShort` |
| `slug` | `menara-pisa` |
| `total_frames` | `935` |
| `audio_file` | `audio/menara-pisa/final-audio.m4a` |

## Pembagian shard

Dengan `per = ceil(total / 10)`, shard *i* me-render frame
`[i*per, min(total, (i+1)*per) − 1]`. Untuk 935 frame: `per = 94` —
shard 0–8 masing-masing 94 frame (0–93 … 752–845), shard 9 mengerjakan
sisanya, 89 frame (846–934). Logika ini ada di `scripts/render-shard.sh`
dan dipakai persis sama oleh workflow.

## Menjalankan skripnya secara lokal

```bash
# render satu shard (TOTAL_FRAMES=0 = deteksi otomatis)
TOTAL_FRAMES=935 ./scripts/render-shard.sh PisaShort 0 10 shards

# sambung semua shard + pasang audio final
./scripts/stitch.sh shards audio/menara-pisa/final-audio.m4a final.mp4

# sambung tanpa audio
./scripts/stitch.sh shards - final.mp4
```

## Perkiraan waktu & batas menit gratis

- Runner `ubuntu-latest` standar: 4 vCPU. Pengalaman render lokal komposisi
  three.js proyek ini ±7 detik/frame di VM kecil (1,5 CPU berbagi, WebGL
  software); di runner GitHub diperkirakan ±2–4 detik/frame. Untuk 935
  frame ÷ 10 shard (±94 frame/shard) ditambah instalasi ±2–4 menit per
  job: **total realistis ±10–20 menit per video** (bandingkan ±2 jam
  render lokal sekuensial kemarin).
- **Repo publik:** menit Actions untuk runner standar gratis tanpa batas
  kuota bulanan (tetap tunduk pada batas konkurensi — paket gratis
  mengizinkan sampai 20 job berjalan bersamaan, jadi 10 paralel aman).
- **Repo privat (paket GitHub Free):** jatah 2.000 menit/bulan. Satu run
  penuh memakai ±10 job × ±15 menit ≈ 150 menit-mesin → hanya cukup
  ±13 run/bulan. Karena itu repo publik disarankan.
- Artefak shard disimpan 7 hari, artefak final 14 hari (diatur di
  workflow); unduh `final.mp4` sebelum kedaluwarsa.
- Timeout: job render maksimal 60 menit, job stitch 15 menit. Concurrency
  group per-slug mencegah dua run untuk slug yang sama bertumpuk.

## Catatan & batasan

- Audio final **dibuat di luar workflow** (pipeline TTS + `build_audio.py`
  proyek ini) dan di-commit sebagai aset repo. Untuk Menara Pisa, file-nya
  dihasilkan dari `out/menara-pisa/premaster.wav` dengan loudnorm dua-pass
  ke −14 LUFS lalu dipangkas ke durasi video → `audio/menara-pisa/final-audio.m4a`.
- Komposisi proyek ini tidak mengandung elemen audio Remotion (narasi &
  musik semuanya di premaster), jadi shard memang dirender `--muted`
  (video murni) dan audio ditempel sekali di akhir — tidak ada risiko
  audio ganda/terpotong di sambungan shard.
- GitHub Actions pada dasarnya adalah CI untuk proyek di repo itu;
  memakai workflow ini untuk me-render proyek yang kodenya memang tinggal
  di repo tersebut adalah pemakaian wajar. Untuk volume produksi yang
  jauh lebih besar/sering, pertimbangkan Remotion Lambda (AWS) yang
  memang dirancang untuk render massal.
- `scripts/render-shard.sh` memakai `--timeout 120000` (env `TIMEOUT_MS`)
  karena frame pertama three.js yang berat bisa melewati timeout bawaan
  Remotion (30 detik) di mesin WebGL-software.
