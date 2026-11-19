/**
 * PROVIDER INTERFACES (hợp đồng) cho các chức năng AI.
 *
 * Phase 03: ScriptProvider đã có triển khai (Claude, OpenAI, Mock) ở apps/api/src/ai/providers.
 * Image / TTS / Video vẫn chỉ là interface (Phase 04–07).
 * Mọi triển khai cụ thể (Anthropic, OpenAI, ElevenLabs, FFmpeg...) sẽ nằm ở server
 * (apps/api hoặc apps/worker) để API key không bao giờ xuống client.
 */
export * from './common';
export * from './script';
export * from './image';
export * from './tts';
export * from './video';
