'use client';

import { CalendarPlus, Clock, Link2, Send } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { PUBLISH_MODES, utcIsoToVnLocalInput } from '@acs/shared';
import {
  EmptyState,
  Field,
  LoadingState,
  MediaPreview,
  OptionChips,
  SectionCard,
  UnavailableButton,
  UnavailableChip,
} from '@/components/common';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { describeError } from '@/lib/api/client';
import { formatDateTime } from '@/lib/format';
import { PUBLISH_MODE_LABEL } from '@/lib/labels';
import { cn } from '@/lib/utils';
import { hueFromString } from '@/types/domain';
import {
  INTERVAL_OPTIONS,
  TIKTOK_CAPTION_MAX,
  computeSchedule,
  validateSchedule,
} from './schedule';
import type { PublishingState } from './use-publishing';

const intervalLabel = (m: number) => (m < 60 ? `${m} phút` : `${m / 60} giờ`);

function nextHourVn(): string {
  const d = new Date(Date.now() + 119 * 60_000);
  d.setUTCMinutes(0, 0, 0);
  return utcIsoToVnLocalInput(d);
}

function tomorrowAt8Vn(): string {
  const nowVn = utcIsoToVnLocalInput(new Date());
  const date = new Date(`${nowVn.slice(0, 10)}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return `${date.toISOString().slice(0, 10)}T08:00`;
}

export function PublishConfigPanel({ state }: { state: PublishingState }) {
  const { config, update, hashtags, videos, videosLoading, createDrafts, creating } = state;
  // Lỗi chỉ hiện sau khi bấm "Tạo lịch đăng" (validate trong event handler vì cần Date.now())
  const [errors, setErrors] = useState<string[]>([]);
  const showErrors = errors.length > 0;

  const preview = useMemo(() => {
    if (config.mode !== 'scheduled' || !config.startLocal || !config.videoIds.length) return [];
    try {
      return computeSchedule({
        startLocal: config.startLocal,
        intervalMinutes: config.intervalMinutes,
        count: Math.min(config.videoIds.length, 4),
      });
    } catch {
      return [];
    }
  }, [config.mode, config.startLocal, config.intervalMinutes, config.videoIds.length]);

  const toggleVideo = (id: string) =>
    update(
      'videoIds',
      config.videoIds.includes(id)
        ? config.videoIds.filter((v) => v !== id)
        : [...config.videoIds, id],
    );

  const submit = async () => {
    const validation = validateSchedule({
      mode: config.mode,
      startLocal: config.startLocal,
      videoCount: config.videoIds.length,
      requireAccount: false, // chưa có tài khoản TikTok kết nối (Phase 08)
      caption: config.caption,
      hashtags,
      nowMs: Date.now(),
    });
    if (!validation.ok) {
      setErrors(validation.errors);
      toast.error('Chưa thể tạo lịch đăng', { description: validation.errors.join('\n') });
      return;
    }
    setErrors([]);
    try {
      const count = await createDrafts();
      toast.success(`Đã lưu ${count} bài đăng nháp`, {
        description: 'Trạng thái "Chờ kiểm duyệt" – lưu trong database, CHƯA gửi lên TikTok.',
      });
      update('videoIds', []);
    } catch (error) {
      toast.error('Không lưu được lịch đăng', { description: describeError(error) });
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <SectionCard step={1} title="Tài khoản & video">
        <Field
          label="Tài khoản TikTok"
          htmlFor="pub-account"
          badge={
            <UnavailableChip reason="Kết nối OAuth TikTok – dự kiến Phase 08" label="Phase 08" />
          }
        >
          <NativeSelect
            id="pub-account"
            value=""
            disabled
            placeholder="Chưa có tài khoản kết nối"
            options={[]}
          />
        </Field>
        <p className="text-muted-foreground -mt-2 text-xs">
          Bài nháp được lưu chưa gắn kênh; gán kênh khi đã kết nối TikTok.
        </p>
        <UnavailableButton
          size="sm"
          variant="outline"
          reason="Kết nối tài khoản TikTok thật cần OAuth phía server – dự kiến Phase 08"
        >
          <Link2 /> Kết nối tài khoản TikTok
        </UnavailableButton>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              Chọn video <span className="text-danger">*</span>
            </span>
            <Badge variant={config.videoIds.length ? 'default' : 'secondary'} className="tabular">
              {config.videoIds.length}/{videos.length}
            </Badge>
          </div>
          {videosLoading ? (
            <LoadingState rows={3} />
          ) : videos.length === 0 ? (
            <EmptyState
              className="py-4"
              title="Chưa có luồng video"
              description={
                <>
                  Tạo luồng sản xuất ở{' '}
                  <Link href="/studio/videos" className="text-info underline">
                    Xưởng video
                  </Link>{' '}
                  trước.
                </>
              }
            />
          ) : (
            <ul
              className={cn(
                'scrollbar-thin flex max-h-52 flex-col gap-1 overflow-y-auto rounded-lg border p-1',
                showErrors && !config.videoIds.length && 'border-danger',
              )}
            >
              {videos.map((v) => {
                const checked = config.videoIds.includes(v.id);
                return (
                  <li key={v.id}>
                    <label
                      className={cn(
                        'flex cursor-pointer items-center gap-2 rounded-md p-1.5',
                        checked ? 'bg-primary/10' : 'hover:bg-accent/60',
                      )}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleVideo(v.id)}
                        aria-label={`Chọn ${v.name}`}
                      />
                      <MediaPreview
                        image={{
                          id: v.id,
                          url: v.images[0]?.previewUrl ?? undefined,
                          hue: hueFromString(v.id),
                        }}
                        aspect="9:16"
                        kind="video"
                        className="w-7"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-1 text-xs font-medium">{v.name}</span>
                        <span className="text-muted-foreground text-[11px]">
                          {v.config.durationSec}s · {v.config.aspectRatio} · chưa render
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="flex gap-2">
            <Button
              size="xs"
              variant="ghost"
              onClick={() =>
                update(
                  'videoIds',
                  videos.map((v) => v.id),
                )
              }
              disabled={!videos.length}
            >
              Chọn tất cả
            </Button>
            <Button
              size="xs"
              variant="ghost"
              onClick={() => update('videoIds', [])}
              disabled={!config.videoIds.length}
            >
              Bỏ chọn
            </Button>
          </div>
        </div>
      </SectionCard>

      <SectionCard step={2} title="Nội dung mặc định">
        <Field
          label="Caption mặc định"
          htmlFor="pub-caption"
          hint={`Dùng {product} để chèn tên sản phẩm · ${config.caption.length}/${TIKTOK_CAPTION_MAX}`}
          error={
            config.caption.length > TIKTOK_CAPTION_MAX
              ? `Caption tối đa ${TIKTOK_CAPTION_MAX} ký tự`
              : undefined
          }
        >
          <Textarea
            id="pub-caption"
            rows={3}
            value={config.caption}
            onChange={(e) => update('caption', e.target.value)}
          />
        </Field>
        <Field
          label="Hashtag mặc định"
          htmlFor="pub-tags"
          hint="Cách nhau bởi dấu cách hoặc dấu phẩy"
        >
          <Input
            id="pub-tags"
            value={config.hashtags}
            onChange={(e) => update('hashtags', e.target.value)}
          />
        </Field>
        {hashtags.length ? (
          <div className="-mt-1.5 flex flex-wrap gap-1">
            {hashtags.map((tag) => (
              <span
                key={tag}
                className="bg-info/10 text-info rounded px-1.5 py-0.5 text-[11px] font-medium"
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}
        <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed p-2.5">
          <div className="min-w-0">
            <p className="text-sm font-medium">Gắn sản phẩm / giỏ hàng</p>
            <p className="text-muted-foreground text-xs">
              Phụ thuộc quyền TikTok Shop của tài khoản
            </p>
          </div>
          <div className="flex items-center gap-2">
            <UnavailableChip reason="Gắn giỏ hàng cần tích hợp TikTok Shop – chưa hỗ trợ" />
            <Switch checked={false} disabled aria-label="Gắn giỏ hàng (chưa hỗ trợ)" />
          </div>
        </div>
      </SectionCard>

      <SectionCard step={3} title="Thời gian đăng">
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Chế độ đăng</span>
          <OptionChips
            label="Chế độ đăng"
            value={config.mode}
            onChange={(v) => update('mode', v)}
            options={PUBLISH_MODES.map((m) => ({ value: m, label: PUBLISH_MODE_LABEL[m] }))}
          />
        </div>
        {config.mode === 'scheduled' ? (
          <>
            <Field
              label="Bắt đầu đăng lúc"
              htmlFor="pub-start"
              required
              hint="Giờ Việt Nam (UTC+7) · hệ thống lưu dạng UTC"
              error={errors.find((e) => e.toLowerCase().includes('thời gian'))}
            >
              <Input
                id="pub-start"
                type="datetime-local"
                value={config.startLocal}
                onChange={(e) => update('startLocal', e.target.value)}
                aria-invalid={errors.some((e) => e.toLowerCase().includes('thời gian'))}
              />
            </Field>
            <div className="-mt-1.5 flex flex-wrap gap-1.5">
              <Button
                size="xs"
                variant="outline"
                onClick={() => update('startLocal', nextHourVn())}
              >
                <Clock /> Giờ tới
              </Button>
              <Button
                size="xs"
                variant="outline"
                onClick={() => update('startLocal', tomorrowAt8Vn())}
              >
                Sáng mai 08:00
              </Button>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Khoảng cách giữa các bài</span>
              <OptionChips
                label="Khoảng cách giữa các bài"
                size="sm"
                value={config.intervalMinutes}
                onChange={(v) => update('intervalMinutes', v)}
                options={INTERVAL_OPTIONS.map((m) => ({ value: m, label: intervalLabel(m) }))}
              />
            </div>
            {preview.length ? (
              <div className="bg-muted/60 rounded-lg p-2.5">
                <p className="mb-1.5 text-xs font-medium">Xem trước lịch (giờ VN)</p>
                <ol className="flex flex-col gap-1 text-xs">
                  {preview.map((iso, i) => (
                    <li key={iso} className="tabular flex justify-between">
                      <span className="text-muted-foreground">Bài {i + 1}</span>
                      <span className="font-medium">{formatDateTime(iso)}</span>
                    </li>
                  ))}
                  {config.videoIds.length > preview.length ? (
                    <li className="text-muted-foreground">
                      … và {config.videoIds.length - preview.length} bài nữa
                    </li>
                  ) : null}
                </ol>
              </div>
            ) : null}
          </>
        ) : (
          <p className="text-muted-foreground text-xs">
            {config.mode === 'immediate'
              ? 'Bài vào hàng chờ kiểm duyệt; đăng ngay sau khi duyệt (khi có tích hợp TikTok).'
              : 'Video sẽ được gửi vào mục nháp của TikTok để bạn tự đăng (khi có tích hợp TikTok).'}
          </p>
        )}
      </SectionCard>

      <div className="bg-card flex flex-col gap-2 rounded-xl border p-3.5 shadow-xs">
        {showErrors ? (
          <ul className="text-danger list-inside list-disc text-xs" role="alert">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        ) : null}
        <Button onClick={() => void submit()} disabled={creating}>
          <CalendarPlus /> {creating ? 'Đang lưu…' : `Tạo lịch đăng (${config.videoIds.length})`}
        </Button>
        <UnavailableButton
          variant="dark"
          reason="Gửi bài lên TikTok cần OAuth & Content Posting API – dự kiến Phase 08"
        >
          <Send /> Gửi lên TikTok
        </UnavailableButton>
        <p className="text-muted-foreground text-center text-[11px]">
          Lịch đăng được lưu nháp trong database, chưa đăng thật.
        </p>
      </div>
    </div>
  );
}
