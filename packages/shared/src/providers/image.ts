import type { BaseProvider, ProviderCallOptions, ProviderUsage } from './common';

export interface ImageGenerationRequest {
  prompt: string;
  negativePrompt?: string;
  width: number;
  height: number;
  /** Ảnh sản phẩm tham chiếu (object key trong storage) */
  referenceImageKeys?: string[];
  count?: number;
}

export interface GeneratedImage {
  /** Object key trong storage sau khi lưu */
  storageKey: string;
  mimeType: string;
  width: number;
  height: number;
}

export interface ImageGenerationResult {
  images: GeneratedImage[];
  usage?: ProviderUsage;
}

export interface ImageProvider extends BaseProvider {
  generateImages(
    request: ImageGenerationRequest,
    options?: ProviderCallOptions,
  ): Promise<ImageGenerationResult>;
}
