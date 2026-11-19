export const PUBLISH_STATUSES = [
  'pending_review',
  'scheduled',
  'processing',
  'published',
  'failed',
] as const;
export type PublishStatus = (typeof PUBLISH_STATUSES)[number];

export const PUBLISH_MODES = ['immediate', 'scheduled', 'draft'] as const;
export type PublishMode = (typeof PUBLISH_MODES)[number];
