# 🚀 GOTS Monorepo Starter Kit

> **Go + TypeScript** full-stack monorepo starter kit — production-ready architecture with authentication, API documentation, and modern frontend tooling.

---

## Overview

Starter kit untuk membangun aplikasi full-stack menggunakan arsitektur monorepo. Backend menggunakan **Go (Echo)** dan frontend menggunakan **React (TanStack)**, dikelola dalam satu repository dengan **pnpm workspaces** dan **Nx** sebagai build orchestrator.

```
monorepo_gots_starterkit/
├── apps/
│   ├── api/           ← Go REST API (Echo + GORM + PostgreSQL)
│   └── platform/      ← React SPA (TanStack Router + Vite + Tailwind v4)
├── docs/              ← Dokumentasi pengembangan produk
├── nx.json            ← Nx build orchestrator config
├── pnpm-workspace.yaml
├── package.json
└── .env               ← Shared environment variables
```

---

## Tech Stack

### Backend (`apps/api`)

| Kategori       | Teknologi                                                          |
|----------------|--------------------------------------------------------------------|
| Language       | Go 1.25                                                            |
| Framework      | [Echo v4](https://echo.labstack.com/)                              |
| ORM            | [GORM](https://gorm.io/) + PostgreSQL                             |
| Authentication | JWT (`golang-jwt/jwt`) + custom middleware                         |
| Validation     | [go-playground/validator](https://github.com/go-playground/validator) |
| API Docs       | [Swagger](https://github.com/swaggo/swag) (auto-generated)        |
| Hot Reload     | [Air](https://github.com/air-verse/air)                            |
| Logging        | [Logrus](https://github.com/sirupsen/logrus)                      |

### Frontend (`apps/platform`)

| Kategori       | Teknologi                                                          |
|----------------|--------------------------------------------------------------------|
| Language       | TypeScript 6.x                                                     |
| Framework      | React 19                                                           |
| Build Tool     | [Vite 8](https://vite.dev/)                                       |
| Routing        | [TanStack Router](https://tanstack.com/router) (file-based)       |
| Data Fetching  | [TanStack Query](https://tanstack.com/query) (React Query)        |
| Styling        | [Tailwind CSS v4](https://tailwindcss.com/)                        |
| Icons          | [Lucide React](https://lucide.dev/)                                |
| Linter         | [Biome](https://biomejs.dev/)                                      |
| API Codegen    | [Orval](https://orval.dev/) (from Swagger → React Query hooks)    |

### Monorepo Tooling

| Kategori       | Teknologi                                                          |
|----------------|--------------------------------------------------------------------|
| Package Manager| [pnpm](https://pnpm.io/) (workspaces)                             |
| Build System   | [Nx](https://nx.dev/) (task orchestration & caching)               |

---

## Prerequisites

Pastikan tools berikut sudah terinstall:

- **Node.js** ≥ 20
- **pnpm** ≥ 9
- **Go** ≥ 1.25
- **PostgreSQL** ≥ 15
- **Git**

---

## Getting Started

### 1. Clone & Install Dependencies

```bash
git clone <repository-url>
cd monorepo_gots_starterkit
pnpm install
```

### 2. Setup Environment

Copy `.env.example` atau buat file `.env` di root project:

```env
# Backend (API) Configuration
PORT=8080
JWT_SECRET=supersecretkey
DB_HOST=localhost
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=myapp_db
DB_PORT=5432
SSL_MODE=disable

# Frontend (Platform) Configuration
VITE_API_URL=http://localhost:8080/api
```

### 3. Setup Database

Buat database PostgreSQL:

```bash
createdb myapp_db
```

> Tabel akan otomatis di-migrate oleh GORM saat API pertama kali dijalankan (Auto-Migrate).

### 4. Run Development

Jalankan **semua apps** sekaligus:

```bash
pnpm dev
```

Atau jalankan masing-masing secara terpisah:

```bash
# API saja (port 8080)
pnpm --filter api dev

# Platform saja (port 3000)
pnpm --filter platform dev
```

### 5. Build Production

```bash
pnpm build
```

---

## Project Architecture

### Backend — Clean Architecture

```
apps/api/
├── main.go              ← Entry point, route registration, DI wiring
├── config/
│   └── database.go      ← ENV loader, PostgreSQL/GORM connection
├── model/
│   ├── model.go         ← Base model (PrimaryKey, BaseModelTimeAt)
│   └── user.go          ← User entity (GORM model)
├── dto/
│   ├── user.go          ← Request/Response DTOs
│   ├── success_response.go
│   └── error_response.go
├── repository/
│   └── user_repository.go  ← Data access layer (GORM queries)
├── service/
│   └── user_service.go     ← Business logic layer
├── handler/
│   ├── user_handler.go     ← HTTP handler (controller)
│   └── error_handler.go    ← Custom error handler
├── middleware/
│   ├── auth.go             ← JWT authentication middleware
│   └── logrus_logger.go    ← Request logging middleware
├── utility/
│   └── validator.go        ← Custom request validator
├── docs/                   ← Auto-generated Swagger docs
├── seeders/                ← Database seeders
└── .air.toml               ← Air hot-reload config
```

**Alur request:**

```
Request → Middleware (CORS, Logging, JWT) → Handler → Service → Repository → Database
```

### Frontend — Feature-Based Architecture

```
apps/platform/src/
├── main.tsx                   ← App entry point
├── router.tsx                 ← TanStack Router setup
├── styles.css                 ← Global styles (Tailwind)
├── routeTree.gen.ts           ← Auto-generated route tree
├── routes/
│   ├── __root.tsx             ← Root layout
│   ├── login.tsx              ← Login page
│   ├── register.tsx           ← Register page
│   ├── _authenticated.tsx     ← Auth layout guard
│   └── _authenticated/
│       └── index.tsx          ← Dashboard (protected)
├── components/
│   ├── atoms/                 ← Atomic components
│   │   ├── Alert.tsx
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   └── Label.tsx
│   └── molecules/             ← Composite components
│       ├── ConfirmDialog.tsx
│       ├── FormField.tsx
│       └── Toast.tsx
├── features/
│   ├── auth/
│   │   ├── AuthContext.tsx     ← Auth state management
│   │   └── components/        ← Auth-specific components
│   └── home/
│       └── components/        ← Home-specific components
└── api/
    ├── endpoints/             ← Auto-generated API hooks (Orval)
    ├── model/                 ← Auto-generated API types (Orval)
    └── mutator/
        └── custom-instance.ts ← Axios/fetch custom instance
```

---

## API Endpoints

| Method | Endpoint               | Auth | Deskripsi                    |
|--------|------------------------|------|------------------------------|
| POST   | `/api/users/register`  | ❌   | Register user baru           |
| POST   | `/api/users/login`     | ❌   | Login & dapatkan JWT token   |
| GET    | `/api/users`           | ✅   | Get current user profile     |

### Swagger Documentation

Setelah API berjalan, akses Swagger UI di:

```
http://localhost:8080/swagger/index.html
```

---

## Available Scripts

### Root (Monorepo)

| Command           | Deskripsi                                     |
|-------------------|-----------------------------------------------|
| `pnpm dev`        | Jalankan semua apps dalam mode development     |
| `pnpm build`      | Build semua apps untuk production              |

### API (`apps/api`)

| Command                      | Deskripsi                              |
|------------------------------|----------------------------------------|
| `pnpm --filter api dev`     | Jalankan API dengan hot-reload (Air)   |
| `pnpm --filter api build`   | Build binary Go                        |

### Platform (`apps/platform`)

| Command                            | Deskripsi                              |
|------------------------------------|----------------------------------------|
| `pnpm --filter platform dev`      | Jalankan frontend dev server (port 3000)|
| `pnpm --filter platform build`    | Build frontend untuk production        |
| `pnpm --filter platform lint`     | Jalankan Biome linter                  |
| `pnpm --filter platform format`   | Format kode dengan Biome               |
| `pnpm --filter platform generate:api` | Generate API hooks dari Swagger    |

---

## API Code Generation (Orval)

Frontend menggunakan **Orval** untuk auto-generate React Query hooks dari Swagger spec:

```bash
# 1. Pastikan API sedang running (untuk generate swagger.json)
pnpm --filter api dev

# 2. Generate API hooks
pnpm --filter platform generate:api
```

Output akan di-generate ke:
- `src/api/endpoints/` — React Query hooks per tag
- `src/api/model/` — TypeScript types

---

## Environment Variables

| Variable         | App      | Deskripsi                          | Default               |
|------------------|----------|------------------------------------|-----------------------|
| `PORT`           | API      | Port API server                    | `8080`                |
| `JWT_SECRET`     | API      | Secret key untuk signing JWT       | —                     |
| `DB_HOST`        | API      | PostgreSQL host                    | `localhost`           |
| `DB_USER`        | API      | PostgreSQL user                    | `postgres`            |
| `DB_PASSWORD`    | API      | PostgreSQL password                | —                     |
| `DB_NAME`        | API      | PostgreSQL database name           | `myapp_db`            |
| `DB_PORT`        | API      | PostgreSQL port                    | `5432`                |
| `SSL_MODE`       | API      | PostgreSQL SSL mode                | `disable`             |
| `VITE_API_URL`   | Platform | Base URL API untuk frontend        | `http://localhost:8080/api` |

> File `.env` diletakkan di **root project** dan dibaca oleh kedua apps.

---

## Documentation

Dokumentasi pengembangan produk tersedia di direktori `docs/`:

```
docs/
├── README.md              ← Panduan alur dokumentasi & template
└── issue/
    └── README.md          ← Template penulisan issue
```

Lihat [docs/README.md](docs/README.md) untuk panduan lengkap workflow dokumentasi produk (PRD → UX Flow → UI Spec → ERD → API Contract).

---

## License

ISC
