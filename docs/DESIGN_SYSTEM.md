# Design System – AI CONTENT STUDIO

Phong cách **Premium AI Production Studio**: thanh điều hướng nâu đen, màu nhấn vàng đồng, vùng làm việc sáng ấm.
Không dùng tên thương hiệu, logo hay thành phần độc quyền của phần mềm khác.

Nguồn token duy nhất: [`apps/web/src/app/globals.css`](../apps/web/src/app/globals.css) (đặt tên theo chuẩn shadcn/ui).

## Màu

| Token                                 | Vai trò                                                      | Class Tailwind                             |
| ------------------------------------- | ------------------------------------------------------------ | ------------------------------------------ |
| `--background`                        | Nền vùng làm việc (trắng ấm)                                 | `bg-background`                            |
| `--card`                              | Thẻ, bảng, panel                                             | `bg-card`                                  |
| `--foreground` / `--muted-foreground` | Chữ chính / phụ                                              | `text-foreground`, `text-muted-foreground` |
| `--primary` (+ `--primary-hover`)     | Màu nhấn vàng đồng: nút chính, active, focus ring            | `bg-primary`, `text-primary`               |
| `--sidebar*`                          | Sidebar nâu đen, chữ, nền hover, viền, màu nhấn trên nền tối | `bg-sidebar`, `text-sidebar-primary`…      |
| `--border` / `--input`                | Viền                                                         | `border`, `border-input`                   |

### Tone trạng thái

Mọi trạng thái ánh xạ về 6 tone trong [`lib/labels.ts`](../apps/web/src/lib/labels.ts). **Không** tự chọn màu cho trạng thái trong component.

| Tone         | Dùng cho                                    |
| ------------ | ------------------------------------------- |
| `success`    | Hoàn thành, Đang bán, Đã đăng               |
| `processing` | Đang tạo kịch bản/giọng đọc/ảnh, Đang xử lý |
| `info`       | Đang dựng video, Đã lên lịch                |
| `warning`    | Chờ kiểm duyệt, Đã hủy, Lưu trữ             |
| `danger`     | Thất bại                                    |
| `neutral`    | Chờ xử lý, Bản nháp                         |

Dùng `<StatusBadge meta={VIDEO_STATUS_META[status]} />`. Tone `processing`/`info` có chấm nhấp nháy.

## Typography

- Font: **Be Vietnam Pro** (subset `vietnamese`), weight 400/500/600/700, biến `--font-be-vietnam`.
- Tiêu đề trang `text-xl sm:text-2xl font-semibold`; tiêu đề khối `font-semibold`; nhãn trường `text-sm font-medium`.
- Chữ phụ `text-xs text-muted-foreground`; thêm cỡ `text-2xs` (11px).
- Số liệu dùng class `tabular` (chữ số đều độ rộng).

## Khoảng cách, bo góc, layout

- Thang spacing mặc định của Tailwind (bội số 4px). Padding trang `p-4 sm:p-6`, khoảng cách khối `gap-4`/`gap-5`.
- Bo góc: `--radius` 10px → `rounded-md` (control), `rounded-lg` (ô nhỏ), `rounded-xl` (thẻ/panel).
- Layout: `--sidebar-width` 15.5rem, `--sidebar-width-collapsed` 4.25rem, `--topbar-height` 3.75rem.
- Breakpoint: sidebar cố định từ `lg` (1024px); dưới `lg` dùng ngăn kéo.
- Studio (Video Factory, Lịch đăng): `lg:grid-cols-[minmax(300px,25%)_minmax(0,1fr)]`, panel trái cuộn độc lập.

## Quy tắc UX

- Toàn trang **không tràn ngang**; bảng rộng đặt `minWidth` trong `DataTable` và cuộn trong khung riêng, cột thao tác ghim phải.
- Mọi dữ liệu không thật gắn `DemoBadge` (DEMO / NHÁP CỤC BỘ / KHUNG MẪU) và có `DemoNotice` giải thích phạm vi.
- Chức năng chưa có backend: dùng `UnavailableButton` (disabled + tooltip lý do + phase dự kiến). Không giả vờ thành công.
- Mọi trang có loading skeleton, empty state, error state có nút thử lại.
- Toast (sonner) cho phản hồi thao tác; `ConfirmDialog` cho thao tác xoá/ẩn.
- Truy cập bàn phím: focus ring vàng `ring-ring/50`, skip link "Bỏ qua tới nội dung chính", `OptionChips` hỗ trợ phím mũi tên,
  nhãn `aria-label` tiếng Việt cho nút chỉ có icon.
- Thời gian hiển thị `dd/MM/yyyy HH:mm` theo Asia/Ho_Chi_Minh (`formatDateTime`); tiền `formatVnd`.
