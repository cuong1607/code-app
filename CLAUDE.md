# CLAUDE.md – Hướng dẫn cho AI agent làm việc trong repo này

Dự án: **AI CONTENT STUDIO**, một monorepo pnpm gồm Next.js (web), NestJS (api), BullMQ worker và các package dùng chung.
Đọc trước: [README.md](README.md), [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/ROADMAP.md](docs/ROADMAP.md).

## Quy tắc bắt buộc

1. **Đọc trước khi sửa.** Xem cấu trúc thư mục và code hiện có trước khi tạo hay sửa file. Ưu tiên mở rộng module có sẵn thay vì tạo bản trùng lặp.
2. **Không làm giả.** Không tạo chức năng giả rồi báo là đã xong. Demo data được phép nhưng phải đánh dấu rõ (`DEMO`/`isDemo`, nhãn "Dữ liệu mẫu" trên UI).
3. **Chỉ báo hoàn thành khi đã kiểm chứng.** Phải chạy lệnh kiểm tra thật (typecheck/lint/test/chạy app/gọi endpoint). Việc chưa kiểm chứng được thì ghi 🟡 hoặc ❌ trong ROADMAP kèm lý do.
4. **Giữ nguyên chức năng đang chạy.** Sau mỗi giai đoạn, chạy `pnpm check` và `pnpm build` để đảm bảo không làm hỏng phần đã có.
5. **Ghi trạng thái vào [docs/ROADMAP.md](docs/ROADMAP.md)** sau mỗi phiên làm việc.
6. **Không tự ý đổi công nghệ.** Chỉ đổi khi có lý do kỹ thuật rõ ràng, và ghi lý do vào bảng quyết định trong ARCHITECTURE.md.
7. **Mọi module phải có xử lý lỗi** (xem mục "Xử lý lỗi" bên dưới).

## Quy ước sản phẩm

- UI mặc định **tiếng Việt** (`<html lang="vi">`, mọi text hiển thị bằng tiếng Việt).
- Thời gian **lưu UTC** (`@db.Timestamptz(3)`, ISO-8601 có `Z`), **hiển thị Asia/Ho_Chi_Minh** bằng `formatDisplayDateTime()` của `@acs/shared`.
- **API key chỉ ở server** (`apps/api`, `apps/worker`). Không bao giờ dùng `NEXT_PUBLIC_` cho secret, không truyền key xuống client, không log secret.
- **Chức năng AI phải đi qua provider interfaces** trong `packages/shared/src/providers`. Code nghiệp vụ chỉ phụ thuộc interface, không gọi SDK của nhà cung cấp trực tiếp.

## Kỹ thuật

| Việc                   | Cách làm                                                                                                       |
| ---------------------- | -------------------------------------------------------------------------------------------------------------- |
| Schema/kiểu dùng chung | Định nghĩa bằng Zod trong `packages/shared`, export type bằng `z.infer`                                        |
| Env mới                | Thêm vào `.env.example` (không có giá trị secret thật) **và** vào `apiEnvSchema`/`workerEnvSchema`             |
| Lỗi nghiệp vụ          | `throw new AppError(code, message, details)`; filter toàn cục tự chuyển thành `ErrorResponse`                  |
| Validate input API     | `schema.safeParse(body)`; nếu lỗi thì ném `AppError('VALIDATION_ERROR', ..., issues)`                          |
| Gọi hạ tầng ngoài      | Luôn có timeout; không để API sập khi phụ thuộc down                                                           |
| Job nền                | Thêm tên queue/job + Zod payload vào `packages/shared/src/queues.ts`; payload sai thì ném `UnrecoverableError` |
| DB                     | Sửa `apps/api/prisma/schema.prisma` rồi chạy `pnpm db:migrate`. Commit cả thư mục migrations                   |
| NestJS DI              | Import class cần inject bằng import giá trị, **không** dùng `import type` (cần decorator metadata)             |
| UI                     | Component shadcn/ui đặt trong `apps/web/src/components/ui`, icon dùng `lucide-react`                           |
| Gọi API từ web         | Ưu tiên Server Components / Route Handlers phía server qua `API_INTERNAL_URL`                                  |

### Frontend (`apps/web`) – từ Phase 01

- Đọc [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) trước khi làm UI. Dùng token màu/tone có sẵn, không hardcode màu trạng thái.
- Component chỉ lấy dữ liệu qua repository trong `src/lib/data` (gọi API thật qua proxy `/api/backend`). Không thêm dữ liệu demo trộn với dữ liệu thật; cấu hình tĩnh để ở `src/lib/catalog.ts`.
- Chức năng chưa có backend: `UnavailableButton` (kèm lý do + phase). Dữ liệu mẫu (seed) phải có nhãn ("MẪU"). Không giả vờ thành công.

### Backend (`apps/api`) – từ Phase 02

- Mọi endpoint (trừ `@Public()`) nhận workspace qua `@WorkspaceId()`; mọi truy vấn PHẢI lọc `workspaceId` và kiểm tra tài nguyên tham chiếu thuộc cùng workspace. Không bao giờ đọc workspaceId từ client.
- Validate bằng `parseInput(schemaDùngChung, body)`; id trong path dùng `parseId()`.
- Tiền là `Decimal(14,2)`, trả về dạng chuỗi. Thời gian `Timestamptz(3)` UTC.
- File: chỉ tin nội dung server tự kiểm tra (magic bytes, dung lượng thật), không tin MIME/size client gửi.
- Không tải URL bên ngoài ngoài `RemoteImageFetcher` (allowlist + chặn IP nội bộ).
- Đổi schema: `pnpm db:migrate` (dừng `pnpm dev` trước trên Windows vì Prisma engine bị khoá), commit cả migration.
- Kiểm thử: `pnpm test:integration` (DB + MinIO thật) và `pnpm test:e2e` (cần API đang chạy).
- Nhãn & tone trạng thái lấy từ `src/lib/labels.ts`; enum lấy từ `@acs/shared`.
- Luật React Compiler đang bật: không đọc ref / gọi hàm không thuần (`Date.now()`) trong render, không `setState` đồng bộ trong effect.
- Sau khi sửa UI: `pnpm check`, `pnpm build`, `pnpm test:e2e` (cần `pnpm --filter @acs/web test:e2e:install` lần đầu).

### AI (`apps/api/src/ai`, `apps/api/src/scripts`) – từ Phase 03

- Gọi AI CHỈ qua `ScriptProviderRegistry` → adapter kế thừa `BaseScriptProvider` (chỉ cần triển khai `complete()` +
  `validateConfiguration()`); không gọi SDK ở nơi khác. SDK đặt `maxRetries: 0` – retry/sửa lỗi do lớp cơ sở kiểm soát.
- Prompt: không đưa dữ liệu vào `SYSTEM_RULES`; dữ liệu sản phẩm/người dùng luôn qua `encodeUntrusted()` trong thẻ riêng.
  Chỉ lấy trường sản phẩm qua `toProductFacts()` (whitelist, không giá vốn). Đổi nội dung template → tăng `version`.
- Không tin output AI: `aiScriptOutputSchema` (strict) → `scriptDocumentSchema` → `lintScriptDocument`. `narration` do server ghép.
- Mọi lời gọi AI: ước tính + `AiUsageService.reserve()` trước, ghi `ai_usage` mỗi lần gọi (kể cả lỗi), giải phóng trong `finally`.
- Thao tác AI trên kịch bản đã lưu tạo PHIÊN BẢN MỚI (`ScriptsService.createVersion`), không ghi đè.
- Test không gọi AI thật: dùng `MockScriptProvider` (hoặc client giả). AI thật: `pnpm ai:smoke` (tốn tiền, cần key).
- Công cụ ghi file có thể biến `\uXXXX` thành ký tự thật → kiểm tra lại regex chứa ký tự vô hình.

### Ảnh AI (`apps/api/src/ai/image`, `apps/api/src/images`) – từ Phase 04

- Gọi provider ảnh CHỈ qua `ImageProviderRegistry` → adapter kế thừa `BaseImageProvider` (triển khai `callProvider()`
  1 lần gọi, không retry; SDK tắt retry). Retry/timeout/rate limit do hàng đợi `image` + `ImageItemProcessor` kiểm soát.
- Dữ kiện sản phẩm cho prompt ảnh CHỈ qua `buildVisualContext()` (thuộc tính DB, không suy đoán, không giá) và
  `buildImagePrompt()` (escape, khối MUST PRESERVE ưu tiên cao nhất). Đổi template → tăng `version`.
- Ảnh gốc sản phẩm bất biến; ảnh tạo ra là MediaAsset mới (`AI_IMAGE`, Mode F `COMPOSED_IMAGE`) dưới `ws/{ws}/ai-images/`,
  `library_visible=false` cho tới khi người dùng lưu. Ghi MinIO trước, lỗi DB → xoá object.
- Không tin ảnh provider trả về: `inspectOutput()` (magic bytes + giải mã); sai tỷ lệ → PAD, không kéo méo/cắt.
- Không tuyên bố kiểm tra tự động bảo đảm đúng sản phẩm (chỉ "tham khảo"); ảnh dùng cho video phải qua duyệt khi bật kiểm duyệt.
- Không có đơn giá → từ chối (402). Lời gọi lỗi ghi chi phí `null`, không ghi 0.
- Test không gọi provider thật: `MockImageProvider` (có `setBehaviors`) hoặc client giả. Thật: `pnpm ai:image-smoke` (tốn tiền).
- Khi chạy `pnpm test:integration`, dừng `pnpm dev` trước: worker ảnh của dev dùng chung Redis/queue và sẽ xử lý job của test.

### Xử lý lỗi

- API: `AllExceptionsFilter` (toàn cục) + `RequestIdMiddleware`. Lỗi 5xx không xác định thì không lộ chi tiết ra client.
- Worker: bắt lỗi theo từng job, retry exponential cho lỗi tạm thời, `UnrecoverableError` cho lỗi dữ liệu, tắt êm khi SIGINT/SIGTERM.
- Web: `error.tsx` / `not-found.tsx`; lỗi gọi API hiển thị thông báo tiếng Việt thay vì crash.

## Lệnh thường dùng

```bash
pnpm install            # cài dependencies (tự prisma generate)
pnpm infra:up           # Postgres + Redis + MinIO (Docker)
pnpm db:migrate         # migration
pnpm dev                # web:3000 + api:4000 + worker
pnpm health             # kiểm tra GET /health
pnpm check              # format:check + lint + typecheck + test
pnpm build              # build production
```

Chạy lệnh cho một package: `pnpm --filter @acs/api <script>` (các package: `@acs/web`, `@acs/api`, `@acs/worker`, `@acs/shared`, `@acs/config`).

## Môi trường dev

- Windows 11 + VS Code + Docker Desktop. Shell mặc định là **PowerShell 5.1**: không có `&&` trong lệnh PowerShell (npm scripts thì chạy qua cmd nên vẫn dùng được `&&`).
- Phiên bản đã chọn (lý do xem ARCHITECTURE.md §3): TypeScript 5.9, Next 16, React 19, NestJS 11, Prisma 6.19, BullMQ 5, ESLint 9, Tailwind 4, Zod 4, Vitest 5, pnpm 10.
- `dotenv-cli` 11 dùng cú pháp `dotenv run -q -f ../../.env -- <cmd>`.
