import { describe, expect, it } from 'vitest';
import { type ComponentHealth, computeOverallStatus } from './health';

const up: ComponentHealth = { status: 'up' };
const down: ComponentHealth = { status: 'down' };

describe('computeOverallStatus', () => {
  it('ok khi mọi thành phần up', () => {
    expect(computeOverallStatus({ database: up, redis: up, storage: up, worker: up })).toBe('ok');
  });

  it('degraded khi chỉ worker down', () => {
    expect(computeOverallStatus({ database: up, redis: up, storage: up, worker: down })).toBe(
      'degraded',
    );
  });

  it('down khi thành phần lõi down', () => {
    expect(computeOverallStatus({ database: down, redis: up, storage: up, worker: up })).toBe(
      'down',
    );
  });
});
