/**
 * PROVIDER INTERFACES (hợp đồng) cho các chức năng AI.
 *
 * Giai đoạn 00: CHỈ định nghĩa interface, CHƯA có triển khai nào.
 * Mọi triển khai cụ thể (Anthropic, OpenAI, ElevenLabs, FFmpeg...) sẽ nằm ở server
 * (apps/api hoặc apps/worker) để API key không bao giờ xuống client.
 */
export * from './common';
export * from './script';
export * from './image';
export * from './tts';
export * from './video';
