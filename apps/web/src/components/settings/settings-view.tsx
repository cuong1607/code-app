'use client';

import {
  Bot,
  Clapperboard,
  CircleUser,
  HardDrive,
  KeyRound,
  Layers,
  Mic,
  Music2,
  Save,
  Settings,
  SlidersHorizontal,
  Wallet,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { DemoNotice, PageHeader, UnavailableButton } from '@/components/common';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Tabs as TabsPrimitive } from 'radix-ui';
import { cn } from '@/lib/utils';
import {
  AccountSettings,
  BatchSettings,
  CostSettings,
  GeneralSettings,
  ModelSettings,
  ProviderSettings,
  StorageSettings,
  TikTokSettings,
  VideoDefaultSettings,
  VoiceSettings,
} from './settings-sections';

const GROUPS = [
  {
    id: 'general',
    label: 'Cài đặt chung',
    icon: SlidersHorizontal,
    desc: 'Workspace, ngôn ngữ, múi giờ',
    render: GeneralSettings,
  },
  {
    id: 'account',
    label: 'Thông tin tài khoản',
    icon: CircleUser,
    desc: 'Hồ sơ người dùng',
    render: AccountSettings,
  },
  {
    id: 'providers',
    label: 'API Providers',
    icon: KeyRound,
    desc: 'Khoá truy cập dịch vụ AI',
    render: ProviderSettings,
  },
  {
    id: 'models',
    label: 'AI Models',
    icon: Bot,
    desc: 'Mô hình cho từng chức năng',
    render: ModelSettings,
  },
  {
    id: 'voices',
    label: 'Giọng đọc',
    icon: Mic,
    desc: 'Giọng & tốc độ mặc định',
    render: VoiceSettings,
  },
  {
    id: 'video',
    label: 'Video defaults',
    icon: Clapperboard,
    desc: 'Thông số video mặc định',
    render: VideoDefaultSettings,
  },
  {
    id: 'storage',
    label: 'Storage',
    icon: HardDrive,
    desc: 'Lưu trữ file (MinIO/S3)',
    render: StorageSettings,
  },
  {
    id: 'batch',
    label: 'Batch Processing',
    icon: Layers,
    desc: 'Hàng đợi & thử lại',
    render: BatchSettings,
  },
  {
    id: 'cost',
    label: 'Chi phí và ngân sách',
    icon: Wallet,
    desc: 'Giới hạn chi tiêu AI',
    render: CostSettings,
  },
  {
    id: 'tiktok',
    label: 'TikTok Accounts',
    icon: Music2,
    desc: 'Kênh đăng bài',
    render: TikTokSettings,
  },
] as const;

type GroupId = (typeof GROUPS)[number]['id'];

export function SettingsView() {
  const router = useRouter();
  const params = useSearchParams();
  const requested = params.get('tab');
  const active: GroupId = GROUPS.some((g) => g.id === requested)
    ? (requested as GroupId)
    : 'general';

  return (
    <>
      <PageHeader
        title="Cài đặt"
        icon={Settings}
        description="Cấu hình workspace, nhà cung cấp AI, mặc định sản xuất và tích hợp."
      />
      <DemoNotice tone="info">
        Phase 01 chưa có API lưu cài đặt: các thay đổi <strong>không được lưu</strong>. API key thật
        chỉ được cấu hình ở server (biến môi trường), không bao giờ lưu ở trình duyệt.
      </DemoNotice>

      <Tabs
        value={active}
        onValueChange={(v) => router.replace(`/settings?tab=${v}`, { scroll: false })}
        orientation="vertical"
        className="grid gap-4 lg:grid-cols-[15rem_minmax(0,1fr)]"
      >
        <TabsPrimitive.List
          aria-label="Nhóm cài đặt"
          className="scrollbar-thin bg-card flex gap-1 overflow-x-auto rounded-xl border p-1.5 shadow-xs lg:flex-col lg:self-start lg:overflow-visible"
        >
          {GROUPS.map(({ id, label, icon: Icon }) => (
            <TabsPrimitive.Trigger
              key={id}
              value={id}
              className={cn(
                'text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-ring/50 flex shrink-0 cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2',
                'data-[state=active]:bg-sidebar data-[state=active]:text-sidebar-foreground',
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              {label}
            </TabsPrimitive.Trigger>
          ))}
        </TabsPrimitive.List>

        {GROUPS.map(({ id, label, desc, render: Render }) => (
          <TabsContent
            key={id}
            value={id}
            className="bg-card min-w-0 rounded-xl border shadow-xs outline-none"
          >
            <div className="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3.5 sm:px-5">
              <div>
                <h2 className="font-semibold">{label}</h2>
                <p className="text-muted-foreground text-xs">{desc}</p>
              </div>
              <UnavailableButton size="sm" reason="Lưu cài đặt cần API settings – dự kiến Phase 02">
                <Save /> Lưu thay đổi
              </UnavailableButton>
            </div>
            <form className="p-4 sm:p-5" onSubmit={(e) => e.preventDefault()} autoComplete="off">
              <Render />
            </form>
          </TabsContent>
        ))}
      </Tabs>
    </>
  );
}
