import { AppError } from '@acs/shared';

/** Giới hạn tốc độ cửa sổ trượt 60 giây theo khoá (workspace). Bộ nhớ trong tiến trình. */
export class SlidingWindowRateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs = 60_000,
    private readonly now: () => number = Date.now,
  ) {}

  /** Tiêu thụ `cost` lượt; vượt giới hạn -> AppError RATE_LIMITED (429). */
  consume(key: string, cost = 1): void {
    const t = this.now();
    const recent = (this.hits.get(key) ?? []).filter((x) => t - x < this.windowMs);
    if (recent.length + cost > this.limit) {
      const retryAfterSec = Math.ceil((this.windowMs - (t - (recent[0] ?? t))) / 1000);
      this.hits.set(key, recent);
      throw new AppError(
        'RATE_LIMITED',
        `Đã đạt giới hạn ${this.limit} lượt gọi AI mỗi phút. Thử lại sau khoảng ${retryAfterSec} giây.`,
        { retryAfterSec },
      );
    }
    for (let i = 0; i < cost; i += 1) recent.push(t);
    this.hits.set(key, recent);
  }
}

/** Semaphore đơn giản – giới hạn số lời gọi AI đồng thời của cả API. */
export class Semaphore {
  private active = 0;
  private readonly queue: (() => void)[] = [];

  constructor(private readonly max: number) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= this.max) await new Promise<void>((r) => this.queue.push(r));
    this.active += 1;
    try {
      return await fn();
    } finally {
      this.active -= 1;
      this.queue.shift()?.();
    }
  }
}
