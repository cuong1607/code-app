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
| 24  | Git repository                                              | ✅         | `git init` (Phase 02), checkpoint `858e40e` trước khi sửa code; quét secret trước commit      |

### Việc còn lại

1. (Tuỳ chọn) Cài FFmpeg: `winget install --id Gyan.FFmpeg -e`. Cần trước giai đoạn 06.

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

> **Từ Phase 02:** dữ liệu demo (`src/mocks`) đã được GỠ BỎ; các mục 5, 6, 9, 10, 11, 12, 13 ở trên chạy bằng dữ liệu thật
> (xem Giai đoạn 02). Bảng trên giữ nguyên làm lịch sử nghiệm thu Phase 01.

## Giai đoạn 02 – Database, quản lý sản phẩm & thư viện media (✅)

Cập nhật lần cuối: 2026-11-19 (UTC). Chi tiết endpoint: [API.md](API.md).

### Database (Prisma 6, PostgreSQL 17)

Migration `20261119103145_phase02_products_media_drafts` (giữ nguyên `system_settings` của Phase 00):
`workspaces`, `application_settings`, `products`, `media_assets`, `product_media`, `media_uploads`, `video_drafts`,
`publishing_drafts`, `script_drafts`, `prompt_presets` + extension `pg_trgm`. UUID, FK có `ON DELETE` rõ ràng, unique
`(workspace_id, sku)`, `(workspace_id, sha256)`, `(bucket, storage_key)`, `(workspace_id, scope, name)`; index GIN trigram trên
`products.search_text`. Tiền `Decimal(14,2)`. Không soft delete (không cần ở phase này). `prisma migrate diff` = không drift.
Seed idempotent: workspace phát triển + 12 sản phẩm **MẪU** (`source_type = seed`, gắn nhãn trên UI), không tạo ảnh giả.

| #   | Hạng mục                                                                                                                                                                                                      | Trạng thái        | Cách kiểm chứng                                                                                           |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | --------------------------------------------------------------------------------------------------------- |
| 1   | Product API: CRUD, tìm kiếm tiếng Việt không dấu, lọc, sắp xếp, phân trang, SKU trùng → 409, lỗi 422 theo trường                                                                                              | ✅                | Integration (DB thật) + E2E                                                                               |
| 2   | Trang `/products` dùng API thật: thêm/sửa/xoá (xác nhận), toast, skeleton, lỗi tiếng Việt, giữ dữ liệu khi tải lại                                                                                            | ✅                | E2E: tạo → reload còn; SKU trùng hiện dưới ô; sửa giá; xoá                                                |
| 3   | Trang chi tiết `/products/[id]`: thông tin, giá vốn/bán, biên lợi nhuận, thông số, nguồn, upload nhiều ảnh, đổi ảnh đại diện, sắp xếp, gỡ ảnh, xem lớn                                                        | ✅                | E2E: upload 2 ảnh, đổi đại diện, sắp xếp → reload giữ thứ tự, gỡ ảnh, file PDF bị chặn                    |
| 4   | Upload presigned MinIO: xin URL → PUT trực tiếp → server xác minh (dung lượng thật, magic bytes, kích thước ảnh, chống decompression bomb) → tạo MediaAsset; chống trùng SHA-256                              | ✅                | Integration: PNG/JPEG/WebP, nhiều ảnh, trùng, gif, file giả mạo, vượt dung lượng, sai dung lượng khai báo |
| 5   | Preview / tải xuống qua presigned GET; xoá ảnh đang dùng → 409, xác nhận → gỡ liên kết                                                                                                                        | ✅                | Integration (so khớp byte) + E2E (sự kiện download, tên file đúng)                                        |
| 6   | Dọn dẹp: phiên upload hết hạn + object mồ côi (định kỳ 10 phút + endpoint thủ công)                                                                                                                           | ✅                | Integration: phiên quá hạn → `expired`                                                                    |
| 7   | MinIO lên sau API: tự khôi phục (`ensureBucket` lại khi lỗi kết nối)                                                                                                                                          | ✅                | Cơ chế Phase 00 mở rộng cho mọi thao tác object; restart Docker không cần restart API                     |
| 8   | Import `.xlsx`/`.csv`: đọc file (BOM, dấu `,`/`;`/tab), mapping tự gợi ý, preview, validate từng dòng, 3 chế độ trùng SKU, báo cáo                                                                            | ✅                | Unit + Integration (CSV, XLSX, dòng lỗi, trùng trong file, trùng DB, thiếu cột) + E2E                     |
| 9   | Xuất CSV (UTF-8 BOM) / XLSX theo bộ lọc + file mẫu import                                                                                                                                                     | ✅                | Integration                                                                                               |
| 10  | URL ảnh trong file import: chỉ ghi nhận; tải thủ công qua `RemoteImageFetcher` (allowlist, https, chặn IP nội bộ tại thời điểm kết nối, redirect ≤3 kiểm tra lại, giới hạn dung lượng, timeout, xác minh ảnh) | ✅ (mặc định TẮT) | Unit: chặn IP nội bộ, tên miền giả mạo, http, cổng lạ; tên miền trỏ về 127.0.0.1 bị chặn                  |
| 11  | Thư viện `/library` dùng dữ liệu thật: 6 tab, grid/list, tìm kiếm, sắp xếp, phân trang, metadata, tải xuống, xoá                                                                                              | ✅                | E2E: upload → metadata → tải xuống → xoá                                                                  |
| 12  | Bản nháp Video Factory, lịch đăng, kịch bản, prompt đã lưu → PostgreSQL (tạo/tải lại/sửa/xoá)                                                                                                                 | ✅                | Integration + E2E (reload vẫn còn)                                                                        |
| 13  | Prompt cũ ở `localStorage` (Phase 01): không tự xoá/ghi đè – người dùng chủ động "Chuyển vào database"                                                                                                        | ✅                | Xem `prompt-section.tsx`                                                                                  |
| 14  | Cài đặt không nhạy cảm lưu DB (deep-merge, schema strict chặn khoá lạ như `apiKey`)                                                                                                                           | ✅                | Unit + Integration + E2E (lưu ngân sách → reload còn)                                                     |
| 15  | Dashboard số liệu thật (sản phẩm, ảnh, dung lượng, bản nháp, sản phẩm mới theo ngày giờ VN, hoạt động)                                                                                                        | ✅                | Integration                                                                                               |
| 16  | Truy cập dev-local: workspace do server quyết định, chỉ loopback, cấm production, API + web bind 127.0.0.1                                                                                                    | ✅                | Unit guard; env test production bị từ chối; kết nối qua IP LAN tới 3000/4000 bị từ chối                   |
| 17  | Persistence: refresh trình duyệt, restart API, restart Docker (không xoá volume)                                                                                                                              | ✅                | Script đánh dấu: sau restart sản phẩm còn, giá `12345.67` đúng, ảnh SHA-256 khớp                          |

**Kết quả kiểm thử cuối phiên:** `pnpm check` exit 0 – **130 unit test** (shared 45, api 57, web 24, worker 4) ·
`pnpm build` exit 0 · `pnpm test:integration` **28/28** (PostgreSQL + MinIO thật) · `pnpm test:e2e` **40/40**.

Thay đổi so với Phase 01 (có chủ đích):

- Bỏ dữ liệu demo khỏi các module đã có API (không trộn demo với dữ liệu thật). Danh mục cấu hình tĩnh (giọng đọc,
  template…) chuyển sang `src/lib/catalog.ts`. "Khuôn kịch bản mẫu" và "khung ảnh mẫu" vẫn giữ nhãn.
- Lịch đăng: chưa có tài khoản TikTok thật → bài nháp lưu "chưa gắn kênh"; nguồn video = luồng nháp Video Factory.
- Bộ test unit web giảm từ 27 xuống 24 vì bỏ test của `applyListQuery` (lọc demo phía client); logic tương đương nay chạy
  phía server và được kiểm thử ở tầng integration.
- E2E Phase 01 viết lại cho hành vi API thật (33 → 40 test).

Ghi chú kỹ thuật GĐ 02:

- Windows khoá file engine Prisma khi API đang chạy → dừng `pnpm dev` trước khi `pnpm install`/`prisma generate`.
- Zod 4 `.partial()` vẫn áp `default` → tách schema gốc (không default) cho PATCH, tránh ghi đè `currency`/`attributes`.
- Express mặc định giới hạn JSON 100 KB → API dùng 15 MB cho import commit.
- Prisma gửi tham số raw query dạng `bigint` → cần ép `::int` (`make_interval`).
- MinIO (pgsty) cho phép CORS mặc định; chữ ký presigned PUT ràng buộc `Content-Type` (sai → 403).

### Giới hạn hiện tại

- Chưa có xác thực thật – chỉ dùng trên máy cục bộ (Phase 09).
- Tải ảnh từ URL mặc định TẮT; cần quản trị viên cấu hình `IMPORT_IMAGE_ALLOWED_HOSTS` với nguồn có quyền sử dụng ảnh.
- Import xử lý đồng bộ trong request (≤ 5.000 dòng); file lớn hơn nên chạy qua hàng đợi ở phase sau.
- Thanh tiến độ upload là trạng thái từng file (chưa đo % byte).

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
