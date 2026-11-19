/** DỮ LIỆU DEMO – sản phẩm. Không có trong database. */
import type { ProductStatus } from '@acs/shared';
import type { ImageRef, Product } from '@/types/domain';
import { createRng, minutesAgo } from './rng';

const SEED: { name: string; categoryId: string; price: number }[] = [
  { name: 'Áo thun cotton oversize', categoryId: 'thoi-trang', price: 189000 },
  { name: 'Quần jean ống suông', categoryId: 'thoi-trang', price: 429000 },
  { name: 'Váy hoa nhí dáng dài', categoryId: 'thoi-trang', price: 365000 },
  { name: 'Áo khoác gió 2 lớp', categoryId: 'thoi-trang', price: 499000 },
  { name: 'Sơ mi linen tay ngắn', categoryId: 'thoi-trang', price: 315000 },
  { name: 'Serum vitamin C 30ml', categoryId: 'my-pham', price: 289000 },
  { name: 'Kem chống nắng SPF50+', categoryId: 'my-pham', price: 245000 },
  { name: 'Son kem lì màu đỏ gạch', categoryId: 'my-pham', price: 159000 },
  { name: 'Sữa rửa mặt dịu nhẹ', categoryId: 'my-pham', price: 135000 },
  { name: 'Mặt nạ ngủ cấp ẩm', categoryId: 'my-pham', price: 199000 },
  { name: 'Ghế thư giãn gỗ sồi', categoryId: 'noi-that', price: 2450000 },
  { name: 'Đèn bàn gốm thủ công', categoryId: 'noi-that', price: 690000 },
  { name: 'Kệ sách 5 tầng', categoryId: 'noi-that', price: 1290000 },
  { name: 'Thảm lông phòng khách', categoryId: 'noi-that', price: 850000 },
  { name: 'Cà phê rang xay 500g', categoryId: 'am-thuc', price: 175000 },
  { name: 'Trà ô long túi lọc', categoryId: 'am-thuc', price: 98000 },
  { name: 'Hạt điều rang muối 500g', categoryId: 'am-thuc', price: 215000 },
  { name: 'Mật ong rừng 1 lít', categoryId: 'am-thuc', price: 320000 },
  { name: 'Túi tote canvas in hình', categoryId: 'phu-kien', price: 145000 },
  { name: 'Kính mát gọng tròn', categoryId: 'phu-kien', price: 275000 },
  { name: 'Đồng hồ dây da nam', categoryId: 'phu-kien', price: 1150000 },
  { name: 'Nồi chiên không dầu 5L', categoryId: 'gia-dung', price: 1690000 },
  { name: 'Bình giữ nhiệt 750ml', categoryId: 'gia-dung', price: 229000 },
  { name: 'Máy xay sinh tố mini', categoryId: 'gia-dung', price: 459000 },
];

const STATUS_CYCLE: ProductStatus[] = ['active', 'active', 'active', 'draft', 'active', 'archived'];
const CATEGORY_HUE: Record<string, number> = {
  'thoi-trang': 25,
  'my-pham': 340,
  'noi-that': 45,
  'am-thuc': 95,
  'phu-kien': 210,
  'gia-dung': 175,
};

export function demoImages(productIndex: number, count: number, baseHue: number): ImageRef[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `demo-img-${productIndex + 1}-${i + 1}`,
    hue: (baseHue + i * 24) % 360,
    label: `Ảnh ${i + 1}`,
    isPrimary: i === 0,
  }));
}

const rng = createRng(20261119);

export const DEMO_PRODUCTS: Product[] = SEED.map((seed, index) => {
  const prefix = seed.categoryId.slice(0, 2).toUpperCase();
  return {
    id: `demo-product-${index + 1}`,
    sku: `${prefix}-${String(1001 + index)}`,
    name: seed.name,
    categoryId: seed.categoryId,
    price: seed.price,
    status: STATUS_CYCLE[index % STATUS_CYCLE.length]!,
    images: demoImages(index, rng.int(1, 6), CATEGORY_HUE[seed.categoryId] ?? 30),
    description: `Mô tả mẫu cho "${seed.name}". Đây là dữ liệu DEMO dùng để thiết kế giao diện.`,
    createdAt: minutesAgo(index * 690 + rng.int(5, 300)),
    isDemo: true,
  };
});
