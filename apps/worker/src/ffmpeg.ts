import { execFile } from 'node:child_process';
import { toErrorMessage } from '@acs/shared';

export interface FfmpegStatus {
  available: boolean;
  version?: string;
  error?: string;
}

/**
 * Kiểm tra FFmpeg có chạy được không bằng `ffmpeg -version`.
 * Không ném lỗi: trả về available=false kèm lý do để worker vẫn chạy được các job khác.
 */
export function checkFfmpeg(ffmpegPath: string, timeoutMs = 5000): Promise<FfmpegStatus> {
  return new Promise((resolve) => {
    execFile(
      ffmpegPath,
      ['-version'],
      { timeout: timeoutMs, windowsHide: true },
      (error, stdout) => {
        if (error) {
          const code = (error as NodeJS.ErrnoException).code;
          resolve({
            available: false,
            error:
              code === 'ENOENT'
                ? `Không tìm thấy ffmpeg tại "${ffmpegPath}". Cài FFmpeg hoặc đặt FFMPEG_PATH.`
                : toErrorMessage(error),
          });
          return;
        }
        const firstLine = stdout.split(/\r?\n/)[0] ?? '';
        const match = /ffmpeg version (\S+)/.exec(firstLine);
        resolve({ available: true, version: match?.[1] ?? firstLine.trim() });
      },
    );
  });
}
