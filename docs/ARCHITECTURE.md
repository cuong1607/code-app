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
  mocks/                # DỮ LIỆU DEMO tập trung (tất định, isDemo: true)
  types/domain.ts       # kiểu domain phía UI
```

Luồng dữ liệu: `component → hooks/useAsync → lib/data (repository) → [Phase 01: mocks] / [Phase 02+: lib/api/client → /api/backend → NestJS]`.

- Enum trạng thái & schema form (VD `productInputSchema`, `VIDEO_JOB_STATUSES`, `PUBLISH_STATUSES`) nằm ở `packages/shared/src/domain`
  để web và API dùng chung.
- Thao tác chưa có backend tạo **nháp cục bộ** (`isLocalDraft: true`) trong state React – không lưu, mất khi tải lại.
- Lịch đăng: người dùng nhập giờ VN (`datetime-local`), chuyển sang UTC bằng `vnLocalInputToUtcIso` trước khi lưu.
- Kiểm thử UI: Vitest (logic) + Playwright (`apps/web/e2e`) chạy trên bản build: 8 route × 3 viewport (1440/1024/390),
  bắt lỗi console, đo tràn ngang, và các luồng tương tác chính.

Thư viện thêm ở Phase 01 (lý do): `radix-ui` (primitive truy cập tốt – nền của shadcn/ui), `sonner` (toast chuẩn shadcn),
`@playwright/test` (kiểm thử trình duyệt thật). Biểu đồ vẽ bằng SVG thuần để không thêm thư viện chart.

## 10. Định hướng (chưa triển khai)

- Module nghiệp vụ trong api: `products`, `scripts`, `assets`, `voices`, `videos`, `schedules`, `integrations/tiktok`.
- Queue riêng cho từng loại tác vụ: `ingest`, `script`, `image`, `tts`, `render`, `publish` để giới hạn concurrency/rate-limit độc lập.
- Worker render chạy trong container có FFmpeg để đồng nhất giữa Windows/WSL/server.
- Lưu file vào MinIO theo key `{projectId}/{kind}/{uuid}.{ext}`; client chỉ nhận presigned URL.
