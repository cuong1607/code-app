import { type Job, UnrecoverableError } from 'bullmq';
import { describe, expect, it } from 'vitest';
import { SYSTEM_JOBS, type SystemPingPayload, type SystemPingResult } from '@acs/shared';
import { createSystemProcessor } from './system.processor';

const fakeJob = (name: string, data: unknown) =>
  ({ name, data }) as unknown as Job<SystemPingPayload, SystemPingResult>;

describe('system processor', () => {
  const process = createSystemProcessor('worker-test');

  it('xử lý ping và trả về workerId', async () => {
    const result = await process(
      fakeJob(SYSTEM_JOBS.ping, { requestedAt: new Date().toISOString() }),
    );
    expect(result.workerId).toBe('worker-test');
    expect(result.roundTripMs).toBeGreaterThanOrEqual(0);
  });

  it('payload sai -> UnrecoverableError (không retry)', async () => {
    await expect(process(fakeJob(SYSTEM_JOBS.ping, { requestedAt: 'sai' }))).rejects.toBeInstanceOf(
      UnrecoverableError,
    );
  });

  it('job lạ -> UnrecoverableError', async () => {
    await expect(process(fakeJob('unknown', {}))).rejects.toBeInstanceOf(UnrecoverableError);
  });
});
