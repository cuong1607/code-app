'use client';

import { useState } from 'react';
import { utcIsoToVnLocalInput, vnLocalInputToUtcIso } from '@acs/shared';
import { DemoBadge, DemoNotice, Field, MediaPreview, StatusBadge } from '@/components/common';
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
import { accountById } from '@/lib/data';
import { formatDateTime, parseHashtags } from '@/lib/format';
import { PUBLISH_MODE_LABEL, PUBLISH_STATUS_META } from '@/lib/labels';
import type { PublishPost } from '@/types/domain';
import { TIKTOK_CAPTION_MAX } from './schedule';

/** Xem bài đăng; với NHÁP CỤC BỘ thì cho sửa caption/hashtag/giờ đăng. */
export function PostEditDialog({
  post,
  onOpenChange,
  onSave,
}: {
  post: PublishPost;
  onOpenChange: (open: boolean) => void;
  onSave: (post: PublishPost) => void;
}) {
  const editable = Boolean(post.isLocalDraft);
  const [caption, setCaption] = useState(post.caption);
  const [tags, setTags] = useState(post.hashtags.join(' '));
  const [when, setWhen] = useState(utcIsoToVnLocalInput(post.scheduledAt));
  const [error, setError] = useState<string>();
  const account = accountById(post.accountId);

  const save = () => {
    if (caption.length > TIKTOK_CAPTION_MAX)
      return setError(`Caption tối đa ${TIKTOK_CAPTION_MAX} ký tự`);
    let scheduledAt: string;
    try {
      scheduledAt = vnLocalInputToUtcIso(when);
    } catch {
      return setError('Thời gian không hợp lệ');
    }
    onSave({ ...post, caption, hashtags: parseHashtags(tags), scheduledAt });
    onOpenChange(false);
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle>{editable ? 'Chỉnh sửa bài đăng nháp' : 'Chi tiết bài đăng'}</DialogTitle>
            {post.isLocalDraft ? <DemoBadge label="NHÁP CỤC BỘ" /> : <DemoBadge />}
          </div>
          <DialogDescription>
            {account?.handle ?? post.accountId} · {PUBLISH_MODE_LABEL[post.mode]}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="grid gap-5 sm:grid-cols-[7rem_minmax(0,1fr)]">
            <MediaPreview
              image={post.thumbnail}
              aspect="9:16"
              kind="video"
              className="mx-auto w-28 rounded-lg border"
            />
            <div className="flex min-w-0 flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge meta={PUBLISH_STATUS_META[post.status]} />
                <span className="text-muted-foreground text-xs">{post.videoName}</span>
              </div>
              {post.errorMessage ? (
                <p className="text-danger text-sm">{post.errorMessage}</p>
              ) : null}
              {editable ? (
                <>
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
                </>
              ) : (
                <>
                  <DemoNotice className="text-xs">
                    Bài đăng DEMO chỉ để xem, không chỉnh sửa được.
                  </DemoNotice>
                  <dl className="grid gap-2 text-sm">
                    <dt className="text-muted-foreground text-xs">Caption</dt>
                    <dd>{post.caption}</dd>
                    <dt className="text-muted-foreground text-xs">Hashtag</dt>
                    <dd>{post.hashtags.join(' ')}</dd>
                    <dt className="text-muted-foreground text-xs">Ngày giờ dự kiến</dt>
                    <dd className="tabular">{formatDateTime(post.scheduledAt)} (giờ VN)</dd>
                  </dl>
                </>
              )}
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {editable ? 'Huỷ' : 'Đóng'}
          </Button>
          {editable ? <Button onClick={save}>Lưu nháp</Button> : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
