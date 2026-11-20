import sharp from 'sharp';
import { describe, expect, it, vi } from 'vitest';
import type { ImageProviderRequest } from '@acs/shared';
import { ProviderCallError } from '../providers/provider-error';
import { geminiPricePerImage, IMAGE_ESTIMATE_MARGIN, OPENAI_SIZES } from './image-pricing';
import { mapHttpLikeError } from './providers/base-image-provider';
import {
  GeminiImageProvider,
  type GeminiClientLike,
  type GeminiInteractionResult,
} from './providers/gemini-image-provider';
import { MockImageProvider } from './providers/mock-image-provider';
import {
  OpenAIImageProvider,
  type OpenAIImagesClientLike,
} from './providers/openai-image-provider';

async function png(color = '#3366CC', w = 64, h = 64) {
  return sharp({ create: { width: w, height: h, channels: 3, background: color } })
    .png()
    .toBuffer();
}

const req = async (over: Partial<ImageProviderRequest> = {}): Promise<ImageProviderRequest> => ({
  model: 'gemini-3.1-flash-image',
  prompt: 'TASK: test',
  aspect: '9:16',
  references: [{ data: await png(), mimeType: 'image/png' }],
  timeoutMs: 30_000,
  ...over,
});

function fakeGemini(result: Partial<GeminiInteractionResult> | Error) {
  const create = vi.fn(() =>
    result instanceof Error
      ? Promise.reject(result)
      : Promise.resolve({ id: 'int-1', status: 'completed', ...result } as GeminiInteractionResult),
  );
  const get = vi.fn(() => Promise.resolve({ name: 'models/x' }));
  const client: GeminiClientLike = { interactions: { create }, models: { get } };
  return { client, create, get };
}

describe('GeminiImageProvider (client giả – KHÔNG gọi API thật)', () => {
  it('gửi ảnh tham chiếu inline + prompt + response_format đúng tài liệu, store=false, tắt retry SDK', async () => {
    const out = await png('#FF0000', 72, 128);
    const { client, create } = fakeGemini({
      output_image: { data: out.toString('base64'), mime_type: 'image/png' },
      usage: { total_input_tokens: 1200, total_output_tokens: 1120 },
    });
    const p = new GeminiImageProvider({ imageSize: '1K' }, () => client);
    const res = await p.editImage(await req());
    const [params, options] = create.mock.calls[0]! as unknown as [
      Record<string, unknown>,
      Record<string, unknown>,
    ];
    expect(params).toMatchObject({
      model: 'gemini-3.1-flash-image',
      response_format: { type: 'image', aspect_ratio: '9:16', image_size: '1K' },
      store: false,
    });
    const input = params.input as Array<{ type: string }>;
    expect(input.map((i) => i.type)).toEqual(['image', 'text']);
    expect(options).toMatchObject({ timeout_ms: 30_000, retries: { strategy: 'none' } });
    expect(res.data.equals(out)).toBe(true);
    expect(res.usage).toEqual({ inputTokens: 1200, outputTokens: 1120 });
  });

  it('không có ảnh trả về -> refusal (không retry), kèm ghi chú model', async () => {
    const { client } = fakeGemini({ output_text: 'I cannot create this image.' });
    const p = new GeminiImageProvider({ imageSize: '1K' }, () => client);
    const err = await p.editImage(await req()).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ProviderCallError);
    expect((err as ProviderCallError).kind).toBe('refusal');
    expect((err as ProviderCallError).retryable).toBe(false);
  });

  it('phân loại lỗi HTTP: 429/503 thử lại được, 401/400 thì không', async () => {
    for (const [status, kind, retryable] of [
      [429, 'rate_limit', true],
      [503, 'overloaded', true],
      [401, 'auth', false],
      [400, 'bad_request', false],
    ] as const) {
      const e = Object.assign(new Error('x'), { status });
      const { client } = fakeGemini(e);
      const p = new GeminiImageProvider({ imageSize: '1K' }, () => client);
      const err = (await p.editImage(await req()).catch((x: unknown) => x)) as ProviderCallError;
      expect(err.kind).toBe(kind);
      expect(err.retryable).toBe(retryable);
    }
    expect(mapHttpLikeError(Object.assign(new Error('t'), { name: 'AbortError' })).kind).toBe(
      'timeout',
    );
  });

  it('chặn quá số ảnh tham chiếu theo model, thiếu ảnh tham chiếu khi edit', async () => {
    const { client, create } = fakeGemini({});
    const p = new GeminiImageProvider({ imageSize: '1K' }, () => client);
    const ref = { data: await png(), mimeType: 'image/png' as const };
    await expect(
      p.editImage(await req({ model: 'gemini-3-pro-image', references: Array(7).fill(ref) })),
    ).rejects.toThrow(/tối đa 6/);
    await expect(p.editImage(await req({ references: [] }))).rejects.toThrow(/ít nhất 1/);
    expect(create).not.toHaveBeenCalled();
  });

  it('không có key -> chưa cấu hình; kiểm tra kết nối dùng models.get (không tạo ảnh)', async () => {
    expect(new GeminiImageProvider({ imageSize: '1K' }).isConfigured()).toBe(false);
    expect(
      (await new GeminiImageProvider({ imageSize: '1K' }).validateConfiguration('x')).available,
    ).toBe(false);
    const { client, get, create } = fakeGemini({});
    const ok = await new GeminiImageProvider(
      { imageSize: '1K' },
      () => client,
    ).validateConfiguration('gemini-3.1-flash-image');
    expect(ok.available).toBe(true);
    expect(get).toHaveBeenCalledWith({ model: 'gemini-3.1-flash-image' });
    expect(create).not.toHaveBeenCalled();
  });

  it('đơn giá: model có trong bảng -> ước tính kèm dự phòng; model lạ -> null (không cho chạy)', () => {
    expect(geminiPricePerImage('gemini-3.1-flash-image', '1K')).toBeCloseTo(
      0.067 * IMAGE_ESTIMATE_MARGIN,
    );
    expect(geminiPricePerImage('gemini-unknown', '1K')).toBeNull();
    const caps = new GeminiImageProvider({ imageSize: '1K' }).getCapabilities('model-la');
    expect(caps.pricePerImageUsd).toBeNull();
    expect(caps.negativePrompt).toBe(false);
  });
});

describe('OpenAIImageProvider (client giả)', () => {
  function fakeOpenAI(b64: string | null) {
    const edit = vi.fn(() =>
      Promise.resolve({
        created: 1,
        data: b64 ? [{ b64_json: b64 }] : [],
        usage: { input_tokens: 500, output_tokens: 4000 },
      }),
    );
    const client = {
      images: { edit },
      models: { retrieve: vi.fn() },
    } as unknown as OpenAIImagesClientLike;
    return { client, edit };
  }

  it('gọi images.edit với mảng ảnh, kích thước đúng tỷ lệ, n=1, png', async () => {
    const out = await png('#00FF00', 90, 160);
    const { client, edit } = fakeOpenAI(out.toString('base64'));
    const p = new OpenAIImageProvider({ quality: 'medium', pricePerImageUsd: 0.05 }, () => client);
    const res = await p.editImage(await req({ model: 'gpt-image-x' }));
    const [params] = edit.mock.calls[0]! as unknown as [Record<string, unknown>];
    expect(params).toMatchObject({
      model: 'gpt-image-x',
      size: OPENAI_SIZES['9:16'],
      n: 1,
      output_format: 'png',
      quality: 'medium',
    });
    expect(Array.isArray(params.image)).toBe(true);
    expect(res.usage).toEqual({ inputTokens: 500, outputTokens: 4000 });
  });

  it('kích thước OpenAI thoả ràng buộc tài liệu (bội số 16, đúng tỷ lệ, giới hạn điểm ảnh)', () => {
    const ratio = { '1:1': 1, '4:5': 0.8, '9:16': 9 / 16, '16:9': 16 / 9 } as const;
    for (const [aspect, size] of Object.entries(OPENAI_SIZES)) {
      const [w, h] = size.split('x').map(Number) as [number, number];
      expect(w % 16).toBe(0);
      expect(h % 16).toBe(0);
      expect(Math.max(w, h)).toBeLessThanOrEqual(3840);
      expect(w * h).toBeGreaterThanOrEqual(655_360);
      expect(w * h).toBeLessThanOrEqual(8_294_400);
      expect(w / h).toBeCloseTo(ratio[aspect as keyof typeof ratio], 3);
    }
  });

  it('không cấu hình đơn giá -> pricePerImageUsd null', () => {
    expect(
      new OpenAIImageProvider({ quality: 'low', pricePerImageUsd: null }).getCapabilities()
        .pricePerImageUsd,
    ).toBeNull();
  });

  it('không có ảnh trả về -> refusal', async () => {
    const { client } = fakeOpenAI(null);
    const p = new OpenAIImageProvider({ quality: 'low', pricePerImageUsd: 0.01 }, () => client);
    await expect(p.editImage(await req({ model: 'm' }))).rejects.toMatchObject({ kind: 'refusal' });
  });
});

describe('MockImageProvider', () => {
  it('tạo ảnh PNG thật có nhãn MOCK, đúng tỷ lệ, mỗi lần một ảnh khác nhau', async () => {
    const p = new MockImageProvider();
    const a = await p.editImage(await req({ model: 'mock-image-v1' }));
    const b = await p.editImage(await req({ model: 'mock-image-v1' }));
    const meta = await sharp(a.data).metadata();
    expect(meta.format).toBe('png');
    expect(meta.width! / meta.height!).toBeCloseTo(9 / 16, 2);
    expect(a.data.equals(b.data)).toBe(false);
    expect(p.isMock).toBe(true);
    expect(p.calls).toHaveLength(2);
  });

  it('hành vi giả lập: lỗi tạm thời, từ chối, dữ liệu hỏng', async () => {
    const p = new MockImageProvider();
    p.setBehaviors([{ kind: 'transient', times: 1 }, { kind: 'refusal' }, { kind: 'corrupt' }]);
    await expect(p.editImage(await req())).rejects.toMatchObject({ kind: 'overloaded' });
    await expect(p.editImage(await req())).rejects.toMatchObject({ kind: 'refusal' });
    const corrupt = await p.editImage(await req());
    expect(corrupt.data.toString()).toBe('not an image');
  });

  it('generateVariations: một ảnh lỗi không làm hỏng các ảnh khác', async () => {
    const p = new MockImageProvider();
    p.setBehaviors([{ kind: 'ok' }, { kind: 'refusal' }, { kind: 'ok' }]);
    const r = await p.generateVariations([await req(), await req(), await req()]);
    expect(r.map((x) => x.ok)).toEqual([true, false, true]);
  });
});
