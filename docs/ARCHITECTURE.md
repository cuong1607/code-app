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

| Hạng mục       | Chọn                                                                                  | Lý do                                                                                                                                                                                                                    |
| -------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| TypeScript     | 5.9                                                                                   | TS 7 (native) đã ra nhưng `typescript-eslint` mới hỗ trợ `<6.1`.                                                                                                                                                         |
| Prisma         | 6.19                                                                                  | Tag `latest` trên npm đang là 8.0 **RC**; 6.x ổn định, không bắt buộc driver adapter.                                                                                                                                    |
| NestJS         | 11                                                                                    | Major ổn định, hệ sinh thái (testing, cli) tương thích đầy đủ.                                                                                                                                                           |
| ESLint         | 9 (flat config)                                                                       | Tương thích ổn định với `eslint-config-next` 16 & `typescript-eslint` 8.                                                                                                                                                 |
| BullMQ         | 5                                                                                     | Major ổn định lâu dài.                                                                                                                                                                                                   |
| Test           | Vitest (+SWC cho Nest)                                                                | Một công cụ test cho cả monorepo; SWC để emit decorator metadata.                                                                                                                                                        |
| Module format  | CommonJS cho api/worker/shared                                                        | Tương thích tối đa với NestJS/BullMQ; Next.js import CJS bình thường.                                                                                                                                                    |
| MinIO image    | `pgsty/minio:RELEASE.2026-08-04T00-00-00Z` (bản build cộng đồng Pigsty)               | MinIO ngừng phát hành image chính thức (Docker Hub `minio/minio` bị gỡ, `quay.io` 401). Vẫn là MinIO nên giữ nguyên env & code. Vì dùng chuẩn S3 nên có thể thay bằng S3/R2/RustFS/SeaweedFS mà không đổi code ứng dụng. |
| AI SDK         | `@anthropic-ai/sdk` 1.10 · `openai` 7.60                                              | SDK chính thức của từng nhà cung cấp (Phase 03). Gọi qua adapter server-side; SDK `maxRetries = 0` để retry do app kiểm soát và ghi usage từng lần gọi.                                                                  |
| Model mặc định | `claude-opus-5-5` (đổi qua `ANTHROPIC_SCRIPT_MODEL`); OpenAI không có mặc định        | Không hardcode model ID OpenAI để tránh lỗi thời – bắt buộc cấu hình `OPENAI_SCRIPT_MODEL`.                                                                                                                              |
| SDK ảnh (P04)  | `@google/genai` 3.6 (Interactions API) · `openai` 7.60 (`images.edit`)                | SDK chính thức; kiểu dữ liệu đã đối chiếu trong `genai.d.ts`. Retry của SDK tắt – retry ảnh do hàng đợi BullMQ kiểm soát (mỗi ảnh tốn tiền).                                                                             |
| Model ảnh      | `gemini-3.1-flash-image` (ổn định, đổi qua `GEMINI_IMAGE_MODEL`); OpenAI bắt buộc env | Theo trang models Google AI (20/11/2026). OpenAI: model + đơn giá/ảnh bắt buộc cấu hình (giá tính theo token, không có bảng giá theo ảnh).                                                                               |
| Xử lý ảnh      | `sharp` 0.35                                                                          | Chuẩn hoá ảnh tham chiếu, pad đúng tỷ lệ (không kéo méo), so màu tham khảo, ghép ảnh gốc (Mode F), ảnh Mock. Native nhưng có prebuilt cho Windows/Linux.                                                                 |
| Worker ảnh     | Consumer BullMQ queue `image` chạy **trong tiến trình API**                           | Cần Prisma, StorageService, AiUsage, ImageProviderRegistry – đều ở `apps/api`; `apps/worker` chưa có Prisma/S3 (dành cho FFmpeg/render). Tách được bằng `IMAGE_WORKER_ENABLED=false` + chạy instance riêng.              |

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
- Phase 04: queue `image`, job `image.generate-item` (payload chỉ chứa ID, Zod strict), consumer trong tiến trình API (§12).
- Heartbeat worker: key `worker:heartbeat` (JSON, TTL = 3 × `WORKER_HEARTBEAT_INTERVAL_MS`), chứa cả trạng thái FFmpeg.
- Redis chạy với `appendonly yes` và `maxmemory-policy noeviction` (bắt buộc với BullMQ).

## 8. Provider interfaces (AI)

Định nghĩa tại `packages/shared/src/providers/`. Phase 03 đã triển khai `ScriptProvider` (xem §11), Phase 04 triển khai
`ImageProvider` (xem §12); TTS và Video chưa có triển khai:

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

## 11. AI Script Engine (Phase 03)

```
/studio/scripts ──► /api/backend proxy (280s cho route AI) ──► ScriptsController (/scripts)
                                                                │
              ScriptGenerationService ── validate ─ workspace ─ provider/model ─ estimate ─ reserve budget ─ rate limit
                                                                │
              ScriptProviderRegistry (env) ─► Claude | OpenAI | Mock  (BaseScriptProvider: prompt → complete() → JSON → validate → repair/retry)
                                                                │
              ScriptsService (script_drafts: phiên bản)   AiUsageService (ai_usage: token, chi phí ước tính, ngân sách)
```

- **Code**: `apps/api/src/ai/` (provider, prompt, template, kiểm tra output, đơn giá, usage, giới hạn) và
  `apps/api/src/scripts/` (API, phiên bản, điều phối). Schema dùng chung: `packages/shared/src/domain/script-engine.ts`,
  luật kiểm tra & ước tính đọc: `script-quality.ts` (dùng cả ở web để hiển thị trực tiếp khi sửa).
- **Prompt 4 tầng**: `SYSTEM_RULES` cố định (không chứa dữ liệu) → `<product_data>` JSON đã escape `< > &` (dữ liệu
  không tin cậy, whitelist trường, không giá vốn/URL đầy đủ, giá bán chỉ khi cho phép) → `<creative_brief>` (template,
  hướng triển khai, cấu hình) + `<user_creative_request>` → output contract qua structured outputs.
- **Kiểm tra output** không tin structured outputs tuyệt đối: Zod strict → dựng `ScriptDocument` (narration do server ghép
  từ `spokenText`) → lint (lỗi = yêu cầu AI sửa, có giới hạn; cảnh báo = gắn vào `complianceFlags`/`issues`).
- **Phiên bản**: mỗi dòng `script_drafts` là 1 phiên bản (`root_id`, `parent_id`, `version_number`). Sửa tay cập nhật
  phiên bản đang mở; "lưu phiên bản mới" và mọi thao tác AI tạo lại luôn tạo dòng mới.
- **Chi phí**: token từ phản hồi provider × đơn giá tham khảo (`pricing.ts`) = **ước tính**. Ngân sách mỗi lần / ngày (giờ VN) /
  tháng (khi `hardStop`); giữ chỗ cho lệnh đang chạy; không có đơn giá → từ chối. Rate limit theo phút + semaphore toàn API
  (trong bộ nhớ – đủ cho dev-local; cần Redis khi chạy nhiều instance).
- **Chuẩn bị cho TTS (Phase 05)**: `document.narration` + `scenes[].spokenText` (+ `durationHintSeconds`) là đầu vào trực tiếp;
  lời thoại đã được kiểm tra không hashtag/emoji/URL, có dấu; `estimateSpeechSeconds()` chỉ là dự kiến.

## 12. AI Image Studio – Nhà cửa & Đời sống (Phase 04)

```
/studio/images ─► POST /images/jobs (idempotencyKey) ─► ImageJobsService: sản phẩm + ảnh gốc thuộc workspace ─ template áp dụng
                                                         ─ provider/model ─ đơn giá ─ ngân sách (gồm ảnh đang xếp hàng) ─ rate limit
                         image_generation_jobs + image_generation_items (1 item = 1 ảnh) ─► BullMQ queue "image" (jobId cố định)
ImageItemProcessor (consumer trong API): ảnh gốc MinIO (kiểm SHA-256) ─► sharp chuẩn hoá ─► ImageProvider.editImage (Gemini|OpenAI|Mock)
   ─► kiểm tra ảnh trả về ─► pad tỷ lệ ─► so màu tham khảo ─► MinIO ws/{ws}/ai-images/… + MediaAsset (AI_IMAGE, library_visible=false)
   ─► ai_usage (mỗi lời gọi) ─► trạng thái job tổng hợp. Mode F: sharp ghép ảnh gốc (COMPOSED_IMAGE, không AI).
```

- **Code**: `apps/api/src/ai/image/` (visual context, template, prompt builder, provider, đơn giá, xử lý ảnh) và
  `apps/api/src/images/` (API, service, processor, queue). Schema chung: `packages/shared/src/domain/image-engine.ts`.
- **Product Visual Context**: loại sản phẩm (12 loại, 4 nhóm) từ thuộc tính "Loại" > tên > danh mục (mẫu khớp sớm nhất);
  màu/họa tiết/chất liệu/kích thước/hình dáng/"Bộ gồm" CHỈ từ thuộc tính DB (ghi tên thuộc tính gốc); số lượng thành phần chỉ khi
  có số rõ; thiếu -> `missing` + cảnh báo. Chưa có AI phân tích ảnh (`imageAnalysis: 'none'`).
- **Prompt builder** (tiếng Anh cho model, quy tắc/cảnh báo tiếng Việt cho UI): dữ kiện sản phẩm là JSON đã escape, ghi rõ là
  dữ liệu; khối MUST PRESERVE (màu, họa tiết, đường may, hình dáng, cấu trúc, số lượng, tỷ lệ, logo, chất liệu) ưu tiên cao hơn
  bối cảnh/phong cách/yêu cầu người dùng; negative constraints tách riêng khi provider hỗ trợ, ngược lại ghi `AVOID:`; ảnh quảng
  cáo chừa vùng chữ (chữ chèn bằng renderer sau, không bắt AI vẽ chữ tiếng Việt).
- **Giữ đúng sản phẩm**: AI KHÔNG bảo đảm. Hệ thống: ảnh gốc bất biến, so sánh cạnh nhau + zoom đồng bộ, danh sách tự kiểm,
  so màu ΔE (tham khảo, cờ `color_low`), cờ người duyệt, duyệt/từ chối, tạo lại (item mới), chế độ kiểm duyệt chặn ảnh chưa duyệt
  khi tạo bản nháp video (`preferences.images.requireApprovalForVideo`, mặc định bật).
- **Hàng đợi**: retry có giới hạn (`IMAGE_MAX_ATTEMPTS`, đếm cả trong DB để không lặp vô hạn khi khôi phục), lỗi vĩnh viễn
  (từ chối, request sai, ngân sách) không retry; rate limit theo provider; reconcile khi khởi động + mỗi phút (item QUEUED/RUNNING
  không còn job trong Redis -> đưa lại); huỷ tác vụ -> item chưa chạy bị gỡ, item đang chạy bỏ kết quả (chi phí vẫn ghi).
- **Lưu trữ**: ghi MinIO rồi tạo DB trong transaction; lỗi DB -> xoá object; key dưới `ws/` nên job dọn object mồ côi bao phủ.
  Xoá tác vụ chỉ xoá ảnh chưa lưu thư viện/chưa gắn sản phẩm.
- **Chi phí**: đơn giá/ảnh × số ảnh = ước tính (Gemini: bảng giá công khai + 15% dự phòng token đầu vào; OpenAI: env). Lời gọi lỗi
  ghi chi phí `null` (chưa xác định) – không ghi 0.

## 13. Định hướng (chưa triển khai)

- Module nghiệp vụ trong api: `products`, `scripts`, `assets`, `voices`, `videos`, `schedules`, `integrations/tiktok`.
- Queue riêng cho từng loại tác vụ: `ingest`, `script`, `tts`, `render`, `publish` (queue `image` đã có từ Phase 04) để giới hạn concurrency/rate-limit độc lập.
- Worker render chạy trong container có FFmpeg để đồng nhất giữa Windows/WSL/server.
- Lưu file vào MinIO theo key `{projectId}/{kind}/{uuid}.{ext}`; client chỉ nhận presigned URL.
