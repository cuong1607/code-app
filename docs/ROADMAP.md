# ROADMAP – AI CONTENT STUDIO

Quy ước trạng thái: ✅ Hoàn thành & đã kiểm chứng · 🟡 Đã viết nhưng **chưa kiểm chứng được** · ⬜ Chưa làm · ❌ Bị chặn

> Cập nhật file này sau mỗi phiên làm việc. Chỉ đánh ✅ khi đã chạy kiểm tra thực tế.

---

## Giai đoạn 00 – Nền tảng (gần hoàn tất – còn Git)

Cập nhật lần cuối: 2026-11-19 (UTC)

### Đã kiểm chứng trên máy dev (Windows 11, Node 26.13.1, pnpm 10.34.9)

| #   | Hạng mục                                                    | Trạng thái | Cách kiểm chứng                                                                               |
| --- | ----------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------- |
| 1   | Monorepo pnpm workspace (`apps/*`, `packages/*`)            | ✅         | `pnpm install` thành công (726 gói)                                                           |
| 2   | TypeScript strict + tsconfig dùng chung                     | ✅         | `pnpm typecheck` – 0 lỗi (4 package)                                                          |
| 3   | ESLint 9 flat config (node + next)                          | ✅         | `pnpm lint` – 0 lỗi                                                                           |
| 4   | Prettier                                                    | ✅         | `pnpm format:check` sạch                                                                      |
| 5   | Test (Vitest)                                               | ✅         | `pnpm test` – 35 test pass (shared 15, api 12, worker 4, web 4)                               |
| 6   | Build production                                            | ✅         | `pnpm build` – shared, api, worker, web đều build được                                        |
| 7   | NestJS API `GET /health`, `GET /health/live`                | ✅         | Chạy thật: `/health/live` 200; `/health` trả 503 + chi tiết đúng khi chưa có hạ tầng          |
| 8   | Xử lý lỗi API thống nhất (`ErrorResponse`, `x-request-id`)  | ✅         | 404/422/503 kiểm tra bằng test + gọi thật                                                     |
| 9   | `POST /system/ping` – fail-fast khi Redis down              | ✅         | Trả 503 trong ~25ms (trước khi sửa: treo vô hạn)                                              |
| 10  | CORS theo `CORS_ORIGINS`                                    | ✅         | Header `access-control-allow-origin` đúng                                                     |
| 11  | Worker BullMQ + heartbeat + kiểm tra FFmpeg                 | ✅         | Heartbeat được API đọc (`worker: up`); xử lý job thật; tự kết nối lại khi Redis lên muộn      |
| 12  | Next.js trang chủ tiếng Việt + trạng thái hệ thống          | ✅         | HTTP 200, `lang="vi"`, giờ UTC+7 đúng. Từ Phase 01: `/` → `/dashboard` (khối trạng thái thật) |
| 13  | `.env.example` đầy đủ, không có secret                      | ✅         | Kiểm tra bằng mắt; Zod validate env khi khởi động                                             |
| 14  | Zod schema dùng chung (env, health, lỗi, queue)             | ✅         | Có test                                                                                       |
| 15  | Provider interfaces AI (script, image, TTS, video)          | ✅         | Chỉ interface – **không có triển khai** (đúng phạm vi GĐ 00)                                  |
| 16  | Tiện ích thời gian UTC ↔ Asia/Ho_Chi_Minh                   | ✅         | Có test (gồm trường hợp qua ngày)                                                             |
| 17  | `pnpm dev` chạy song song 3 app (watch)                     | ✅         | Web ready, API compile 0 lỗi, worker lắng nghe                                                |
| 18  | Prisma schema + migration khởi tạo                          | ✅         | `pnpm db:deploy` áp dụng `20261119000000_init`; bảng `system_settings` tồn tại                |
| 19a | Docker Compose: Postgres 17, Redis 7.4                      | ✅         | Cả hai `healthy` (Docker 29.9.3, WSL2)                                                        |
| 19b | Docker Compose: MinIO                                       | ✅         | `pgsty/minio:RELEASE.2026-08-04T00-00-00Z` `healthy`; WebUI :9001 HTTP 200                    |
| 20  | Health xanh toàn bộ (`status: ok`)                          | ✅         | `pnpm health` → HTTP 200, 4/4 thành phần `up`; trang chủ hiển thị "Hoạt động tốt"             |
| 21  | Đường ống API → BullMQ → Worker (ping job hoàn tất)         | ✅         | `POST /system/ping` 202 → `GET` trả `state: completed`, `roundTripMs: 7`                      |
| 22  | Tự tạo bucket MinIO (lúc khởi động hoặc khi MinIO lên muộn) | ✅         | Bucket `acs-media` được tạo tự động khi MinIO lên sau API; có test                            |
| 23  | README Windows + WSL2, ARCHITECTURE, CLAUDE.md              | ✅         | –                                                                                             |
| 24  | Git repository                                              | ❌         | Máy chưa cài Git                                                                              |

### Việc còn lại để đóng Giai đoạn 00

1. Cài **Git**, `git init`, commit đầu tiên (#24).
2. (Tuỳ chọn) Cài FFmpeg: `winget install --id Gyan.FFmpeg -e`. Cần trước giai đoạn 06.

### Ghi chú kỹ thuật phát sinh trong GĐ 00

- Node 26 không còn `corepack` → cài pnpm bằng `npm i -g pnpm@10.34.9`.
- `dotenv-cli` 11 đổi cú pháp thành `dotenv run -f <file> -- <cmd>` (không còn `-e`).
- Lỗi kết nối localhost trên Node là `AggregateError` có `message` rỗng → đã xử lý trong `toErrorMessage`.
- BullMQ (`maxRetriesPerRequest: null`) treo lệnh khi Redis down → API kiểm tra trạng thái Redis trước + timeout 5s.
- Vitest 5 cảnh báo config ESM trong package CJS → dùng `vitest.config.mts`.
- MinIO đã ngừng phát hành image công khai: `minio/minio` (Docker Hub) 404/pull denied, `quay.io/minio/minio` 401.
- Docker Desktop cần WSL2; nếu cài WSL sau Docker thì phải khởi động lại Docker Desktop.

---

## Giai đoạn 01 – Giao diện Web Dashboard (✅ hoàn thành phần UI)

Cập nhật lần cuối: 2026-11-19 (UTC). Phạm vi: **chỉ frontend** + chuẩn bị tầng kết nối API. Không có AI, xử lý video,
backend nghiệp vụ hay tích hợp TikTok thật. Thư mục `references/` không có ảnh mẫu → thiết kế theo mô tả yêu cầu.

| #   | Hạng mục                                                                                                                                                                                                                                           | Trạng thái | Cách kiểm chứng                                                                                      |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------- |
| 1   | Design tokens (màu sidebar nâu đen, nhấn vàng đồng, tone trạng thái, radius, typography, layout)                                                                                                                                                   | ✅         | `globals.css` + [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md); xem screenshot                                 |
| 2   | AppShell: sidebar 8 mục, active state, thu gọn (ghi nhớ), ngăn kéo mobile, workspace & user demo, menu tài khoản                                                                                                                                   | ✅         | E2E: điều hướng, `aria-current`, thu gọn + reload, menu mobile 390px                                 |
| 3   | Chỉ báo trạng thái hệ thống **thật** trên topbar (proxy `/api/backend/health`)                                                                                                                                                                     | ✅         | Hiển thị "Hệ thống ổn định" khi API + hạ tầng chạy                                                   |
| 4   | Component dùng chung: PageHeader, StatCard, DataTable, StatusBadge, SearchInput, FilterBar, Empty/Loading/ErrorState, ConfirmDialog, FileUpload, MediaPreview, VideoPreview, PromptEditor, BatchProgress, Pagination, UnavailableButton, DemoBadge | ✅         | Dùng trên 8 trang; unit test pagination                                                              |
| 5   | `/dashboard`: 8 thống kê, biểu đồ theo ngày, sản lượng theo trạng thái, hoạt động, quản lý nhanh, tác vụ gần đây                                                                                                                                   | ✅         | E2E 3 viewport; số liệu gắn nhãn DEMO, khối trạng thái hệ thống là dữ liệu thật                      |
| 6   | `/products`: bảng 10 cột, tìm kiếm không dấu, lọc danh mục/trạng thái, sắp xếp, chọn nhiều, chi tiết, form thêm/sửa (Zod dùng chung)                                                                                                               | ✅         | E2E: tìm "ao thun", lọc mỹ phẩm, validation tiếng Việt, tạo bản nháp                                 |
| 7   | `/studio/scripts`: panel cấu hình + kết quả (tiêu đề, hook, lời thoại, cảnh, visual prompt, caption, hashtag, CTA), sửa/sao chép                                                                                                                   | ✅         | E2E render; "Tạo kịch bản" khoá (Phase 03); chỉ có kịch bản MẪU                                      |
| 8   | `/studio/images`: cấu hình, 6 template, tỷ lệ, số lượng, provider placeholder, grid, xem lớn, chọn, so sánh                                                                                                                                        | ✅         | E2E render; không gọi API tạo ảnh; khung kết quả là placeholder có nhãn                              |
| 9   | `/studio/videos` **Video Factory**: panel 25% cuộn độc lập (4 khu vực) + bảng 13 cột, tab có số đếm, tìm kiếm, chọn tất cả/bỏ chọn, chi tiết + preview, chạy lại (khoá)                                                                            | ✅         | E2E: chọn 2 sản phẩm → tạo 4 luồng nháp, tab "Chờ xử lý", modal chi tiết; Chạy/Tạm dừng/Dừng bị khoá |
| 10  | `/library`: 6 tab, grid/list (ghi nhớ), tìm kiếm, sắp xếp, xem trước + thông tin file, xoá có xác nhận, chọn nhiều                                                                                                                                 | ✅         | E2E 3 viewport                                                                                       |
| 11  | `/publishing` **Lịch đăng TikTok**: panel cấu hình (tài khoản, video, chế độ, caption, hashtag, thời gian theo giờ VN, khoảng cách, giỏ hàng – chưa hỗ trợ) + bảng 10 cột, 6 tab                                                                   | ✅         | E2E: validation, tạo bài nháp 08:00 giờ VN → "Chờ kiểm duyệt"; "Gửi lên TikTok" khoá                 |
| 12  | `/settings`: 10 nhóm, API key dạng ô bảo mật (không lưu, không tự điền), Storage hiển thị trạng thái thật                                                                                                                                          | ✅         | E2E: 4 ô key `type=password`, rỗng, `autocomplete=off`                                               |
| 13  | Tầng dữ liệu: `src/mocks` (demo tập trung, `isDemo`), `src/lib/data` (repository), `src/lib/api/client.ts` (HTTP client + `ApiError`), proxy `/api/backend/*`                                                                                      | ✅         | Unit test client & query; proxy dùng thật cho `/health`                                              |
| 14  | Responsive 1440 / 1024 / 390 px, không tràn ngang toàn trang, bảng rộng cuộn trong khung                                                                                                                                                           | ✅         | E2E đo `scrollWidth` ở 24 cặp route × viewport                                                       |
| 15  | Không lỗi console nghiêm trọng                                                                                                                                                                                                                     | ✅         | E2E bắt `console.error` + `pageerror` trên 24 cặp route × viewport                                   |
| 16  | Mọi chức năng chưa có backend đều bị khoá kèm lý do (tooltip) hoặc là nháp cục bộ có nhãn                                                                                                                                                          | ✅         | E2E kiểm tra các nút khoá chính                                                                      |

**Kết quả kiểm thử cuối phiên:** `pnpm check` exit 0 (65 unit test: shared 22, api 12, worker 4, web 27) ·
`pnpm build` exit 0 · `pnpm --filter @acs/web test:e2e` **33/33** đạt (Chromium, Playwright 1.65).

Ghi chú kỹ thuật GĐ 01:

- eslint-config-next 16 bật luật React Compiler (`react-hooks/refs`, `set-state-in-effect`, `purity`) → `useAsync` suy ra
  loading từ "khoá request"; validate lịch đăng (cần `Date.now()`) chạy trong event handler.
- Vite 8 (vitest 5) dùng oxc; tsconfig Next đặt `jsx: preserve` → `vitest.config.mts` đặt `oxc.jsx.runtime = automatic`.
- Playwright dọn `test-results/` mỗi lần chạy → screenshot lưu ở `apps/web/e2e-screenshots/` (gitignore).
- Dữ liệu demo sinh tất định (seed cố định, mốc `2026-11-19T03:00Z`) để không lệch hydration.

Chưa làm trong GĐ 01 (cố ý, theo phạm vi): lưu dữ liệu thật, upload MinIO, gọi AI, render video, đăng TikTok, xác thực.

## Giai đoạn 02 – Backend sản phẩm, lưu trữ & import (⬜)

- Model `Product`, `ProductImage`, `Asset`, `Setting` (Prisma) + CRUD API dùng `productInputSchema` dùng chung.
- Thay `productRepository`/`mediaRepository` trong `apps/web/src/lib/data` bằng `apiRequest(...)` (giữ nguyên UI).
- Upload ảnh lên MinIO qua presigned URL (thay phần "chỉ xem trước" của `FileUpload`); tải xuống qua presigned GET.
- Import Excel/CSV và import từ URL (`ProductSourceProvider`, queue `ingest`, retry/rate-limit, tuân thủ điều khoản nguồn).
- API lưu cài đặt (trừ secret – secret vẫn chỉ ở server).

## Giai đoạn 03 – Kịch bản AI (⬜)

- Triển khai `ScriptProvider` đầu tiên (server-only), quản lý prompt template.
- Lưu phiên bản kịch bản, chỉnh sửa tay, theo dõi `usage`/chi phí.

## Giai đoạn 04 – Ảnh AI (⬜)

- Triển khai `ImageProvider`, queue `image`, lưu kết quả vào MinIO.

## Giai đoạn 05 – Giọng đọc tiếng Việt (⬜)

- Triển khai `TextToSpeechProvider`, chọn voice, nghe thử, lưu audio.

## Giai đoạn 06 – Dựng video (⬜)

- `VideoRenderProvider` dùng FFmpeg trong worker (container có sẵn FFmpeg), phụ đề, nhạc nền, 1080×1920.

## Giai đoạn 07 – Sản xuất hàng loạt (⬜)

- Batch job, theo dõi tiến độ realtime, huỷ/thử lại, giới hạn concurrency theo provider.

## Giai đoạn 08 – Lịch đăng TikTok (⬜)

- OAuth TikTok (server-side), lịch đăng (lưu UTC, hiển thị giờ VN), queue `publish`, trạng thái đăng.

## Giai đoạn 09 – Vận hành (⬜)

- Xác thực & phân quyền, audit log, quan sát (log có cấu trúc, metrics), Dockerfile cho từng app, CI.
