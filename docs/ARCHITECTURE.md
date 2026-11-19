# Kiến trúc – AI CONTENT STUDIO

> Phản ánh trạng thái **giai đoạn 00**. Phần "Định hướng" mô tả thiết kế dự kiến, chưa được triển khai.

## 1. Tổng quan

```
                ┌──────────────────────────┐
  Trình duyệt ─▶│ apps/web (Next.js :3000) │  Server Components gọi API phía server
                └────────────┬─────────────┘  (API_INTERNAL_URL, không lộ secret)
                             │ HTTP
                ┌────────────▼─────────────┐
                │ apps/api (NestJS :4000)  │── Prisma ──▶ PostgreSQL
                │  - REST, validate (Zod)  │── S3 SDK ──▶ MinIO
                │  - BullMQ producer       │── ioredis ─▶ Redis
                └────────────┬─────────────┘
                             │ BullMQ (Redis)
                ┌────────────▼─────────────┐
                │ apps/worker (Node)       │── FFmpeg (render)
                │  - BullMQ consumer       │── AI providers (tương lai)
                │  - heartbeat -> Redis    │── MinIO (tương lai)
                └──────────────────────────┘
```

## 2. Monorepo

| Thư mục           | Vai trò                                                                                                                                                                         |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web`        | Giao diện. Chỉ chứa logic hiển thị và gọi API. Không giữ API key.                                                                                                               |
| `apps/api`        | Cổng nghiệp vụ duy nhất: REST, xác thực (tương lai), DB, tạo job. Sở hữu Prisma schema (`apps/api/prisma`).                                                                     |
| `apps/worker`     | Xử lý tác vụ nặng/lâu: gọi AI, TTS, render FFmpeg, upload. Scale độc lập với API.                                                                                               |
| `packages/shared` | Zod schema (env, health, lỗi, queue payload), hằng số, tiện ích thời gian, **provider interfaces**. Không phụ thuộc Node API → dùng được ở cả web. Build ra CommonJS (`dist/`). |
| `packages/config` | tsconfig base/node/nextjs, ESLint flat config, Prettier.                                                                                                                        |
| `infra`           | Docker Compose cho hạ tầng local.                                                                                                                                               |
| `docs`            | Tài liệu kiến trúc, lộ trình.                                                                                                                                                   |
| `references`      | Tài liệu tham khảo, mẫu kịch bản, ảnh mẫu (không phải code).                                                                                                                    |
| `scripts`         | Script tiện ích (vd. `check-health.mjs`).                                                                                                                                       |

Thứ tự build: `packages/shared` → `apps/*`. Các script gốc `dev/lint/typecheck/test` tự build `shared` trước.

## 3. Quyết định kỹ thuật & phiên bản

| Hạng mục      | Chọn                                                                    | Lý do                                                                                                                                                                                                                    |
| ------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| TypeScript    | 5.9                                                                     | TS 7 (native) đã ra nhưng `typescript-eslint` mới hỗ trợ `<6.1`.                                                                                                                                                         |
| Prisma        | 6.19                                                                    | Tag `latest` trên npm đang là 8.0 **RC**; 6.x ổn định, không bắt buộc driver adapter.                                                                                                                                    |
| NestJS        | 11                                                                      | Major ổn định, hệ sinh thái (testing, cli) tương thích đầy đủ.                                                                                                                                                           |
| ESLint        | 9 (flat config)                                                         | Tương thích ổn định với `eslint-config-next` 16 & `typescript-eslint` 8.                                                                                                                                                 |
| BullMQ        | 5                                                                       | Major ổn định lâu dài.                                                                                                                                                                                                   |
| Test          | Vitest (+SWC cho Nest)                                                  | Một công cụ test cho cả monorepo; SWC để emit decorator metadata.                                                                                                                                                        |
| Module format | CommonJS cho api/worker/shared                                          | Tương thích tối đa với NestJS/BullMQ; Next.js import CJS bình thường.                                                                                                                                                    |
| MinIO image   | `pgsty/minio:RELEASE.2026-08-04T00-00-00Z` (bản build cộng đồng Pigsty) | MinIO ngừng phát hành image chính thức (Docker Hub `minio/minio` bị gỡ, `quay.io` 401). Vẫn là MinIO nên giữ nguyên env & code. Vì dùng chuẩn S3 nên có thể thay bằng S3/R2/RustFS/SeaweedFS mà không đổi code ứng dụng. |

Thay đổi công nghệ chỉ khi có lý do kỹ thuật rõ ràng và phải ghi lại tại bảng này.

## 4. Cấu hình & bí mật

- Một file `.env` ở thư mục gốc. API/worker tự tìm thư mục gốc (chứa `pnpm-workspace.yaml`) để nạp; Next.js nạp qua `@next/env` trong `next.config.ts`.
- Thứ tự ưu tiên: biến môi trường hệ thống > `apps/<app>/.env` > `<root>/.env`.
- Env được kiểm tra bằng Zod (`apiEnvSchema`, `workerEnvSchema` trong `packages/shared`). Sai cấu hình → tiến trình dừng với thông báo liệt kê từng biến lỗi.
- Secret chỉ tồn tại ở server. Web chỉ đọc `API_INTERNAL_URL` (server-side) và `NEXT_PUBLIC_APP_NAME`.

## 5. Xử lý lỗi

| Tầng          | Cơ chế                                                                                                                                                                                                                   |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| shared        | `AppError(code, message, details)` + `ERROR_CODES`; `toErrorMessage()` an toàn với mọi giá trị throw (gồm `AggregateError`).                                                                                             |
| api           | `AllExceptionsFilter` toàn cục → luôn trả `ErrorResponse` `{ error: { code, message, details?, requestId?, timestamp } }`. Lỗi 5xx không xác định không lộ chi tiết ra client. `RequestIdMiddleware` gắn `x-request-id`. |
| api → hạ tầng | Không làm sập API khi DB/Redis/MinIO chưa sẵn sàng; health báo `down`. Mọi thao tác hàng đợi fail-fast khi Redis chưa kết nối + timeout 5s.                                                                              |
| worker        | Payload sai → `UnrecoverableError` (không retry). Retry exponential cho lỗi tạm thời. Bắt `unhandledRejection`, tắt êm (SIGINT/SIGTERM). Log lỗi Redis có giới hạn tần suất.                                             |
| web           | `error.tsx`, `not-found.tsx`; lỗi gọi API hiển thị thân thiện bằng tiếng Việt thay vì crash.                                                                                                                             |

## 6. Thời gian

- Lưu: UTC. Cột DB dùng `@db.Timestamptz(3)`; container Postgres đặt `TZ=UTC`.
- Truyền tải: ISO-8601 có `Z` (`nowUtcIso()`).
- Hiển thị: `formatDisplayDateTime()` → `dd/MM/yyyy HH:mm` theo `Asia/Ho_Chi_Minh`.

## 7. Hàng đợi

- Prefix Redis: `QUEUE_PREFIX` (mặc định `acs`).
- Giai đoạn 00: queue `system`, job `system.ping` dùng để kiểm tra đường ống.
- Heartbeat worker: key `worker:heartbeat` (JSON, TTL = 3 × `WORKER_HEARTBEAT_INTERVAL_MS`), chứa cả trạng thái FFmpeg.
- Redis chạy với `appendonly yes` và `maxmemory-policy noeviction` (bắt buộc với BullMQ).

## 8. Provider interfaces (AI)

Định nghĩa tại `packages/shared/src/providers/` – **chưa có triển khai**:

| Interface              | Nhiệm vụ                                        |
| ---------------------- | ----------------------------------------------- |
| `ScriptProvider`       | Viết kịch bản (scenes, hook, caption, hashtags) |
| `ImageProvider`        | Sinh ảnh từ prompt + ảnh sản phẩm tham chiếu    |
| `TextToSpeechProvider` | Giọng đọc tiếng Việt, liệt kê voice             |
| `VideoRenderProvider`  | Dựng video (FFmpeg local hoặc dịch vụ ngoài)    |

Mọi provider kế thừa `BaseProvider` (`info`, `checkHealth()`), nhận `ProviderCallOptions` (`signal`, `timeoutMs`, `correlationId`) và trả `usage` để theo dõi chi phí. Triển khai cụ thể sẽ nằm trong api/worker, được chọn qua biến `AI_*_PROVIDER`.

## 9. Kiến trúc frontend (`apps/web`, từ Phase 01)

```
src/
  app/(app)/            # route group dùng chung AppShell: dashboard, products, studio/{scripts,images,videos},
                        # library, publishing, settings  (+ loading.tsx skeleton khi chuyển trang)
  app/api/backend/      # proxy cùng origin -> NestJS (API_INTERNAL_URL), timeout 30s, trả ErrorResponse khi lỗi
  components/ui/        # primitive kiểu shadcn/ui trên Radix (radix-ui): button, dialog, sheet, dropdown, tooltip, tabs…
  components/common/    # component nghiệp vụ dùng chung: DataTable, StatusBadge, FileUpload, PromptEditor, UnavailableButton…
  components/layout/    # AppShell, Sidebar, MobileNav, Topbar, SystemIndicator, UserMenu
  components/<feature>/ # dashboard, products, scripts, images, videos, library, publishing, settings
  hooks/                # useAsync, useSelection, useDebouncedValue, usePersistedFlag
  lib/api/client.ts     # apiRequest(): timeout, Zod schema, ApiError(code, status, requestId)
  lib/data/             # REPOSITORY – UI chỉ đọc dữ liệu qua đây
  lib/labels.ts         # nhãn tiếng Việt + tone màu cho mọi enum trạng thái
  lib/catalog.ts        # cấu hình tĩnh: giọng đọc, template, prompt mẫu (KHÔNG phải dữ liệu demo)
  types/domain.ts       # kiểu riêng của UI (ImageRef…); kiểu nghiệp vụ lấy từ @acs/shared
```

Luồng dữ liệu (từ Phase 02): `component → hooks/useAsync → lib/data (repository) → lib/api/client → /api/backend → NestJS`.
Thư mục `mocks/` của Phase 01 đã bị gỡ: không còn dữ liệu demo trộn với dữ liệu thật.

- Enum trạng thái & schema (VD `productInputSchema`, `importRequestSchema`, `videoDraftSchema`) nằm ở `packages/shared/src/domain`
  để web và API dùng chung; phản hồi API được kiểm tra lại bằng chính schema đó ở phía web.
- Lịch đăng: người dùng nhập giờ VN (`datetime-local`), chuyển sang UTC bằng `vnLocalInputToUtcIso` trước khi lưu.
- Kiểm thử UI: Vitest (logic) + Playwright (`apps/web/e2e`) chạy trên bản build: 8 route × 3 viewport (1440/1024/390),
  bắt lỗi console, đo tràn ngang, và các luồng tương tác chính.

Thư viện thêm ở Phase 01 (lý do): `radix-ui` (primitive truy cập tốt – nền của shadcn/ui), `sonner` (toast chuẩn shadcn),
`@playwright/test` (kiểm thử trình duyệt thật). Biểu đồ vẽ bằng SVG thuần để không thêm thư viện chart.

## 10. Backend dữ liệu (Phase 02)

```
apps/api/src/
  auth/        WorkspaceGuard (APP_GUARD) + @WorkspaceId() + @Public(); WorkspaceBootstrapService (tạo dev workspace)
  products/    ProductsService (CRUD, tìm kiếm), ProductMediaService (gắn/gỡ/đại diện/sắp xếp/tải từ URL)
  imports/     ImportService (preview/validate/commit/export/template), spreadsheet.ts (exceljs, csv-parse/stringify)
  media/       MediaService, MediaUploadService (presigned), MediaCleanupService, image-inspector, RemoteImageFetcher
  drafts/      Video / Publishing / Script drafts + Prompt presets
  settings/    /settings (deep-merge + strict), /workspace
  dashboard/   /dashboard/summary
  storage/     StorageService: presign PUT/GET, head, get (giới hạn byte), put, delete, list – tự khôi phục kết nối
```

**Cô lập workspace & truy cập.** `WorkspaceGuard` gán `workspaceId` do server quyết định (dev-local: `DEV_WORKSPACE_ID`,
chỉ loopback, cấm production). Mọi truy vấn có `where: { workspaceId }`; tham chiếu chéo (ảnh, sản phẩm, luồng video)
đều được kiểm tra thuộc cùng workspace. Phase 09 chỉ cần thay guard bằng xác thực thật.

**Luồng upload ảnh.**

```
Trình duyệt ──POST /media/uploads {filename,type,size}──▶ API: kiểm tra loại/dung lượng khai báo, tạo media_uploads(pending),
           ◀── uploadUrl (presigned PUT, Content-Type nằm trong chữ ký, 15 phút)
Trình duyệt ──PUT file──▶ MinIO (bucket acs-media, key ws/<workspace>/images/<yyyy>/<mm>/<uuid>.<ext>)
Trình duyệt ──POST /media/uploads/:id/complete──▶ API: HEAD (dung lượng thật) → GET (≤ giới hạn) → magic bytes + kích thước ảnh
           → SHA-256: trùng → xoá object mới, trả tài nguyên cũ | mới → tạo media_assets
Job định kỳ: phiên pending quá hạn → xoá object + expired; object mồ côi dưới ws/ (> 24h) → xoá
```

**Tìm kiếm tiếng Việt.** Cột `search_text` = `normalizeSearchText(tên + SKU + danh mục + thương hiệu)` (bỏ dấu, đ→d,
chữ thường) ghi ở tầng ứng dụng; truy vấn `LIKE '%…%'` dùng index GIN `pg_trgm`. Cùng hàm chuẩn hoá dùng ở web.

**Tiền.** `Decimal(14,2)` trong DB; API trả chuỗi `"199000.00"`; web chỉ chuyển sang number để hiển thị.

Thư viện thêm ở Phase 02 (lý do): `exceljs` (đọc/ghi .xlsx, MIT, không phụ thuộc native), `csv-parse`/`csv-stringify`
(CSV chuẩn RFC 4180), `image-size` (đọc kích thước ảnh từ buffer, thuần JS), `@aws-sdk/s3-request-presigner` (ký URL S3).

## 11. Định hướng (chưa triển khai)

- Module nghiệp vụ trong api: `products`, `scripts`, `assets`, `voices`, `videos`, `schedules`, `integrations/tiktok`.
- Queue riêng cho từng loại tác vụ: `ingest`, `script`, `image`, `tts`, `render`, `publish` để giới hạn concurrency/rate-limit độc lập.
- Worker render chạy trong container có FFmpeg để đồng nhất giữa Windows/WSL/server.
- Lưu file vào MinIO theo key `{projectId}/{kind}/{uuid}.{ext}`; client chỉ nhận presigned URL.
