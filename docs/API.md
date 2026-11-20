# Tài liệu API – AI CONTENT STUDIO (Phase 04)

- Base URL nội bộ: `http://127.0.0.1:4000` (API **chỉ nghe loopback**).
- Trình duyệt gọi qua proxy cùng origin của web: `http://127.0.0.1:3000/api/backend/<đường dẫn>`.
- Dữ liệu JSON. Thời gian ISO-8601 **UTC**. Tiền là **chuỗi thập phân** (`"199000.00"`) để không mất chính xác.
- Schema request/response dùng chung ở `packages/shared` (Zod) – tên schema ghi trong ngoặc.

## Truy cập & workspace (chưa có xác thực)

`AUTH_MODE=dev-local` (chế độ duy nhất ở Phase 02):

- Mọi request (trừ `/health*`) được gán vào `DEV_WORKSPACE_ID` **do server quyết định** – API không đọc `workspaceId` từ client.
- Chỉ chấp nhận kết nối TCP từ `127.0.0.1` / `::1`; máy khác nhận `403 FORBIDDEN`. API và web mặc định bind `127.0.0.1`.
- **Không phải xác thực.** API **từ chối khởi động** nếu `NODE_ENV=production` với chế độ này.
- Mọi service đã lọc theo `workspaceId` và kiểm tra quyền sở hữu tài nguyên → Phase 09 chỉ cần thay guard.

## Lỗi chuẩn hoá

```json
{
  "error": {
    "code": "CONFLICT",
    "message": "SKU \"AT-01\" đã tồn tại trong workspace",
    "details": { "field": "sku" },
    "requestId": "…",
    "timestamp": "…"
  }
}
```

| HTTP | code                    | Khi nào                                                                                      |
| ---- | ----------------------- | -------------------------------------------------------------------------------------------- |
| 400  | BAD_REQUEST             | Request sai cấu trúc                                                                         |
| 403  | FORBIDDEN               | Truy cập không từ máy cục bộ; tải ảnh từ URL bị chặn (nguồn chưa được phép, IP nội bộ…)      |
| 404  | NOT_FOUND               | Không tồn tại / không thuộc workspace                                                        |
| 409  | CONFLICT                | SKU trùng, ảnh đang được dùng, prompt trùng tên, phiên upload hết hạn                        |
| 413  | PAYLOAD_TOO_LARGE       | File/JSON vượt giới hạn                                                                      |
| 402  | BUDGET_EXCEEDED         | Lệnh AI vượt ngân sách (mỗi lần/ngày/tháng) hoặc không có đơn giá để dự tính chi phí         |
| 422  | VALIDATION_ERROR        | Dữ liệu không hợp lệ – `details` là mảng `{ path, message }` tiếng Việt                      |
| 429  | RATE_LIMITED            | Vượt số lượt gọi AI/phút (`AI_RATE_LIMIT_PER_MINUTE`) hoặc provider giới hạn tốc độ          |
| 502  | PROVIDER_ERROR          | Provider AI lỗi/quá tải/từ chối/trả JSON sai sau số lần sửa cho phép (không lộ chi tiết thô) |
| 503  | SERVICE_UNAVAILABLE     | DB / Redis / MinIO không sẵn sàng                                                            |
| 503  | PROVIDER_NOT_CONFIGURED | Provider AI chưa có API key/model, hoặc key không hợp lệ                                     |

## Danh sách có phân trang

Query chung: `page` (1), `pageSize` (20, tối đa 100), `sortDir` (`asc`|`desc`), `search`.
Phản hồi: `{ items, total, page, pageSize }`.

## Sản phẩm

| Method | Đường dẫn                              | Mô tả                                                                                                                                                      |
| ------ | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/products`                            | Danh sách. Query: `search` (không dấu, tên/SKU/danh mục/thương hiệu), `category`, `status`, `sortBy` (`createdAt`,`updatedAt`,`name`,`sku`,`sellingPrice`) |
| GET    | `/products/categories`                 | Danh mục đang dùng                                                                                                                                         |
| GET    | `/products/export?format=xlsx\|csv`    | Xuất file theo bộ lọc (tối đa 10.000 dòng)                                                                                                                 |
| GET    | `/products/:id`                        | Chi tiết + ảnh (`productDetailSchema`)                                                                                                                     |
| POST   | `/products`                            | Tạo (`productInputSchema`) – SKU tự IN HOA, trùng → 409                                                                                                    |
| PATCH  | `/products/:id`                        | Cập nhật từng phần (`productUpdateSchema`)                                                                                                                 |
| DELETE | `/products/:id`                        | Xoá (ảnh trong thư viện được giữ lại)                                                                                                                      |
| POST   | `/products/:id/media`                  | Gắn ảnh `{ mediaAssetIds }` (ảnh đầu tiên tự là ảnh đại diện nếu chưa có)                                                                                  |
| PUT    | `/products/:id/media/order`            | Sắp xếp `{ mediaAssetIds }` – phải gồm đúng toàn bộ ảnh                                                                                                    |
| PUT    | `/products/:id/media/:mediaId/primary` | Đặt ảnh đại diện                                                                                                                                           |
| DELETE | `/products/:id/media/:mediaId`         | Gỡ ảnh (nếu là đại diện → ảnh kế tiếp thành đại diện)                                                                                                      |
| POST   | `/products/:id/media/from-url`         | Tải 1 URL trong `pendingImageUrls` – cần `IMPORT_IMAGE_ALLOWED_HOSTS`                                                                                      |

## Import Excel/CSV

| Method | Đường dẫn                                    | Mô tả                                                                                                    |
| ------ | -------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| POST   | `/products/import/preview`                   | multipart `file` (.xlsx/.csv, ≤ 5 MB, ≤ 5.000 dòng) → tiêu đề, các dòng, mapping gợi ý. **Không ghi DB** |
| POST   | `/products/import/validate`                  | `importRequestSchema` → kết quả từng dòng (`create`/`update`/`skip`/`error`). **Không ghi DB**           |
| POST   | `/products/import/commit`                    | Như validate nhưng ghi các dòng hợp lệ                                                                   |
| GET    | `/products/import/template?format=xlsx\|csv` | File mẫu                                                                                                 |

Chế độ `mode`: `skip_duplicates` (bỏ qua SKU đã có), `update_duplicates` (cập nhật – chỉ ghi đè cột được map và có giá trị),
`only_new` (nếu có SKU đã tồn tại thì **không ghi dòng nào**). URL ảnh trong file chỉ được **ghi nhận** (`pendingImageUrls`), không tự tải.

## Media (presigned upload)

| Method | Đường dẫn                                     | Mô tả                                                                                                                                                                    |
| ------ | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| POST   | `/media/uploads`                              | Bước 1: `{ filename, contentType (jpeg/png/webp), size }` → `{ uploadId, uploadUrl, headers, expiresAt }`                                                                |
| PUT    | `uploadUrl` (MinIO)                           | Bước 2: trình duyệt PUT file trực tiếp, đúng header `Content-Type` (nằm trong chữ ký)                                                                                    |
| POST   | `/media/uploads/:id/complete`                 | Bước 3: server đọc object, xác minh dung lượng thật + magic bytes + kích thước ảnh, SHA-256 → tạo `MediaAsset`. Trùng nội dung → `{ duplicate: true }` với tài nguyên cũ |
| GET    | `/media`                                      | Danh sách. Query: `type` (`ORIGINAL_IMAGE`…), `search`, `sortBy` (`createdAt`,`filename`,`fileSize`)                                                                     |
| GET    | `/media/:id`                                  | Chi tiết + `previewUrl` (presigned, 15 phút)                                                                                                                             |
| GET    | `/media/:id/download-url`                     | URL tải xuống (presigned, 5 phút, có tên file)                                                                                                                           |
| DELETE | `/media/:id?force=true`                       | Xoá. Đang dùng bởi sản phẩm mà không `force` → 409                                                                                                                       |
| POST   | `/media/maintenance/cleanup?orphanMinAgeSec=` | Dọn phiên upload hết hạn & object mồ côi (cũng chạy định kỳ)                                                                                                             |

## Bản nháp & cài đặt

| Method       | Đường dẫn                                                            | Mô tả                                                                                                    |
| ------------ | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| GET/POST     | `/drafts/video`                                                      | Luồng Video Factory. POST `{ drafts: VideoDraftInput[] }` (≤ 200)                                        |
| PATCH/DELETE | `/drafts/video/:id`                                                  | Sửa tên/prompt/cấu hình · xoá                                                                            |
| POST         | `/drafts/video/delete`                                               | Xoá nhiều `{ ids }`                                                                                      |
| GET/POST     | `/drafts/publishing`                                                 | Bài đăng nháp (trạng thái `pending_review`). `attachCart=true` → 422 (chưa hỗ trợ)                       |
| PATCH/DELETE | `/drafts/publishing/:id` · POST `/drafts/publishing/delete`          | Sửa caption/hashtag/giờ · xoá                                                                            |
| GET/POST     | `/prompt-presets?scope=video\|script` · DELETE `/prompt-presets/:id` | Prompt đã lưu (trùng tên → 409)                                                                          |
| GET/PUT      | `/settings`                                                          | Cài đặt không nhạy cảm. PUT nhận bản vá, deep-merge rồi validate **strict** (khoá lạ như `apiKey` → 422) |
| GET          | `/workspace`                                                         | Workspace hiện tại + `authMode`                                                                          |
| GET          | `/dashboard/summary`                                                 | Số liệu tổng quan thật                                                                                   |
| GET          | `/health`, `/health/live`                                            | Công khai                                                                                                |

## AI Script Engine (Phase 03) – `/scripts`

API key **chỉ** đọc từ biến môi trường server; không endpoint nào nhận hay trả API key.
Mọi lệnh gọi AI: validate (schema strict, từ chối trường lạ như `workspaceId`) → kiểm tra sản phẩm thuộc workspace →
provider sẵn sàng + model trong danh sách cho phép → ước tính & giữ chỗ ngân sách → rate limit → timeout + retry có giới hạn
→ kiểm tra JSON (sửa tối đa `AI_MAX_REPAIR_ATTEMPTS` lần) → lưu → ghi `ai_usage`.

| Method | Đường dẫn                                            | Mô tả                                                                                                                                                                   |
| ------ | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/scripts/templates`                                 | 8 template (id, tên, mô tả, phiên bản, cấu trúc, quy tắc, mẫu prompt, điều kiện bắt buộc)                                                                               |
| GET    | `/scripts/providers`                                 | Trạng thái provider (`ready`/`not_configured`/`disabled`), model cho phép, có đơn giá hay không, provider mặc định                                                      |
| POST   | `/scripts/providers/:id/check`                       | Kiểm tra key + model qua Models API (không tốn token). Body `{ model? }`                                                                                                |
| POST   | `/scripts/estimate`                                  | Body như `generate` → số lời gọi, token & chi phí **ước tính**, trần chi phí, còn lại hôm nay/tháng, `allowed`. Không gọi AI                                            |
| POST   | `/scripts/generate`                                  | `scriptGenerateRequestSchema` → `{ generationId, items[{ status, script \| error }], usage }`. Biến thể lỗi không làm mất bản thành công; tất cả lỗi → mã lỗi tương ứng |
| GET    | `/scripts?productId=&variantGroupId=&search=&limit=` | Danh sách (mỗi kịch bản = phiên bản mới nhất; lọc `variantGroupId` → mọi biến thể)                                                                                      |
| POST   | `/scripts`                                           | Lưu kịch bản soạn tay / từ khuôn mẫu `{ productId, document, origin: manual\|sample }` (không AI)                                                                       |
| GET    | `/scripts/:id`                                       | Chi tiết phiên bản + danh sách phiên bản + usage của phiên bản                                                                                                          |
| PATCH  | `/scripts/:id`                                       | Sửa tay phiên bản đang mở `{ document }` (không AI)                                                                                                                     |
| POST   | `/scripts/:id/versions`                              | Lưu thành phiên bản mới `{ document, changeNote? }` – phiên bản cũ giữ nguyên                                                                                           |
| POST   | `/scripts/:id/scenes/:index/regenerate`              | AI viết lại 1 cảnh `{ instructions?, provider?, model? }` → **phiên bản mới**                                                                                           |
| POST   | `/scripts/:id/caption/regenerate`                    | AI viết lại caption + hashtag + CTA → **phiên bản mới**                                                                                                                 |
| PUT    | `/scripts/:id/preferred`                             | Chọn phiên bản tốt nhất trong nhóm biến thể                                                                                                                             |
| DELETE | `/scripts/:id`                                       | Xoá kịch bản cùng **toàn bộ** phiên bản                                                                                                                                 |
| GET    | `/scripts/usage/summary`                             | Chi phí ước tính hôm nay (giờ VN)/tháng, ngân sách, 20 lời gọi gần nhất                                                                                                 |

`ScriptDocument` (v2, `scriptDocumentSchema`): `language` = `vi-VN`, `title`, `style`, `targetDurationSeconds`, `hook`,
`narration` (**server tự ghép** từ `spokenText` các cảnh – nguồn cho TTS), `scenes[]` (`index`, `sceneType`,
`durationHintSeconds`, `description`, `visualPrompt`, `spokenText`, `overlayText`, `visualSource`), `caption`, `hashtags`,
`cta`, `complianceFlags`. `estimatedSpeechSeconds` trong phản hồi là **ước tính** (≈ 3,2 âm tiết/giây), không phải thời lượng audio.

Video Factory: `POST /drafts/video` nhận thêm `scriptId` (phiên bản kịch bản dùng làm đầu vào, phải thuộc workspace).

## AI Image Studio (Phase 04) – `/images`

Tạo ảnh chạy **nền** qua hàng đợi BullMQ `image` (mỗi ảnh = 1 job). Client tạo tác vụ rồi đọc trạng thái (polling).
Chi phí là **ước tính**. Ảnh gốc sản phẩm không bao giờ bị sửa/ghi đè. AI không bảo đảm giữ chính xác sản phẩm – người dùng duyệt.

| Method | Đường dẫn                            | Mô tả                                                                                                                     |
| ------ | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/images/templates?mode=`            | 10 template Home & Living + 6 chế độ (A–F) + phong cách                                                                   |
| GET    | `/images/providers`                  | Trạng thái provider (gemini, openai, mock), model, đơn giá/ảnh, số ảnh tham chiếu tối đa (`imageProvidersResponseSchema`) |
| POST   | `/images/providers/:id/check`        | Kiểm tra key/model (Gemini `models.get`, OpenAI `models.retrieve`) – không tạo ảnh                                        |
| GET    | `/images/products/:id/context?mode=` | `ProductVisualContext` + ảnh gốc (ORIGINAL_IMAGE) + template áp dụng/gợi ý/lý do (`imageProductContextSchema`)            |
| POST   | `/images/estimate`                   | Ước tính chi phí, kiểm tra ngân sách, xem trước prompt – **không gọi AI** (`imageEstimateSchema`)                         |
| POST   | `/images/jobs`                       | Tạo tác vụ (`imageGenerateRequestSchema`, strict). `201` mới tạo; gửi lại cùng `idempotencyKey` → `200` trả tác vụ cũ     |
| GET    | `/images/jobs?productId=&status=`    | Danh sách tác vụ (phân trang)                                                                                             |
| GET    | `/images/jobs/:id`                   | Chi tiết: ảnh gốc, item (giai đoạn, ảnh, duyệt, kiểm tra tự động, lỗi), ngữ cảnh lúc tạo (`imageJobDetailSchema`)         |
| POST   | `/images/jobs/:id/cancel`            | Huỷ tác vụ đang chạy (`409` nếu đã kết thúc)                                                                              |
| DELETE | `/images/jobs/:id`                   | Xoá tác vụ đã kết thúc – ảnh chưa lưu thư viện/chưa gắn sản phẩm bị xoá khỏi MinIO; trả `{ removedImages, keptImages }`   |
| POST   | `/images/items/:id/approve`          | Duyệt (`imageReviewSchema`: `note`, `flags[]`)                                                                            |
| POST   | `/images/items/:id/reject`           | Từ chối + cờ (sai màu, sai họa tiết, sai hình dáng, sai số lượng, thêm vật phẩm, méo, chữ lạ, khác)                       |
| POST   | `/images/items/:id/regenerate`       | Tạo lại → item MỚI trong cùng tác vụ (ảnh cũ giữ nguyên); `409` nếu đang tạo lại                                          |
| POST   | `/images/items/:id/save`             | Lưu vào Thư viện media (`409` nếu ảnh đã bị từ chối)                                                                      |
| POST   | `/images/items/:id/link-product`     | Gắn ảnh **đã duyệt** vào sản phẩm (ảnh đại diện cũ giữ nguyên)                                                            |
| GET    | `/images/items/:id/download-url`     | URL tải có hạn 5 phút                                                                                                     |

Trạng thái tác vụ/ảnh: `QUEUED`, `RUNNING`, `WAITING_PROVIDER`, `COMPLETED`, `FAILED`, `CANCELLED`. Giai đoạn ảnh (thay cho %):
`queued → loading_references → calling_provider → post_processing → saving → done` (hoặc `failed`/`cancelled`).

Request mẫu:

```json
{
  "productId": "…",
  "referenceAssetIds": ["…"],
  "mode": "batch_variations",
  "templateId": "bedding_arrangement",
  "styleId": "natural_daylight",
  "aspect": "9:16",
  "count": 3,
  "provider": "gemini",
  "userPrompt": "thêm chậu cây nhỏ cạnh giường",
  "idempotencyKey": "uuid do client sinh mỗi lần bấm Tạo"
}
```

- `count`: 1 / 3 / 5. Mode F (`original_composition`) chỉ 1 ảnh, dùng `backgroundColor` (`#RRGGBB`), không gọi AI.
- Lỗi: `402` không có đơn giá / vượt ngân sách (tính cả ảnh đang xếp hàng); `422` ảnh tham chiếu không thuộc sản phẩm, template không
  hợp loại sản phẩm/chế độ, quá số ảnh tham chiếu của model; `429` vượt lượt/phút; `503` provider chưa cấu hình.
- `POST /drafts/video`: khi bật `preferences.images.requireApprovalForVideo` (mặc định), ảnh Image Studio chưa duyệt → `422`.
