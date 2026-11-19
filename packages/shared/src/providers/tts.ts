import type { BaseProvider, ProviderCallOptions, ProviderUsage } from './common';

export interface VoiceInfo {
  id: string;
  name: string;
  /** Ví dụ "vi-VN" */
  locale: string;
  gender?: 'male' | 'female' | 'neutral';
}

export interface TextToSpeechRequest {
  text: string;
  voiceId: string;
  /** Mặc định "vi-VN" */
  locale?: string;
  speed?: number;
  format?: 'mp3' | 'wav';
}

export interface TextToSpeechResult {
  storageKey: string;
  mimeType: string;
  durationSeconds: number;
  usage?: ProviderUsage;
}

export interface TextToSpeechProvider extends BaseProvider {
  listVoices(locale?: string): Promise<VoiceInfo[]>;
  synthesize(
    request: TextToSpeechRequest,
    options?: ProviderCallOptions,
  ): Promise<TextToSpeechResult>;
}
