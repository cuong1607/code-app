/** Hằng số cấu hình & trạng thái của tác vụ sản xuất video. */

export const VIDEO_JOB_STATUSES = [
  'queued',
  'scripting',
  'voicing',
  'imaging',
  'rendering',
  'completed',
  'failed',
  'cancelled',
] as const;
export type VideoJobStatus = (typeof VIDEO_JOB_STATUSES)[number];

/** Các trạng thái được coi là "đang chạy". */
export const RUNNING_VIDEO_STATUSES: readonly VideoJobStatus[] = [
  'scripting',
  'voicing',
  'imaging',
  'rendering',
];

export const ASPECT_RATIOS = ['9:16', '1:1', '4:5', '16:9'] as const;
export type AspectRatio = (typeof ASPECT_RATIOS)[number];

export const VIDEO_DURATIONS = [15, 20, 30, 45, 60] as const;
export type VideoDuration = (typeof VIDEO_DURATIONS)[number];

export const VIDEO_QUALITIES = ['720p', '1080p'] as const;
export type VideoQuality = (typeof VIDEO_QUALITIES)[number];

export const VIDEO_MODES = ['image_slideshow', 'ai_image_to_video', 'hybrid'] as const;
export type VideoMode = (typeof VIDEO_MODES)[number];
