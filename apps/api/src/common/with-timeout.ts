export class TimeoutError extends Error {
  constructor(label: string, ms: number) {
    super(`${label} quá thời gian chờ ${ms}ms`);
    this.name = 'TimeoutError';
  }
}

/** Chạy promise với giới hạn thời gian để health check không bị treo. */
export async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(label, ms)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
