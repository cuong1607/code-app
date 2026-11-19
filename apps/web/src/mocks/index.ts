/**
 * ĐIỂM TẬP TRUNG DỮ LIỆU DEMO.
 * Component KHÔNG import trực tiếp từ đây – hãy đi qua `@/lib/data` (repository),
 * để khi có backend chỉ cần đổi repository, không phải sửa UI.
 */
export * from './catalog';
export { DEMO_DASHBOARD, DEMO_ACTIVITIES } from './dashboard';
export { DEMO_MEDIA } from './media';
export { DEMO_PRODUCTS } from './products';
export { DEMO_PUBLISH_POSTS } from './publishing';
export { buildDemoScript } from './scripts';
export { DEMO_VIDEO_JOBS } from './video-jobs';
