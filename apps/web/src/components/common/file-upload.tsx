'use client';

import { UploadCloud } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { toast } from 'sonner';
import { formatBytes } from '@/lib/format';
import { cn } from '@/lib/utils';

export interface LocalFile {
  id: string;
  file: File;
  /** blob: URL để xem trước – chỉ tồn tại trong trình duyệt */
  previewUrl: string;
}

export interface FileUploadProps {
  onFiles: (files: LocalFile[]) => void;
  accept?: string;
  multiple?: boolean;
  maxSizeMb?: number;
  maxFiles?: number;
  label?: string;
  hint?: string;
  compact?: boolean;
  className?: string;
}

/**
 * Vùng chọn/kéo-thả file. Phase 01: file CHỈ được đọc trong trình duyệt để xem trước,
 * CHƯA tải lên MinIO (sẽ làm bằng presigned URL ở Phase 02).
 */
export function FileUpload({
  onFiles,
  accept = 'image/png,image/jpeg,image/webp',
  multiple = true,
  maxSizeMb = 10,
  maxFiles = 10,
  label = 'Kéo thả ảnh vào đây hoặc bấm để chọn',
  hint,
  compact = false,
  className,
}: FileUploadProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const acceptList = accept.split(',').map((t) => t.trim());

  const handle = (list: FileList | null) => {
    if (!list?.length) return;
    const files = Array.from(list).slice(0, maxFiles);
    const accepted: LocalFile[] = [];
    const rejected: string[] = [];
    for (const file of files) {
      if (
        !acceptList.some(
          (type) =>
            file.type === type || (type.endsWith('/*') && file.type.startsWith(type.slice(0, -1))),
        )
      ) {
        rejected.push(`${file.name}: định dạng không hỗ trợ`);
      } else if (file.size > maxSizeMb * 1024 * 1024) {
        rejected.push(`${file.name}: vượt quá ${maxSizeMb} MB (${formatBytes(file.size)})`);
      } else {
        accepted.push({
          id: `${file.name}-${file.size}-${file.lastModified}`,
          file,
          previewUrl: URL.createObjectURL(file),
        });
      }
    }
    if (list.length > maxFiles) rejected.push(`Chỉ nhận tối đa ${maxFiles} file mỗi lần`);
    if (rejected.length)
      toast.error('Một số file không được chọn', { description: rejected.join('\n') });
    if (accepted.length) onFiles(accepted);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <label
      htmlFor={inputId}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        handle(e.dataTransfer.files);
      }}
      className={cn(
        'border-input hover:border-primary/60 hover:bg-primary/5 focus-within:ring-ring/40 flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed text-center transition-colors focus-within:ring-[3px]',
        compact ? 'px-3 py-3' : 'px-4 py-6',
        dragging && 'border-primary bg-primary/10',
        className,
      )}
    >
      <UploadCloud
        className={cn('text-muted-foreground', compact ? 'size-5' : 'size-7')}
        aria-hidden
      />
      <span className="text-sm font-medium">{label}</span>
      <span className="text-muted-foreground text-xs">
        {hint ?? `PNG, JPG, WEBP · tối đa ${maxSizeMb} MB · chỉ xem trước, chưa tải lên máy chủ`}
      </span>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={accept}
        multiple={multiple}
        className="sr-only"
        onChange={(e) => handle(e.target.files)}
      />
    </label>
  );
}
