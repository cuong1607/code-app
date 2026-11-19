import { describe, expect, it } from 'vitest';
import { toErrorMessage } from './errors';

describe('toErrorMessage', () => {
  it('lấy message của Error thường', () => {
    expect(toErrorMessage(new Error('hỏng'))).toBe('hỏng');
  });

  it('gộp lỗi con của AggregateError (message rỗng)', () => {
    const error = new AggregateError(
      [
        new Error('connect ECONNREFUSED ::1:9000'),
        new Error('connect ECONNREFUSED 127.0.0.1:9000'),
      ],
      '',
    );
    expect(toErrorMessage(error)).toBe(
      'connect ECONNREFUSED ::1:9000; connect ECONNREFUSED 127.0.0.1:9000',
    );
  });

  it('dùng code khi message rỗng', () => {
    const error = Object.assign(new Error(''), { code: 'ECONNREFUSED' });
    expect(toErrorMessage(error)).toBe('ECONNREFUSED');
  });

  it('xử lý giá trị không phải Error', () => {
    expect(toErrorMessage('chuỗi')).toBe('chuỗi');
    expect(toErrorMessage({ a: 1 })).toBe('{"a":1}');
  });
});
