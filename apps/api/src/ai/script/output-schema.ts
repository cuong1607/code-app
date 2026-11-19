import { z } from 'zod';
import { SCENE_TYPES, VISUAL_SOURCES } from '@acs/shared';

/**
 * HỢP ĐỒNG ĐẦU RA của AI (Output Contract).
 * - JSON Schema dưới đây gửi cho provider (structured outputs) – chỉ dùng các từ khoá cơ bản
 *   mà cả Anthropic lẫn OpenAI strict mode đều hỗ trợ (type/properties/required/enum/items,
 *   additionalProperties:false).
 * - Zod schema tương ứng kiểm tra LẠI ở server (không tin output chỉ vì đã dùng structured outputs).
 * - AI KHÔNG tạo narration/language/style: server tự ghép để luôn nhất quán.
 */
const str = (description: string) => ({ type: 'string', description });

const sceneJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'index',
    'sceneType',
    'durationHintSeconds',
    'description',
    'visualPrompt',
    'spokenText',
    'overlayText',
    'visualSource',
  ],
  properties: {
    index: { type: 'integer', description: 'Số thứ tự cảnh, bắt đầu từ 1, liên tiếp' },
    sceneType: { type: 'string', enum: [...SCENE_TYPES] },
    durationHintSeconds: { type: 'number', description: 'Thời lượng gợi ý (giây)' },
    description: str('Mô tả ngắn nội dung cảnh (tiếng Việt)'),
    visualPrompt: str('Prompt hình ảnh/video cho cảnh, tiếng Anh, ghi rõ khung 9:16'),
    spokenText: str('Lời thoại tiếng Việt có dấu để đọc thành tiếng – không hashtag/emoji/URL'),
    overlayText: str('Chữ hiển thị trên màn hình (ngắn, có thể rỗng)'),
    visualSource: { type: 'string', enum: [...VISUAL_SOURCES] },
  },
} as const;

export const SCRIPT_OUTPUT_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'hook', 'scenes', 'caption', 'hashtags', 'cta', 'complianceFlags'],
  properties: {
    title: str('Tiêu đề nội bộ của kịch bản'),
    hook: str('Câu hook 3 giây đầu – trùng với lời thoại cảnh 1'),
    scenes: { type: 'array', items: sceneJsonSchema },
    caption: str('Caption đăng TikTok, tiếng Việt, không chứa hashtag'),
    hashtags: { type: 'array', items: str('Hashtag dạng #tukhoa không dấu cách') },
    cta: str('Lời kêu gọi hành động'),
    complianceFlags: {
      type: 'array',
      items: str('Ghi chú khi phải lược bỏ yêu cầu do thiếu dữ kiện hoặc vi phạm quy tắc'),
    },
  },
} as const;

export const SCENE_OUTPUT_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['scene'],
  properties: { scene: sceneJsonSchema },
} as const;

export const CAPTION_OUTPUT_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['caption', 'hashtags', 'cta'],
  properties: {
    caption: str('Caption đăng TikTok, tiếng Việt, không chứa hashtag'),
    hashtags: { type: 'array', items: str('Hashtag dạng #tukhoa không dấu cách') },
    cta: str('Lời kêu gọi hành động'),
  },
} as const;

// ----------------------------------------------------------------- Kiểm tra lại bằng Zod
export const aiSceneSchema = z
  .object({
    index: z.number().int().min(1).max(30),
    sceneType: z.enum(SCENE_TYPES),
    durationHintSeconds: z.number().min(0.5).max(30),
    description: z.string().trim().max(500),
    visualPrompt: z.string().trim().min(1, 'Thiếu visual prompt').max(1500),
    spokenText: z.string().trim().min(1, 'Lời thoại không được rỗng').max(600),
    overlayText: z.string().trim().max(120),
    visualSource: z.enum(VISUAL_SOURCES),
  })
  .strict();

export const aiScriptOutputSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    hook: z.string().trim().min(1, 'Thiếu hook').max(300),
    scenes: z.array(aiSceneSchema).min(2, 'Cần ít nhất 2 cảnh').max(30),
    caption: z.string().trim().min(1, 'Thiếu caption').max(2200),
    hashtags: z.array(z.string().trim().max(61)).max(30),
    cta: z.string().trim().min(1, 'Thiếu CTA').max(300),
    complianceFlags: z.array(z.string().trim().max(300)).max(20),
  })
  .strict();
export type AiScriptOutput = z.infer<typeof aiScriptOutputSchema>;

export const aiSceneOutputSchema = z.object({ scene: aiSceneSchema }).strict();

export const aiCaptionOutputSchema = z
  .object({
    caption: z.string().trim().min(1).max(2200),
    hashtags: z.array(z.string().trim().max(61)).max(30),
    cta: z.string().trim().min(1).max(300),
  })
  .strict();
