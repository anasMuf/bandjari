# Deploy ke VPS via CI/CD

Pipeline (`.github/workflows/ci-cd.yml`):

1. **api-check / web-check** — vet, test, build; jalan di setiap push & PR (gate).
2. **build** — saat push ke `main`, image `bandjari-api` & `bandjari-platform` dibangun paralel dan di-push ke GHCR (`ghcr.io/<owner>/bandjari-*`).
3. **deploy** — SSH ke VPS, `git reset --hard origin/main`, lalu `docker compose -f docker-compose.prod.yml pull && up -d`.

## Setup VPS (sekali saja)

```sh
# 1. Docker Engine + compose plugin
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker "$USER"   # lalu logout/login

# 2. Clone repo ke direktori deploy
git clone https://github.com/anasMuf/bandjari.git /opt/bandjari
cd /opt/bandjari

# 3. Env produksi (wajib) — lihat .env.production.example
cp .env.production.example .env
$EDITOR .env   # isi DB_PASSWORD, JWT_SECRET, STORAGE_* (R2)
```

Isi `.env`:

- `JWT_SECRET` wajib diisi (token lama invalid bila berubah).
- `STORAGE_*` diisi kredensial Cloudflare R2 (bucket dibuat di dashboard R2, API token permission *Object Read & Write*).
- Buka port `22`, `8081` (frontend), `8085` (API) di firewall. Port 80/443 di VPS ini dipakai nginx host project lain — jangan diganggu.

Deploy pertama bisa dicoba manual:

```sh
export IMAGE_OWNER="anasmuf" IMAGE_TAG=latest
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

Cek: `docker compose -f docker-compose.prod.yml ps` dan log API (`docker compose -f docker-compose.prod.yml logs api`).

## DNS & domain (bandjari.net)

Buat A record di Cloudflare (proxy aktif = orange cloud):

| Nama | Tipe | Value |
|---|---|---|
| `bandjari.net` | A | IP VPS |
| `api.bandjari.net` | A | IP VPS |

- `VITE_API_URL` (GitHub variable) = `https://api.bandjari.net/api/v1` — dipakai browser, di-bake ke image saat build.
- Origin tetap HTTP (port 8081/8085); TLS diterminasi Cloudflare. Di dashboard Cloudflare pilih SSL/TLS mode **Flexible**.
- Karena origin keduanya di port non-standar, tambahkan **Origin Rule** di Cloudflare (Rules → Origin Rules, semua plan):
  - `Hostname equals api.bandjari.net` → *Destination port* `8085`
  - `Hostname equals bandjari.net` → *Destination port* `8081`
- Presigned URL playback dari R2 (`*.r2.cloudflarestorage.com`) otomatis bisa diakses publik — tidak perlu konfigurasi tambahan.

## Setup GitHub (sekali saja)

1. **Environment** `ANASLABS_VPS` → Settings → Environments → New environment.
2. **Secrets** (di environment tersebut):
   - `VPS_HOST` — IP/domain VPS
   - `VPS_USER` — user SSH (harus punya akses docker)
   - `VPS_KEY` — private key SSH (bisa `ssh-keygen -t ed25519`, pasang publiknya ke `~/.ssh/authorized_keys`)
   - `DEPLOY_PATH` — path repo di VPS, mis. `/opt/bandjari`
   - `GHCR_PAT` *(opsional)* — Personal Access Token dengan scope `read:packages`. Diperlukan bila package GHCR bersifat private (default). Bila package dibuat **public**, tidak perlu.
3. **Variables** (Settings → Secrets and variables → Actions):
   - `VITE_API_URL` — lihat bagian DNS di atas.

## Alur rilis

- Push ke `main` → checks → build image (tag `latest` + `sha`) → deploy otomatis.
- Push ke `develop` → hanya checks (tidak build/deploy).
- PR ke `main`/`develop` → hanya checks.

## Setelah deploy pertama

- Auto-migrate tabel dijalankan API saat startup (GORM `AutoMigrate` + constraint).
- Seeder template (song & sample) dijalankan manual dari `apps/api`:
  ```sh
  cd apps/api
  go run ./seeders/song_templates
  go run ./seeders/sample_templates -src "../../docs/src/SAMPLING HADRAH AB CHANNEL"
  ```
  (Seeder sample butuh object storage aktif, dan kredensial dijalankan dari mesin dengan akses ke R2.)

## Rollback

```sh
# di VPS, DEPLOY_PATH
export IMAGE_OWNER=anasmuf IMAGE_TAG=<sha-sebelumnya>
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```
