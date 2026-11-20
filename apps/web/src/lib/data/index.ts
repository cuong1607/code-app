/**
 * TẦNG DỮ LIỆU (repository) – UI chỉ import từ đây.
 *
 * Phase 02: mọi repository gọi NestJS API thật qua proxy cùng origin `/api/backend/*`
 * (xem lib/api/client.ts). Phản hồi được kiểm tra bằng schema Zod DÙNG CHUNG với API.
 * Không còn dữ liệu demo trộn lẫn với dữ liệu thật.
 */
import { z } from 'zod';
import {
  type AppSettings,
  type AppSettingsUpdate,
  type CompleteUploadResponse,
  type DashboardSummary,
  type ImportPreview,
  type ImportRequest,
  type ImportResult,
  type MediaAsset,
  type MediaListQuery,
  type Paginated,
  type Product,
  type ProductDetail,
  type ProductFormValues,
  type ProductListQuery,
  type ProductUpdate,
  type PromptPreset,
  type PromptPresetInput,
  type PublishingDraft,
  type PublishingDraftInput,
  type AiUsageSummary,
  type ProviderCheckResult,
  type Script,
  type ScriptDetail,
  type ScriptDocument,
  type ScriptEstimate,
  type ScriptGenerateRequest,
  type ScriptGenerationResult,
  type ScriptProviderId,
  type ScriptProvidersResponse,
  type ScriptTemplate,
  type VideoDraft,
  type VideoDraftInput,
  type WorkspaceContext,
  type ImageEstimate,
  type ImageGenerateRequestInput,
  type ImageItem,
  type ImageJobDetail,
  type ImageMode,
  type ImageProductContext,
  type ImageProviderCheck,
  type ImageProviderId,
  type ImageProvidersResponse,
  type ImageReviewFlag,
  IMAGE_MODES,
  imageEstimateSchema,
  imageItemSchema,
  imageJobDetailSchema,
  imageJobSchema,
  imageProductContextSchema,
  imageProviderCheckSchema,
  imageProvidersResponseSchema,
  imageTemplateSchema,
  ALLOWED_IMAGE_MIME_TYPES,
  appSettingsSchema,
  completeUploadResponseSchema,
  dashboardSummarySchema,
  importPreviewSchema,
  importResultSchema,
  mediaAssetSchema,
  mediaDownloadUrlSchema,
  paginatedSchema,
  productDetailSchema,
  productSchema,
  promptPresetSchema,
  publishingDraftSchema,
  aiUsageSummarySchema,
  providerCheckResultSchema,
  scriptDetailSchema,
  scriptEstimateSchema,
  scriptGenerationResultSchema,
  scriptProvidersResponseSchema,
  scriptSchema,
  scriptTemplateSchema,
  uploadTicketSchema,
  videoDraftSchema,
  workspaceContextSchema,
} from '@acs/shared';
import { ApiError, apiRequest, buildUrl } from '@/lib/api/client';

export * from '../catalog';

type Query = Record<string, string | number | boolean | undefined>;
const toQuery = (q: object): Query => q as Query;

/** URL tải file đi qua proxy (dùng cho <a href download>). */
export const backendUrl = (path: string, query?: Query) => buildUrl('/api/backend', path, query);

// ---------------------------------------------------------------- Products
export type ProductQuery = Partial<
  Pick<
    ProductListQuery,
    'search' | 'category' | 'status' | 'sortBy' | 'sortDir' | 'page' | 'pageSize'
  >
>;

export const productRepository = {
  list: (q: ProductQuery): Promise<Paginated<Product>> =>
    apiRequest('/products', { query: toQuery(q), schema: paginatedSchema(productSchema) }),
  get: (id: string): Promise<ProductDetail> =>
    apiRequest(`/products/${id}`, { schema: productDetailSchema }),
  categories: (): Promise<string[]> =>
    apiRequest('/products/categories', { schema: z.array(z.string()) }),
  create: (input: ProductFormValues): Promise<ProductDetail> =>
    apiRequest('/products', { method: 'POST', body: input, schema: productDetailSchema }),
  update: (id: string, patch: ProductUpdate | ProductFormValues): Promise<ProductDetail> =>
    apiRequest(`/products/${id}`, { method: 'PATCH', body: patch, schema: productDetailSchema }),
  remove: (id: string) => apiRequest(`/products/${id}`, { method: 'DELETE' }),
  /** Sản phẩm cho các ô chọn (bỏ sản phẩm đã lưu trữ). */
  async options(search?: string): Promise<Product[]> {
    const res = await productRepository.list({
      search,
      pageSize: 100,
      sortBy: 'name',
      sortDir: 'asc',
    });
    return res.items.filter((p) => p.status !== 'archived');
  },
  attachMedia: (id: string, mediaAssetIds: string[]) =>
    apiRequest(`/products/${id}/media`, {
      method: 'POST',
      body: { mediaAssetIds },
      schema: productDetailSchema,
    }),
  detachMedia: (id: string, mediaId: string) =>
    apiRequest(`/products/${id}/media/${mediaId}`, {
      method: 'DELETE',
      schema: productDetailSchema,
    }),
  setPrimary: (id: string, mediaId: string) =>
    apiRequest(`/products/${id}/media/${mediaId}/primary`, {
      method: 'PUT',
      schema: productDetailSchema,
    }),
  reorderMedia: (id: string, mediaAssetIds: string[]) =>
    apiRequest(`/products/${id}/media/order`, {
      method: 'PUT',
      body: { mediaAssetIds },
      schema: productDetailSchema,
    }),
  importFromUrl: (id: string, url: string) =>
    apiRequest(`/products/${id}/media/from-url`, {
      method: 'POST',
      body: { url },
      schema: productDetailSchema,
      timeoutMs: 45_000,
    }),
  exportUrl: (q: ProductQuery, format: 'csv' | 'xlsx') =>
    backendUrl('/products/export', { ...toQuery(q), format }),
};

// ---------------------------------------------------------------- Import
export const importRepository = {
  preview(file: File): Promise<ImportPreview> {
    const form = new FormData();
    form.append('file', file);
    return apiRequest('/products/import/preview', {
      method: 'POST',
      body: form,
      schema: importPreviewSchema,
      timeoutMs: 60_000,
    });
  },
  validate: (req: ImportRequest): Promise<ImportResult> =>
    apiRequest('/products/import/validate', {
      method: 'POST',
      body: req,
      schema: importResultSchema,
      timeoutMs: 60_000,
    }),
  commit: (req: ImportRequest): Promise<ImportResult> =>
    apiRequest('/products/import/commit', {
      method: 'POST',
      body: req,
      schema: importResultSchema,
      timeoutMs: 120_000,
    }),
  templateUrl: (format: 'csv' | 'xlsx') => backendUrl('/products/import/template', { format }),
};

// ---------------------------------------------------------------- Media
export const MAX_UPLOAD_MB = 10;

export const mediaRepository = {
  list: (q: Partial<MediaListQuery>): Promise<Paginated<MediaAsset>> =>
    apiRequest('/media', { query: toQuery(q), schema: paginatedSchema(mediaAssetSchema) }),
  get: (id: string) => apiRequest(`/media/${id}`, { schema: mediaAssetSchema }),
  downloadUrl: (id: string) =>
    apiRequest(`/media/${id}/download-url`, { schema: mediaDownloadUrlSchema }),
  remove: (id: string, force = false) =>
    apiRequest(`/media/${id}`, { method: 'DELETE', query: { force: force || undefined } }),

  /**
   * Upload 1 ảnh theo luồng presigned:
   * 1) xin URL (server kiểm tra loại/dung lượng) -> 2) PUT thẳng lên MinIO -> 3) server xác minh & tạo tài nguyên.
   */
  async upload(file: File, signal?: AbortSignal): Promise<CompleteUploadResponse> {
    if (!(ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(file.type)) {
      throw new ApiError(
        `"${file.name}": chỉ hỗ trợ ảnh JPG, PNG hoặc WebP`,
        0,
        'VALIDATION_ERROR',
      );
    }
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
      throw new ApiError(`"${file.name}" vượt quá ${MAX_UPLOAD_MB} MB`, 0, 'VALIDATION_ERROR');
    }
    const ticket = await apiRequest('/media/uploads', {
      method: 'POST',
      body: { filename: file.name, contentType: file.type, size: file.size },
      schema: uploadTicketSchema,
      signal,
    });
    let put: Response;
    try {
      put = await fetch(ticket.uploadUrl, {
        method: 'PUT',
        headers: ticket.headers,
        body: file,
        signal,
      });
    } catch {
      throw new ApiError(
        'Không tải được file lên storage (MinIO). Kiểm tra dịch vụ storage.',
        0,
        'NETWORK_ERROR',
      );
    }
    if (!put.ok)
      throw new ApiError(
        `Storage từ chối file (HTTP ${put.status})`,
        put.status,
        'SERVICE_UNAVAILABLE',
      );
    return apiRequest(`/media/uploads/${ticket.uploadId}/complete`, {
      method: 'POST',
      schema: completeUploadResponseSchema,
      timeoutMs: 60_000,
      signal,
    });
  },
};

// ---------------------------------------------------------------- Bản nháp
const deleted = z.object({ deleted: z.number() });

export const videoDraftRepository = {
  list: (): Promise<VideoDraft[]> =>
    apiRequest('/drafts/video', { schema: z.array(videoDraftSchema) }),
  create: (drafts: VideoDraftInput[]): Promise<VideoDraft[]> =>
    apiRequest('/drafts/video', {
      method: 'POST',
      body: { drafts },
      schema: z.array(videoDraftSchema),
    }),
  update: (id: string, patch: Partial<Pick<VideoDraftInput, 'name' | 'prompt' | 'config'>>) =>
    apiRequest(`/drafts/video/${id}`, { method: 'PATCH', body: patch, schema: videoDraftSchema }),
  removeMany: (ids: string[]) =>
    apiRequest('/drafts/video/delete', { method: 'POST', body: { ids }, schema: deleted }),
};

export const publishingDraftRepository = {
  list: (): Promise<PublishingDraft[]> =>
    apiRequest('/drafts/publishing', { schema: z.array(publishingDraftSchema) }),
  create: (drafts: PublishingDraftInput[]): Promise<PublishingDraft[]> =>
    apiRequest('/drafts/publishing', {
      method: 'POST',
      body: { drafts },
      schema: z.array(publishingDraftSchema),
    }),
  update: (
    id: string,
    patch: Partial<Pick<PublishingDraftInput, 'caption' | 'hashtags' | 'scheduledAt'>>,
  ) =>
    apiRequest(`/drafts/publishing/${id}`, {
      method: 'PATCH',
      body: patch,
      schema: publishingDraftSchema,
    }),
  removeMany: (ids: string[]) =>
    apiRequest('/drafts/publishing/delete', { method: 'POST', body: { ids }, schema: deleted }),
};

// ---------------------------------------------------------------- AI Script Engine (Phase 03)
export type ScriptListQuery = {
  productId?: string;
  variantGroupId?: string;
  search?: string;
  limit?: number;
};
const AI_TIMEOUT_MS = 285_000;

export const scriptRepository = {
  templates: (): Promise<ScriptTemplate[]> =>
    apiRequest('/scripts/templates', { schema: z.array(scriptTemplateSchema) }),
  providers: (): Promise<ScriptProvidersResponse> =>
    apiRequest('/scripts/providers', { schema: scriptProvidersResponseSchema }),
  checkProvider: (id: ScriptProviderId, model?: string): Promise<ProviderCheckResult> =>
    apiRequest(`/scripts/providers/${id}/check`, {
      method: 'POST',
      body: model ? { model } : {},
      schema: providerCheckResultSchema,
      timeoutMs: 30_000,
    }),
  usageSummary: (): Promise<AiUsageSummary> =>
    apiRequest('/scripts/usage/summary', { schema: aiUsageSummarySchema }),
  /** Dự tính chi phí – KHÔNG gọi AI */
  estimate: (req: ScriptGenerateRequest): Promise<ScriptEstimate> =>
    apiRequest('/scripts/estimate', { method: 'POST', body: req, schema: scriptEstimateSchema }),
  generate: (req: ScriptGenerateRequest, signal?: AbortSignal): Promise<ScriptGenerationResult> =>
    apiRequest('/scripts/generate', {
      method: 'POST',
      body: req,
      schema: scriptGenerationResultSchema,
      timeoutMs: AI_TIMEOUT_MS,
      signal,
    }),
  list: (q: ScriptListQuery = {}): Promise<Script[]> =>
    apiRequest('/scripts', { query: toQuery(q), schema: z.array(scriptSchema) }),
  get: (id: string): Promise<ScriptDetail> =>
    apiRequest(`/scripts/${id}`, { schema: scriptDetailSchema }),
  createManual: (input: {
    productId: string | null;
    document: ScriptDocument;
    origin: 'manual' | 'sample';
    templateId?: string | null;
  }): Promise<ScriptDetail> =>
    apiRequest('/scripts', { method: 'POST', body: input, schema: scriptDetailSchema }),
  /** Sửa tay phiên bản đang mở */
  update: (id: string, document: ScriptDocument): Promise<ScriptDetail> =>
    apiRequest(`/scripts/${id}`, {
      method: 'PATCH',
      body: { document },
      schema: scriptDetailSchema,
    }),
  /** Lưu thành phiên bản mới (phiên bản cũ giữ nguyên) */
  saveVersion: (id: string, document: ScriptDocument, changeNote?: string): Promise<ScriptDetail> =>
    apiRequest(`/scripts/${id}/versions`, {
      method: 'POST',
      body: { document, ...(changeNote ? { changeNote } : {}) },
      schema: scriptDetailSchema,
    }),
  regenerateScene: (id: string, index: number, instructions = ''): Promise<ScriptDetail> =>
    apiRequest(`/scripts/${id}/scenes/${index}/regenerate`, {
      method: 'POST',
      body: { instructions },
      schema: scriptDetailSchema,
      timeoutMs: AI_TIMEOUT_MS,
    }),
  regenerateCaption: (id: string, instructions = ''): Promise<ScriptDetail> =>
    apiRequest(`/scripts/${id}/caption/regenerate`, {
      method: 'POST',
      body: { instructions },
      schema: scriptDetailSchema,
      timeoutMs: AI_TIMEOUT_MS,
    }),
  setPreferred: (id: string): Promise<ScriptDetail> =>
    apiRequest(`/scripts/${id}/preferred`, { method: 'PUT', schema: scriptDetailSchema }),
  remove: (id: string) => apiRequest(`/scripts/${id}`, { method: 'DELETE', schema: deleted }),
};
// ---------------------------------------------------------------- AI Image Studio (Phase 04)
const imageCatalogSchema = z.object({
  templates: z.array(imageTemplateSchema),
  modes: z.array(
    z.object({
      id: z.enum(IMAGE_MODES),
      letter: z.string(),
      label: z.string(),
      description: z.string(),
      usesAi: z.boolean(),
    }),
  ),
  styles: z.array(z.object({ id: z.string(), label: z.string(), prompt: z.string() })),
});
export type ImageCatalog = z.infer<typeof imageCatalogSchema>;

export const imageRepository = {
  catalog: (): Promise<ImageCatalog> =>
    apiRequest('/images/templates', { schema: imageCatalogSchema }),
  providers: (): Promise<ImageProvidersResponse> =>
    apiRequest('/images/providers', { schema: imageProvidersResponseSchema }),
  checkProvider: (id: ImageProviderId, model?: string): Promise<ImageProviderCheck> =>
    apiRequest(`/images/providers/${id}/check`, {
      method: 'POST',
      body: model ? { model } : {},
      schema: imageProviderCheckSchema,
      timeoutMs: 30_000,
    }),
  productContext: (productId: string, mode?: ImageMode): Promise<ImageProductContext> =>
    apiRequest(`/images/products/${productId}/context`, {
      query: { mode },
      schema: imageProductContextSchema,
    }),
  /** Ước tính chi phí + xem trước prompt – KHÔNG gọi AI */
  estimate: (req: ImageGenerateRequestInput): Promise<ImageEstimate> =>
    apiRequest('/images/estimate', { method: 'POST', body: req, schema: imageEstimateSchema }),
  /** Tạo tác vụ (xếp hàng). Cùng idempotencyKey -> trả tác vụ cũ, không tạo trùng. */
  createJob: (req: ImageGenerateRequestInput): Promise<ImageJobDetail> =>
    apiRequest('/images/jobs', { method: 'POST', body: req, schema: imageJobDetailSchema }),
  listJobs: (q: { productId?: string; page?: number; pageSize?: number } = {}) =>
    apiRequest('/images/jobs', { query: toQuery(q), schema: paginatedSchema(imageJobSchema) }),
  getJob: (id: string): Promise<ImageJobDetail> =>
    apiRequest(`/images/jobs/${id}`, { schema: imageJobDetailSchema }),
  removeJob: (id: string) =>
    apiRequest(`/images/jobs/${id}`, {
      method: 'DELETE',
      schema: z.object({
        deleted: z.literal(true),
        removedImages: z.number(),
        keptImages: z.number(),
      }),
    }),
  cancelJob: (id: string): Promise<ImageJobDetail> =>
    apiRequest(`/images/jobs/${id}/cancel`, { method: 'POST', schema: imageJobDetailSchema }),
  approve: (itemId: string, input: ImageReviewInputBody = {}): Promise<ImageItem> =>
    apiRequest(`/images/items/${itemId}/approve`, {
      method: 'POST',
      body: input,
      schema: imageItemSchema,
    }),
  reject: (itemId: string, input: ImageReviewInputBody = {}): Promise<ImageItem> =>
    apiRequest(`/images/items/${itemId}/reject`, {
      method: 'POST',
      body: input,
      schema: imageItemSchema,
    }),
  regenerate: (itemId: string): Promise<ImageJobDetail> =>
    apiRequest(`/images/items/${itemId}/regenerate`, {
      method: 'POST',
      schema: imageJobDetailSchema,
    }),
  saveToLibrary: (itemId: string): Promise<ImageItem> =>
    apiRequest(`/images/items/${itemId}/save`, { method: 'POST', schema: imageItemSchema }),
  linkToProduct: (itemId: string): Promise<ImageItem> =>
    apiRequest(`/images/items/${itemId}/link-product`, {
      method: 'POST',
      schema: imageItemSchema,
    }),
  downloadUrl: (itemId: string) =>
    apiRequest(`/images/items/${itemId}/download-url`, { schema: mediaDownloadUrlSchema }),
};
export type ImageReviewInputBody = { note?: string | null; flags?: ImageReviewFlag[] };

export const promptPresetRepository = {
  list: (scope: PromptPreset['scope']): Promise<PromptPreset[]> =>
    apiRequest('/prompt-presets', { query: { scope }, schema: z.array(promptPresetSchema) }),
  create: (
    input: Omit<PromptPresetInput, 'category'> & { category?: string | null },
  ): Promise<PromptPreset> =>
    apiRequest('/prompt-presets', { method: 'POST', body: input, schema: promptPresetSchema }),
  remove: (id: string) => apiRequest(`/prompt-presets/${id}`, { method: 'DELETE' }),
};

// ---------------------------------------------------------------- Cài đặt / workspace / tổng quan
export const settingsRepository = {
  get: (): Promise<AppSettings> => apiRequest('/settings', { schema: appSettingsSchema }),
  update: (patch: AppSettingsUpdate): Promise<AppSettings> =>
    apiRequest('/settings', { method: 'PUT', body: patch, schema: appSettingsSchema }),
};

export const workspaceRepository = {
  current: (): Promise<WorkspaceContext> =>
    apiRequest('/workspace', { schema: workspaceContextSchema }),
};

export const dashboardRepository = {
  summary: (): Promise<DashboardSummary> =>
    apiRequest('/dashboard/summary', { schema: dashboardSummarySchema }),
};

/** Đọc chi tiết lỗi theo trường từ ApiError (422 VALIDATION_ERROR / 409 CONFLICT). */
export function fieldErrorsFrom(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError)) return {};
  const out: Record<string, string> = {};
  if (Array.isArray(error.details)) {
    for (const d of error.details as { path?: string; message?: string }[]) {
      const key = d.path?.split('.')[0];
      if (key && d.message && !out[key]) out[key] = d.message;
    }
  } else if (
    error.code === 'CONFLICT' &&
    (error.details as { field?: string } | undefined)?.field
  ) {
    out[(error.details as { field: string }).field] = error.message;
  }
  return out;
}
