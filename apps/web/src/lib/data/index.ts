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
  type ScriptDraft,
  type ScriptDraftInput,
  type VideoDraft,
  type VideoDraftInput,
  type WorkspaceContext,
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
  scriptDraftSchema,
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

export const scriptDraftRepository = {
  list: (): Promise<ScriptDraft[]> =>
    apiRequest('/drafts/scripts', { schema: z.array(scriptDraftSchema) }),
  create: (input: ScriptDraftInput): Promise<ScriptDraft> =>
    apiRequest('/drafts/scripts', { method: 'POST', body: input, schema: scriptDraftSchema }),
  update: (id: string, input: Partial<ScriptDraftInput>): Promise<ScriptDraft> =>
    apiRequest(`/drafts/scripts/${id}`, {
      method: 'PATCH',
      body: input,
      schema: scriptDraftSchema,
    }),
  remove: (id: string) => apiRequest(`/drafts/scripts/${id}`, { method: 'DELETE' }),
};

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
