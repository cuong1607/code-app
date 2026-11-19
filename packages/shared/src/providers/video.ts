import type { BaseProvider, ProviderCallOptions, ProviderUsage } from './common';

export interface VideoClipInput {
  imageKey?: string;
  videoKey?: string;
  durationSeconds: number;
  overlayText?: string;
}

export interface VideoRenderRequest {
  clips: VideoClipInput[];
  voiceoverKey?: string;
  backgroundMusicKey?: string;
  /** TikTok mặc định 1080x1920 */
  width: number;
  height: number;
  fps?: number;
  subtitles?: { startSeconds: number; endSeconds: number; text: string }[];
}

export interface VideoRenderResult {
  storageKey: string;
  durationSeconds: number;
  mimeType: string;
  usage?: ProviderUsage;
}

/** Có thể là FFmpeg local hoặc một dịch vụ AI video bên ngoài. */
export interface VideoRenderProvider extends BaseProvider {
  render(request: VideoRenderRequest, options?: ProviderCallOptions): Promise<VideoRenderResult>;
}
