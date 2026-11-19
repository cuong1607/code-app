# Tài liệu API – AI CONTENT STUDIO (Phase 02)

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

| HTTP | code                | Khi nào                                                                                 |
| ---- | ------------------- | --------------------------------------------------------------------------------------- |
| 400  | BAD_REQUEST         | Request sai cấu trúc                                                                    |
| 403  | FORBIDDEN           | Truy cập không từ máy cục bộ; tải ảnh từ URL bị chặn (nguồn chưa được phép, IP nội bộ…) |
| 404  | NOT_FOUND           | Không tồn tại / không thuộc workspace                                                   |
| 409  | CONFLICT            | SKU trùng, ảnh đang được dùng, prompt trùng tên, phiên upload hết hạn                   |
| 413  | PAYLOAD_TOO_LARGE   | File/JSON vượt giới hạn                                                                 |
| 422  | VALIDATION_ERROR    | Dữ liệu không hợp lệ – `details` là mảng `{ path, message }` tiếng Việt                 |
| 503  | SERVICE_UNAVAILABLE | DB / Redis / MinIO không sẵn sàng                                                       |

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

| Method       | Đường dẫn                                                    | Mô tả                                                                                                    |
| ------------ | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| GET/POST     | `/drafts/video`                                              | Luồng Video Factory. POST `{ drafts: VideoDraftInput[] }` (≤ 200)                                        |
| PATCH/DELETE | `/drafts/video/:id`                                          | Sửa tên/prompt/cấu hình · xoá                                                                            |
| POST         | `/drafts/video/delete`                                       | Xoá nhiều `{ ids }`                                                                                      |
| GET/POST     | `/drafts/publishing`                                         | Bài đăng nháp (trạng thái `pending_review`). `attachCart=true` → 422 (chưa hỗ trợ)                       |
| PATCH/DELETE | `/drafts/publishing/:id` · POST `/drafts/publishing/delete`  | Sửa caption/hashtag/giờ · xoá                                                                            |
| GET/POST     | `/drafts/scripts` · PATCH/DELETE `/drafts/scripts/:id`       | Kịch bản nháp                                                                                            |
| GET/POST     | `/prompt-presets?scope=video` · DELETE `/prompt-presets/:id` | Prompt đã lưu (trùng tên → 409)                                                                          |
| GET/PUT      | `/settings`                                                  | Cài đặt không nhạy cảm. PUT nhận bản vá, deep-merge rồi validate **strict** (khoá lạ như `apiKey` → 422) |
| GET          | `/workspace`                                                 | Workspace hiện tại + `authMode`                                                                          |
| GET          | `/dashboard/summary`                                         | Số liệu tổng quan thật                                                                                   |
| GET          | `/health`, `/health/live`                                    | Công khai                                                                                                |
