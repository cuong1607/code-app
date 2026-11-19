export type ProviderKind = 'script' | 'image' | 'tts' | 'video';

export interface ProviderInfo {
  /** Mã định danh, ví dụ "anthropic", "openai", "elevenlabs" */
  id: string;
  kind: ProviderKind;
  displayName: string;
}

export interface ProviderHealth {
  available: boolean;
  message?: string;
}

/** Interface gốc mà mọi provider phải tuân theo. */
export interface BaseProvider {
  readonly info: ProviderInfo;
  /** Kiểm tra provider đã được cấu hình (có API key, binary...) và sẵn sàng. */
  checkHealth(): Promise<ProviderHealth>;
}

/** Tuỳ chọn chung cho mọi lời gọi provider. */
export interface ProviderCallOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  /** Dùng để truy vết log/chi phí theo job */
  correlationId?: string;
}

export interface ProviderUsage {
  inputTokens?: number;
  outputTokens?: number;
  characters?: number;
  seconds?: number;
  costUsd?: number;
}
