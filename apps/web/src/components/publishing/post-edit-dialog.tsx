'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { type PublishingDraft, utcIsoToVnLocalInput, vnLocalInputToUtcIso } from '@acs/shared';
import { Field, StatusBadge } from '@/components/common';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { describeError } from '@/lib/api/client';
import { parseHashtags } from '@/lib/format';
import { PUBLISH_MODE_LABEL, PUBLISH_STATUS_META } from '@/lib/labels';
import { TIKTOK_CAPTION_MAX } from './schedule';

/** Sửa bài đăng nháp (caption, hashtag, giờ đăng) – lưu vào database. */
export function PostEditDialog({
  post,
  onOpenChange,
  onSave,
}: {
  post: PublishingDraft;
  onOpenChange: (open: boolean) => void;
  onSave: (patch: { caption: string; hashtags: string[]; scheduledAt: string }) => Promise<void>;
}) {
  const [caption, setCaption] = useState(post.caption);
  const [tags, setTags] = useState(post.hashtags.join(' '));
  const [when, setWhen] = useState(utcIsoToVnLocalInput(post.scheduledAt));
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (caption.length > TIKTOK_CAPTION_MAX)
      return setError(`Caption tối đa ${TIKTOK_CAPTION_MAX} ký tự`);
    let scheduledAt: string;
    try {
      scheduledAt = vnLocalInputToUtcIso(when);
    } catch {
      return setError('Thời gian không hợp lệ');
    }
    setSaving(true);
    try {
      await onSave({ caption, hashtags: parseHashtags(tags), scheduledAt });
      toast.success('Đã lưu bài đăng nháp');
      onOpenChange(false);
    } catch (e) {
      setError(describeError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Chỉnh sửa bài đăng nháp</DialogTitle>
          <DialogDescription>
            {post.videoName} · {PUBLISH_MODE_LABEL[post.mode]} ·{' '}
            {post.accountRef ?? 'chưa gắn kênh'}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-3">
          <StatusBadge meta={PUBLISH_STATUS_META[post.status]} />
          <Field
            label="Caption"
            htmlFor="pe-caption"
            hint={`${caption.length}/${TIKTOK_CAPTION_MAX}`}
            error={error}
          >
            <Textarea
              id="pe-caption"
              rows={4}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
            />
          </Field>
          <Field label="Hashtag" htmlFor="pe-tags">
            <Input id="pe-tags" value={tags} onChange={(e) => setTags(e.target.value)} />
          </Field>
          <Field label="Ngày giờ dự kiến (giờ VN)" htmlFor="pe-when">
            <Input
              id="pe-when"
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
            />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Huỷ
          </Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? 'Đang lưu…' : 'Lưu'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
