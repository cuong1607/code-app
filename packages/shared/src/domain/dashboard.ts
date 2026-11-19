import { z } from 'zod';

export const dashboardSummarySchema = z.object({
  productCount: z.number().int(),
  activeProductCount: z.number().int(),
  imageCount: z.number().int(),
  mediaBytes: z.number().int(),
  /** Phase 02 chưa có video thật: luôn 0 cho tới Phase 06 */
  videoCount: z.number().int(),
  videoDraftCount: z.number().int(),
  publishingDraftCount: z.number().int(),
  scriptDraftCount: z.number().int(),
  batchCount: z.number().int(),
  /** Số sản phẩm tạo mới theo ngày (giờ VN), 14 ngày gần nhất */
  productsPerDay: z.array(z.object({ date: z.string(), count: z.number().int() })),
  recentActivity: z.array(
    z.object({
      id: z.string(),
      kind: z.enum(['product', 'media', 'video_draft', 'publishing_draft', 'script_draft']),
      message: z.string(),
      at: z.iso.datetime(),
    }),
  ),
});
export type DashboardSummary = z.infer<typeof dashboardSummarySchema>;
