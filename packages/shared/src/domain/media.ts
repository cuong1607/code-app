export const MEDIA_KINDS = ['product_image', 'ai_image', 'video', 'audio', 'thumbnail'] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];
