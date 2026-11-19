# AI CONTENT STUDIO

Hệ thống web tự động lấy thông tin & ảnh sản phẩm, dùng AI viết kịch bản, tạo ảnh, tạo giọng đọc tiếng Việt, dựng video hàng loạt và quản lý lịch đăng TikTok.

> **Trạng thái hiện tại: Giai đoạn 02 – Database, sản phẩm & thư viện media đã xong.** Sản phẩm, ảnh (MinIO), import
> Excel/CSV, bản nháp và cài đặt lưu thật trong PostgreSQL. Chưa có AI, render video, đăng TikTok và **chưa có đăng nhập**
> (chỉ dùng trên máy cục bộ). Xem [docs/ROADMAP.md](docs/ROADMAP.md), [docs/API.md](docs/API.md),
> [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md).

> ⚠️ **Bảo mật:** API chạy chế độ `AUTH_MODE=dev-local` – KHÔNG có xác thực. Web và API chỉ nghe trên `127.0.0.1`;
> API từ chối kết nối không đến từ máy cục bộ và từ chối khởi động khi `NODE_ENV=production`. Không mở cổng 3000/4000 ra Internet.

### Các trang (http://127.0.0.1:3000)

| Đường dẫn         | Trang                                   |
| ----------------- | --------------------------------------- |
| `/dashboard`      | Tổng quan (số liệu thật từ database)    |
| `/products`       | Quản lý sản phẩm, import/xuất Excel/CSV |
| `/products/[id]`  | Chi tiết sản phẩm & quản lý ảnh         |
| `/studio/scripts` | Kịch bản AI                             |
| `/studio/images`  | Xưởng ảnh AI                            |
| `/studio/videos`  | Xưởng video (Video Factory)             |
| `/library`        | Thư viện tài nguyên                     |
| `/publishing`     | Lịch đăng TikTok                        |
| `/settings`       | Cài đặt                                 |

| Thành phần        | Công nghệ                                                         | Cổng local  |
| ----------------- | ----------------------------------------------------------------- | ----------- |
| `apps/web`        | Next.js 16 (App Router) · TypeScript · Tailwind 4 · shadcn/ui     | 3000        |
| `apps/api`        | NestJS 11 · Prisma 6 · BullMQ (producer)                          | 4000        |
| `apps/worker`     | Node.js · BullMQ (consumer) · FFmpeg                              | –           |
| `packages/shared` | Zod schema, kiểu dữ liệu, provider interfaces, tiện ích thời gian | –           |
| `packages/config` | tsconfig / ESLint / Prettier dùng chung                           | –           |
| PostgreSQL 17     | Docker                                                            | 5432        |
| Redis 7.4         | Docker                                                            | 6379        |
| MinIO             | Docker (S3 compatible)                                            | 9000 / 9001 |

Kiến trúc chi tiết: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## 1. Yêu cầu cài đặt

| Công cụ        | Phiên bản                                               | Ghi chú                                                   |
| -------------- | ------------------------------------------------------- | --------------------------------------------------------- |
| Node.js        | ≥ 22.12 (LTS 22/24 khuyến nghị; đã kiểm thử trên 26.13) | https://nodejs.org                                        |
| pnpm           | 10.x                                                    | `npm install -g pnpm@10.34.9`                             |
| Docker Desktop | mới nhất                                                | Bật backend **WSL 2**                                     |
| Git            | mới nhất                                                | https://git-scm.com/download/win                          |
| FFmpeg         | 6+ (tuỳ chọn ở GĐ 00)                                   | Worker chỉ kiểm tra có/không; cần từ giai đoạn dựng video |

> Node 25+ không còn kèm `corepack`, vì vậy hãy cài pnpm bằng `npm install -g`.

---

## 2. Chạy trên Windows (PowerShell)

```powershell
# 1. Cài dependencies (tự chạy prisma generate)
pnpm install

# 2. Tạo file môi trường
Copy-Item .env.example .env

# 3. Khởi động PostgreSQL, Redis, MinIO
pnpm infra:up
pnpm infra:ps            # chờ tới khi cả 3 dịch vụ ở trạng thái "healthy"

# 4. Tạo bảng trong database + dữ liệu MẪU (12 sản phẩm, có nhãn "MẪU")
pnpm db:deploy
pnpm db:seed

# 5. Chạy web + api + worker cùng lúc
pnpm dev
```

Mở:

- Web: http://127.0.0.1:3000 (hoặc http://localhost:3000)
- API health: http://localhost:4000/health
- MinIO console: http://localhost:9001 (đăng nhập bằng `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` trong `.env`)

Kiểm tra nhanh từ terminal:

```powershell
pnpm health
```

Có thể chạy riêng từng app: `pnpm dev:web`, `pnpm dev:api`, `pnpm dev:worker`.

### Lưu ý Windows

- Nếu PowerShell báo `pnpm` không nhận diện sau khi cài: mở lại terminal (PATH chưa nạp lại).
- Nếu bị chặn chạy script `.ps1`: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.
- Cài FFmpeg: `winget install --id Gyan.FFmpeg -e`, sau đó mở lại terminal. Hoặc đặt đường dẫn tuyệt đối vào `FFMPEG_PATH` trong `.env`.
- Trùng cổng 5432/6379/9000: đổi `POSTGRES_PORT`, `REDIS_PORT`, `MINIO_API_PORT` trong `.env` **và** cập nhật `DATABASE_URL`, `REDIS_PORT`, `S3_ENDPOINT` tương ứng.

---

## 3. Chạy trên WSL2 (Ubuntu) – khuyến nghị cho hiệu năng

Hiệu năng file I/O tốt nhất khi mã nguồn nằm **trong** filesystem Linux (`~/...`), không phải `/mnt/c/...`.

```bash
# Trong PowerShell (Admin) nếu chưa có WSL:
#   wsl --install -d Ubuntu
# Docker Desktop > Settings > Resources > WSL integration > bật cho Ubuntu

# Trong Ubuntu:
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
source ~/.bashrc
nvm install 22
npm install -g pnpm@10.34.9
sudo apt-get update && sudo apt-get install -y ffmpeg git

git clone <repo-url> ~/code/ai-content-studio
cd ~/code/ai-content-studio
pnpm install
cp .env.example .env
pnpm infra:up
pnpm db:migrate
pnpm dev
```

Mở VS Code từ WSL: `code .` (cần extension **WSL**). Trình duyệt Windows truy cập `http://localhost:3000` bình thường.

> `node_modules` chứa binary riêng cho từng hệ điều hành (Prisma, SWC, esbuild). **Không** dùng chung một thư mục giữa Windows và WSL; mỗi môi trường tự chạy `pnpm install`.

---

## 4. Danh sách scripts (chạy ở thư mục gốc)

| Script                                                                      | Mô tả                                                                                |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `pnpm dev`                                                                  | Build `shared`, chạy song song web + api + worker (watch)                            |
| `pnpm dev:web` / `dev:api` / `dev:worker`                                   | Chạy riêng từng app                                                                  |
| `pnpm build`                                                                | Build production tất cả package (theo thứ tự phụ thuộc)                              |
| `pnpm start:api` / `start:worker` / `start:web`                             | Chạy bản build                                                                       |
| `pnpm lint`                                                                 | ESLint toàn bộ                                                                       |
| `pnpm typecheck`                                                            | Kiểm tra kiểu TypeScript toàn bộ                                                     |
| `pnpm test`                                                                 | Chạy test (Vitest) toàn bộ                                                           |
| `pnpm format` / `format:check`                                              | Prettier                                                                             |
| `pnpm check`                                                                | format:check + lint + typecheck + test                                               |
| `pnpm infra:up` / `infra:down` / `infra:ps` / `infra:logs` / `infra:config` | Docker Compose                                                                       |
| `pnpm db:migrate`                                                           | `prisma migrate dev` (tạo/áp dụng migration)                                         |
| `pnpm db:deploy`                                                            | `prisma migrate deploy` (môi trường triển khai)                                      |
| `pnpm db:generate` / `db:studio`                                            | Prisma Client / Prisma Studio                                                        |
| `pnpm db:seed`                                                              | Tạo workspace phát triển + 12 sản phẩm MẪU (idempotent, không ghi đè dữ liệu đã sửa) |
| `pnpm health`                                                               | Gọi `GET /health` và in kết quả (exit 1 nếu hệ thống down)                           |
| `pnpm test:integration`                                                     | Kiểm thử tích hợp API với PostgreSQL + MinIO thật (cần `infra:up` + `db:deploy`)     |
| `pnpm test:e2e`                                                             | Build web rồi chạy Playwright trên dữ liệu thật (cần `pnpm dev:api` đang chạy)       |
| `pnpm --filter @acs/web test:e2e:install`                                   | Cài trình duyệt Chromium cho Playwright (chạy 1 lần)                                 |

Screenshot của lần chạy E2E gần nhất nằm ở `apps/web/e2e-screenshots/` (không commit). Dữ liệu do test tạo
(tiền tố SKU `IT…`, `IM…`, `E2E…`) được tự dọn sau khi chạy.

---

## 4b. Hướng dẫn sử dụng nhanh (Phase 02)

**Thêm sản phẩm:** Sản phẩm → **Thêm sản phẩm** → nhập tên, SKU (tự IN HOA, không trùng), danh mục, giá bán (nhập
`199.000` hoặc `199000`), thông số tuỳ chọn → **Lưu sản phẩm**. Bấm **Thêm ảnh** trên thông báo để mở trang chi tiết.

**Upload ảnh:** trang chi tiết sản phẩm → kéo thả ảnh JPG/PNG/WebP (≤ 10 MB/ảnh). Ảnh được tải thẳng lên MinIO, máy chủ
kiểm tra nội dung thật trước khi lưu; ảnh trùng nội dung được dùng lại. Dùng ★ để chọn ảnh đại diện, ‹ › để sắp xếp,
biểu tượng gỡ để bỏ ảnh khỏi sản phẩm (ảnh vẫn ở Thư viện). Thư viện cũng có nút **Tải ảnh lên** riêng.

**Import Excel/CSV:** Sản phẩm → **Import Excel/CSV** → tải **file mẫu** (.xlsx hoặc .csv UTF-8) → điền dữ liệu → chọn file →
kiểm tra cột được ghép tự động → chọn cách xử lý SKU trùng (bỏ qua / cập nhật / chỉ nhập mới) → **Kiểm tra dữ liệu** (chưa ghi)
→ **Nhập N dòng hợp lệ**. Cột "URL hình ảnh" chỉ được ghi nhận; tải ảnh từ URL ở trang chi tiết chỉ hoạt động khi
`IMPORT_IMAGE_ALLOWED_HOSTS` có tên miền nguồn mà bạn có quyền sử dụng ảnh.

**Xuất dữ liệu:** Sản phẩm → **Xuất file** → Excel hoặc CSV theo bộ lọc hiện tại.

---

## 5. Kiểm tra hoạt động (health)

`GET /health` kiểm tra **thật** từng thành phần:

| Thành phần | Cách kiểm tra                                                         |
| ---------- | --------------------------------------------------------------------- |
| database   | `SELECT 1` qua Prisma                                                 |
| redis      | `PING`                                                                |
| storage    | `HeadBucket` trên MinIO (API tự tạo bucket khi khởi động nếu chưa có) |
| worker     | Đọc heartbeat worker ghi vào Redis (TTL = 3 × chu kỳ)                 |

- `status: ok` → HTTP 200 · `degraded` (chỉ worker down) → HTTP 200 · `down` (db/redis/storage down) → HTTP 503.
- `GET /health/live` luôn 200 nếu tiến trình API còn sống.
- `POST /system/ping` tạo job BullMQ; `GET /system/ping/:jobId` xem kết quả worker trả về → kiểm tra đường ống API → Redis → Worker.

```powershell
# PowerShell
$job = Invoke-RestMethod -Method Post -Uri http://localhost:4000/system/ping -ContentType 'application/json' -Body '{}'
Invoke-RestMethod http://localhost:4000/system/ping/$($job.jobId)
```

---

## 6. Bảo mật & quy ước

- `.env` không bao giờ được commit; chỉ `.env.example` (giá trị mẫu, không có secret thật).
- API key AI/TikTok **chỉ** đọc ở `apps/api` / `apps/worker`. Không dùng tiền tố `NEXT_PUBLIC_` cho secret.
- Thời gian lưu UTC (`timestamptz`), hiển thị theo `Asia/Ho_Chi_Minh`.
- Giao diện mặc định tiếng Việt.

Quy tắc phát triển đầy đủ: [CLAUDE.md](CLAUDE.md).
