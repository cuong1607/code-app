import type { BaseProvider, ProviderCallOptions, ProviderUsage } from './common';

export interface ProductInfoForScript {
  name: string;
  description?: string;
  price?: string;
  highlights?: string[];
  targetAudience?: string;
}

export interface ScriptGenerationRequest {
  product: ProductInfoForScript;
  /** Mặc định "vi" */
  language?: string;
  durationSeconds: number;
  tone?: string;
  /** Định dạng nền tảng, ví dụ "tiktok" */
  platform?: string;
}

export interface ScriptScene {
  order: number;
  durationSeconds: number;
  voiceover: string;
  visualPrompt: string;
  onScreenText?: string;
}

export interface ScriptGenerationResult {
  title: string;
  hook: string;
  scenes: ScriptScene[];
  caption: string;
  hashtags: string[];
  usage?: ProviderUsage;
}

export interface ScriptProvider extends BaseProvider {
  generateScript(
    request: ScriptGenerationRequest,
    options?: ProviderCallOptions,
  ): Promise<ScriptGenerationResult>;
}
