/**
 * SEED dữ liệu mẫu cho môi trường phát triển.
 * - Idempotent: chạy nhiều lần không tạo trùng, KHÔNG ghi đè dữ liệu người dùng đã sửa.
 * - Sản phẩm mẫu có source_type = 'seed' -> giao diện gắn nhãn "MẪU".
 * - Không tạo ảnh giả: thư viện media để trống cho tới khi người dùng upload ảnh thật.
 * Chạy: pnpm db:seed
 */
import { PrismaClient } from '@prisma/client';
import { DEV_WORKSPACE_ID, normalizeSearchText } from '@acs/shared';

const prisma = new PrismaClient();

const SAMPLES: {
  sku: string;
  name: string;
  category: string;
  brand?: string;
  cost?: number;
  price: number;
  status: 'draft' | 'active' | 'archived';
  attrs?: Record<string, string>;
}[] = [
  {
    sku: 'MAU-TT-001',
    name: 'Áo thun cotton oversize',
    category: 'Thời trang',
    brand: 'Mẫu Basic',
    cost: 85000,
    price: 189000,
    status: 'active',
    attrs: { 'Màu sắc': 'Trắng', 'Kích thước': 'M, L, XL', 'Chất liệu': 'Cotton 100%' },
  },
  {
    sku: 'MAU-TT-002',
    name: 'Quần jean ống suông',
    category: 'Thời trang',
    brand: 'Mẫu Denim',
    cost: 210000,
    price: 429000,
    status: 'active',
    attrs: { 'Màu sắc': 'Xanh nhạt', 'Kích thước': '28–32' },
  },
  {
    sku: 'MAU-TT-003',
    name: 'Váy hoa nhí dáng dài',
    category: 'Thời trang',
    cost: 160000,
    price: 365000,
    status: 'draft',
  },
  {
    sku: 'MAU-MP-001',
    name: 'Serum vitamin C 30ml',
    category: 'Mỹ phẩm',
    brand: 'Mẫu Beauty',
    cost: 120000,
    price: 289000,
    status: 'active',
    attrs: { 'Dung tích': '30ml' },
  },
  {
    sku: 'MAU-MP-002',
    name: 'Kem chống nắng SPF50+',
    category: 'Mỹ phẩm',
    brand: 'Mẫu Beauty',
    cost: 98000,
    price: 245000,
    status: 'active',
  },
  {
    sku: 'MAU-MP-003',
    name: 'Son kem lì màu đỏ gạch',
    category: 'Mỹ phẩm',
    cost: 55000,
    price: 159000,
    status: 'archived',
  },
  {
    sku: 'MAU-NT-001',
    name: 'Ghế thư giãn gỗ sồi',
    category: 'Nội thất',
    brand: 'Mẫu Home',
    cost: 1350000,
    price: 2450000,
    status: 'active',
    attrs: { 'Chất liệu': 'Gỗ sồi', 'Kích thước': '70×80×95 cm' },
  },
  {
    sku: 'MAU-NT-002',
    name: 'Đèn bàn gốm thủ công',
    category: 'Nội thất',
    cost: 320000,
    price: 690000,
    status: 'active',
  },
  {
    sku: 'MAU-AT-001',
    name: 'Cà phê rang xay 500g',
    category: 'Ẩm thực',
    brand: 'Mẫu Coffee',
    cost: 90000,
    price: 175000,
    status: 'active',
  },
  {
    sku: 'MAU-AT-002',
    name: 'Trà ô long túi lọc',
    category: 'Ẩm thực',
    cost: 42000,
    price: 98000,
    status: 'draft',
  },
  {
    sku: 'MAU-GD-001',
    name: 'Nồi chiên không dầu 5L',
    category: 'Gia dụng',
    brand: 'Mẫu Kitchen',
    cost: 980000,
    price: 1690000,
    status: 'active',
  },
  {
    sku: 'MAU-GD-002',
    name: 'Bình giữ nhiệt 750ml',
    category: 'Gia dụng',
    cost: 105000,
    price: 229000,
    status: 'active',
  },
];

async function main() {
  const workspaceId = process.env.DEV_WORKSPACE_ID || DEV_WORKSPACE_ID;
  await prisma.workspace.upsert({
    where: { id: workspaceId },
    create: { id: workspaceId, name: 'Workspace phát triển', slug: 'dev-local' },
    update: {},
  });
  await prisma.applicationSettings.upsert({
    where: { workspaceId },
    create: { workspaceId },
    update: {},
  });

  let created = 0;
  for (const s of SAMPLES) {
    const existing = await prisma.product.findUnique({
      where: { workspaceId_sku: { workspaceId, sku: s.sku } },
    });
    if (existing) continue;
    await prisma.product.create({
      data: {
        workspaceId,
        sku: s.sku,
        name: s.name,
        category: s.category,
        brand: s.brand ?? null,
        description: `Sản phẩm MẪU do seed tạo để thử nghiệm hệ thống – "${s.name}".`,
        costPrice: s.cost ?? null,
        sellingPrice: s.price,
        attributes: s.attrs ?? {},
        status: s.status,
        sourceType: 'seed',
        searchText: normalizeSearchText([s.name, s.sku, s.category, s.brand ?? ''].join(' ')),
      },
    });
    created += 1;
  }
  console.log(
    `[seed] workspace ${workspaceId} · tạo mới ${created}/${SAMPLES.length} sản phẩm mẫu (bỏ qua SKU đã có)`,
  );
}

main()
  .catch((error) => {
    console.error('[seed] lỗi:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
