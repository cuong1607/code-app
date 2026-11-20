'use client';

import { ImageIcon } from 'lucide-react';
import { DemoNotice, ErrorState, PageHeader } from '@/components/common';
import { ImageConfigPanel } from './image-config-panel';
import { ImageResults } from './image-results';
import { useImageStudio } from './use-image-studio';

/**
 * XƯỞNG ẢNH AI – Nhà cửa & Đời sống (Phase 04).
 * Panel trái: sản phẩm thật + ảnh gốc (MinIO) + chế độ + bối cảnh + tỷ lệ + provider + chi phí.
 * Bên phải: tác vụ (xử lý nền qua hàng đợi), lưới kết quả, so sánh ảnh gốc, duyệt/từ chối.
 */
export function ImageStudioView() {
  const s = useImageStudio();
  const realReady = s.providers?.providers.some((p) => p.status === 'ready' && !p.isMock);
  return (
    <>
      <PageHeader
        title="Xưởng ảnh AI"
        icon={ImageIcon}
        description="Ảnh quảng cáo chăn ga gối, thảm, chiếu từ ảnh sản phẩm thật – kiểm tra và duyệt trước khi dùng."
      />
      {s.providers && !realReady ? (
        <DemoNotice tone="info">
          Chưa cấu hình nhà cung cấp ảnh AI thật (Gemini/OpenAI) ở server – tạo ảnh AI thật{' '}
          <strong>chưa được xác minh</strong>.
          {s.providers.providers.some((p) => p.isMock && p.status === 'ready')
            ? ' Hiện chỉ có Mock (ảnh có dải chữ MOCK – không phải AI) để thử luồng, và chế độ F ghép ảnh gốc.'
            : ' Vẫn dùng được chế độ F (ghép ảnh gốc, không AI).'}
        </DemoNotice>
      ) : null}
      {s.catalogError || s.providersError ? (
        <ErrorState message={s.catalogError ?? s.providersError} />
      ) : null}
      <div className="grid gap-4 lg:grid-cols-[minmax(320px,30%)_minmax(0,1fr)]">
        <ImageConfigPanel s={s} />
        <ImageResults s={s} />
      </div>
    </>
  );
}
