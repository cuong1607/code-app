import { describe, expect, it } from 'vitest';
import { checkFfmpeg } from './ffmpeg';

describe('checkFfmpeg', () => {
  it('trả về available=false (không ném lỗi) khi binary không tồn tại', async () => {
    const status = await checkFfmpeg('khong-ton-tai-ffmpeg-xyz');
    expect(status.available).toBe(false);
    expect(status.error).toContain('Không tìm thấy ffmpeg');
  });
});
