/**
 * Kiểu dùng riêng ở giao diện. Kiểu dữ liệu nghiệp vụ (Product, MediaAsset, bản nháp…)
 * lấy từ `@acs/shared` – cùng hợp đồng với API.
 */
import type { MediaAsset } from '@acs/shared';

/** Ảnh để hiển thị: URL thật (presigned / blob) hoặc khối màu giữ chỗ khi chưa có ảnh. */
export interface ImageRef {
  id: string;
  url?: string;
  hue: number;
  label?: string;
  isPrimary?: boolean;
}

export type SortDirection = 'asc' | 'desc';

/** Màu giữ chỗ ổn định theo chuỗi (khi sản phẩm chưa có ảnh). */
export function hueFromString(value: string): number {
  let h = 0;
  for (const ch of value) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

export function assetToImageRef(
  asset: Pick<MediaAsset, 'id' | 'previewUrl' | 'filename'>,
  isPrimary?: boolean,
): ImageRef {
  return {
    id: asset.id,
    url: asset.previewUrl ?? undefined,
    hue: hueFromString(asset.id),
    label: asset.filename,
    isPrimary,
  };
}
