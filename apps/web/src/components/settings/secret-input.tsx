'use client';

import { Eye, EyeOff, KeyRound } from 'lucide-react';
import { useId, useState } from 'react';
import { Input } from '@/components/ui/input';

/**
 * Ô nhập API key AN TOÀN.
 * - Không bao giờ có giá trị mặc định / không hiển thị lại key đã lưu.
 * - Tắt autocomplete, spellcheck.
 * - Phase 01: giá trị KHÔNG được gửi đi hay lưu ở đâu (chỉ nằm trong state của ô nhập).
 * - Phase 02+: key sẽ gửi 1 lần lên API và chỉ lưu (mã hoá) ở server.
 */
export function SecretInput({ label, envName }: { label: string; envName: string }) {
  const id = useId();
  const [value, setValue] = useState('');
  const [visible, setVisible] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <div className="relative">
        <KeyRound
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
          aria-hidden
        />
        <Input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Chưa cấu hình"
          autoComplete="off"
          spellCheck={false}
          data-1p-ignore
          data-lpignore="true"
          className="pr-9 pl-8 font-mono text-xs"
          aria-describedby={`${id}-hint`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer rounded p-1"
          aria-label={visible ? 'Ẩn key' : 'Hiện key'}
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      <p id={`${id}-hint`} className="text-muted-foreground text-xs">
        Hiện cấu hình qua biến môi trường server{' '}
        <code className="bg-muted rounded px-1 font-mono">{envName}</code>. Key không bao giờ được
        gửi xuống trình duyệt.
      </p>
    </div>
  );
}
