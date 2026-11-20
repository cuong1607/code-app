import { randomUUID } from 'node:crypto';
import {
  IMAGE_ASPECTS,
  type ImageProviderCapabilities,
  type ImageProviderOutput,
  type ImageProviderRequest,
  type ProviderHealth,
  type ProviderInfo,
} from '@acs/shared';
import { ProviderCallError } from '../../providers/provider-error';
import { renderMockImage } from '../image-processing';
import { BaseImageProvider } from './base-image-provider';

export const MOCK_IMAGE_MODEL = 'mock-image-v1';

/** Hành vi giả lập cho test: lỗi tạm thời N lần, lỗi vĩnh viễn, trả dữ liệu hỏng, chờ lâu. */
export type MockImageBehavior =
  | { kind: 'ok' }
  | { kind: 'transient'; times: number }
  | { kind: 'refusal' }
  | { kind: 'corrupt' }
  | { kind: 'delay'; ms: number }
  /** Trả ảnh sai tỷ lệ (vuông) để kiểm tra pad */
  | { kind: 'square' };

/**
 * MockImageProvider – KHÔNG gọi AI. Ảnh = ảnh tham chiếu đặt trên nền màu + dải "MOCK – KHÔNG PHẢI ẢNH AI".
 * Chỉ bật khi AI_MOCK_PROVIDER_ENABLED=true (cấm production). Dùng cho test & dev offline.
 */
export class MockImageProvider extends BaseImageProvider {
  readonly info: ProviderInfo = { id: 'mock', kind: 'image', displayName: 'Mock (không phải AI)' };
  readonly isMock = true;
  readonly calls: ImageProviderRequest[] = [];
  private behaviors: MockImageBehavior[] = [];
  private transientLeft = 0;

  /** Đặt hành vi cho các lời gọi tiếp theo (theo thứ tự); hết danh sách -> 'ok'. */
  setBehaviors(behaviors: MockImageBehavior[]) {
    this.behaviors = [...behaviors];
    this.transientLeft = 0;
  }

  isConfigured(): boolean {
    return true;
  }

  getCapabilities(): ImageProviderCapabilities {
    return {
      supportsEditing: true,
      maxReferenceImages: 10,
      nativeAspects: IMAGE_ASPECTS,
      negativePrompt: false,
      maxImagesPerRequest: 1,
      async: false,
      resolution: '1080p (mock)',
      pricePerImageUsd: 0,
      pricingSource: 'Mock – không phát sinh chi phí',
      notes: ['Ảnh MOCK chỉ để kiểm thử luồng, KHÔNG phải ảnh AI.'],
    };
  }

  protected async callProvider(req: ImageProviderRequest): Promise<ImageProviderOutput> {
    this.calls.push(req);
    if (this.transientLeft > 0) {
      this.transientLeft -= 1;
      throw new ProviderCallError('overloaded', 'Mock: lỗi tạm thời', 503);
    }
    const behavior = this.behaviors.shift() ?? { kind: 'ok' };
    if (behavior.kind === 'transient') {
      this.transientLeft = behavior.times - 1;
      throw new ProviderCallError('overloaded', 'Mock: lỗi tạm thời', 503);
    }
    if (behavior.kind === 'refusal') throw new ProviderCallError('refusal', 'Mock: từ chối');
    if (behavior.kind === 'delay') {
      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(resolve, behavior.ms);
        req.signal?.addEventListener('abort', () => {
          clearTimeout(t);
          reject(new ProviderCallError('timeout', 'Mock: huỷ'));
        });
      });
    }
    const usage = { inputTokens: null, outputTokens: null };
    if (behavior.kind === 'corrupt') {
      return {
        data: Buffer.from('not an image'),
        mimeType: 'image/png',
        model: MOCK_IMAGE_MODEL,
        usage,
        note: null,
        providerRequestId: null,
      };
    }
    const ref = req.references[0];
    if (!ref) throw new ProviderCallError('bad_request', 'Mock: thiếu ảnh tham chiếu');
    const data = await renderMockImage(
      ref.data,
      behavior.kind === 'square' ? '1:1' : req.aspect,
      randomUUID(),
      `Mock ${req.aspect}`,
    );
    return {
      data,
      mimeType: 'image/png',
      model: MOCK_IMAGE_MODEL,
      usage,
      note: null,
      providerRequestId: null,
    };
  }

  validateConfiguration(): Promise<ProviderHealth> {
    return Promise.resolve({ available: true, message: 'Mock provider – không gọi AI thật' });
  }
}
