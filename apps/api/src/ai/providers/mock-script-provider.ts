import type {
  CaptionGenerationInput,
  ProviderHealth,
  ProviderInfo,
  SceneRegenerationInput,
  ScriptGenerationInput,
} from '@acs/shared';
import {
  BaseScriptProvider,
  type CompletionRequest,
  type CompletionResponse,
  type ProviderRuntimeConfig,
} from './base-script-provider';
import { ProviderCallError } from './provider-error';

export const MOCK_MODEL = 'mock-script-v1';
export const MOCK_LABEL = '[MOCK]';

/** Hành vi giả lập cho từng lời gọi (unit test retry/sửa lỗi). Hết hàng đợi -> 'ok'. */
export type MockBehavior =
  'ok' | 'invalid_json' | 'invalid_schema' | 'rate_limit' | 'refusal' | 'overloaded';

/**
 * MockScriptProvider – KHÔNG gọi AI thật. Sinh kịch bản xác định từ dữ kiện sản phẩm để:
 *  - chạy unit/integration/E2E test, phát triển offline.
 * Mọi output đều có nhãn [MOCK] và provider = "mock" -> UI hiển thị rõ "KHÔNG PHẢI AI".
 * Bị cấm khi NODE_ENV=production (kiểm tra ở env schema).
 */
export class MockScriptProvider extends BaseScriptProvider {
  readonly info: ProviderInfo = {
    id: 'mock',
    kind: 'script',
    displayName: 'Mock (không phải AI – dùng để test)',
  };
  readonly isMock = true;
  /** Các request đã nhận (để test kiểm tra prompt, vd chống prompt injection) */
  readonly requests: CompletionRequest[] = [];
  behaviors: MockBehavior[] = [];

  constructor(runtime: ProviderRuntimeConfig) {
    super(runtime);
  }

  isConfigured(): boolean {
    return true;
  }

  validateConfiguration(): Promise<ProviderHealth> {
    return Promise.resolve({ available: true, message: 'Mock provider – không gọi AI thật' });
  }

  protected complete(req: CompletionRequest): Promise<CompletionResponse> {
    this.requests.push(req);
    if (this.requests.length > 200) this.requests.shift();
    const behavior = this.behaviors.shift() ?? 'ok';
    const usage = {
      inputTokens: Math.ceil(
        (req.system.length + req.messages.map((m) => m.content).join('').length) / 4,
      ),
      outputTokens: 600,
    };
    switch (behavior) {
      case 'rate_limit':
        return Promise.reject(new ProviderCallError('rate_limit', 'Mock 429', 429));
      case 'overloaded':
        return Promise.reject(new ProviderCallError('overloaded', 'Mock 529', 529));
      case 'refusal':
        return Promise.resolve({ text: '', model: MOCK_MODEL, usage, stopReason: 'refusal' });
      case 'invalid_json':
        return Promise.resolve({
          text: '{"title": "thiếu',
          model: MOCK_MODEL,
          usage,
          stopReason: 'end',
        });
      case 'invalid_schema':
        return Promise.resolve({
          text: JSON.stringify({ title: 'Sai cấu trúc', scenes: [] }),
          model: MOCK_MODEL,
          usage,
          stopReason: 'end',
        });
      default:
        break;
    }
    const body =
      req.task === 'script'
        ? this.script(req.context as ScriptGenerationInput)
        : req.task === 'scene'
          ? this.scene(req.context as SceneRegenerationInput)
          : this.caption(req.context as CaptionGenerationInput);
    return Promise.resolve({
      text: JSON.stringify(body),
      model: MOCK_MODEL,
      usage,
      stopReason: 'end',
    });
  }

  private script(input: ScriptGenerationInput) {
    const { facts, brief, angle, variant } = input;
    const total = brief.durationSeconds;
    const middleCount = total >= 45 ? 4 : total >= 30 ? 3 : 2;
    const hook = 3;
    const cta = 4;
    const each = Math.round(((total - hook - cta) / middleCount) * 10) / 10;
    const attrs = Object.entries(facts.attributes).slice(0, middleCount);
    const source = facts.productImageCount > 0 ? 'PRODUCT_IMAGE' : 'AI_GENERATED_IMAGE';
    const middle = Array.from({ length: middleCount }, (_, i) => {
      const a = attrs[i];
      return {
        index: i + 2,
        sceneType: i === middleCount - 1 ? 'BENEFIT' : 'FEATURE',
        durationHintSeconds: each,
        description: `${MOCK_LABEL} Cảnh giới thiệu đặc điểm ${i + 1}`,
        visualPrompt: `${MOCK_LABEL} Close-up of ${facts.name}, detail shot ${i + 1}, vertical 9:16`,
        spokenText: a
          ? `Điểm đáng chú ý là ${a[0].toLowerCase()} ${a[1]}.`
          : `Sản phẩm thuộc nhóm ${facts.category.toLowerCase()}, dễ dùng hằng ngày.`,
        overlayText: a ? `${a[0]}: ${a[1]}`.slice(0, 60) : facts.category.slice(0, 60),
        visualSource: source,
      };
    });
    const hookText = `Bản mô phỏng số ${variant.index}: bạn đã biết ${facts.name} chưa?`;
    return {
      title: `${MOCK_LABEL} ${facts.name} – ${angle.label}`,
      hook: hookText,
      scenes: [
        {
          index: 1,
          sceneType: 'HOOK',
          durationHintSeconds: hook,
          description: `${MOCK_LABEL} Mở đầu (${angle.label})`,
          visualPrompt: `${MOCK_LABEL} Hero shot of ${facts.name}, vertical 9:16`,
          spokenText: hookText,
          overlayText: 'Gợi ý hôm nay',
          visualSource: source,
        },
        ...middle,
        {
          index: middleCount + 2,
          sceneType: 'CTA',
          durationHintSeconds: cta,
          description: `${MOCK_LABEL} Kêu gọi hành động`,
          visualPrompt: `${MOCK_LABEL} ${facts.name} centered, clean background, vertical 9:16`,
          spokenText: 'Xem thêm chi tiết sản phẩm ở phần mô tả nhé.',
          overlayText: 'Xem chi tiết',
          visualSource: source,
        },
      ],
      caption: `${MOCK_LABEL} Giới thiệu ${facts.name}. Nội dung mô phỏng để kiểm thử, không do AI viết.`,
      hashtags: ['#mock', '#kiemthu', '#sanpham'],
      cta: 'Xem thêm chi tiết sản phẩm',
      complianceFlags: [`${MOCK_LABEL} Nội dung do MockScriptProvider sinh – không phải AI`],
    };
  }

  private scene(input: SceneRegenerationInput) {
    const current = input.document.scenes.find((s) => s.index === input.sceneIndex);
    return {
      scene: {
        index: input.sceneIndex,
        sceneType: current?.sceneType ?? 'FEATURE',
        durationHintSeconds: current?.durationHintSeconds ?? 4,
        description: `${MOCK_LABEL} Cảnh ${input.sceneIndex} đã tạo lại`,
        visualPrompt: `${MOCK_LABEL} New angle of ${input.facts.name}, vertical 9:16`,
        spokenText:
          input.sceneIndex === 1
            ? `Bản mô phỏng mới: ${input.facts.name} có gì đặc biệt?`
            : `Cảnh này được viết lại, nói về ${input.facts.category.toLowerCase()}.`,
        overlayText: 'Đã tạo lại',
        visualSource: current?.visualSource ?? 'PRODUCT_IMAGE',
      },
    };
  }

  private caption(input: CaptionGenerationInput) {
    return {
      caption: `${MOCK_LABEL} Caption mới cho ${input.facts.name} (mô phỏng, không do AI viết).`,
      hashtags: ['#mock', '#captionmoi', '#sanpham'],
      cta: 'Xem chi tiết trong giỏ hàng',
    };
  }
}
