import type { Metadata, Viewport } from 'next';
import { Be_Vietnam_Pro } from 'next/font/google';
import { APP_NAME } from '@acs/shared';
import { Providers } from '@/components/providers';
import './globals.css';

// Font thiết kế cho tiếng Việt (dấu hiển thị chuẩn ở mọi cỡ chữ)
const beVietnam = Be_Vietnam_Pro({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-be-vietnam',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: 'Hệ thống sản xuất nội dung video sản phẩm tự động bằng AI',
};

export const viewport: Viewport = {
  themeColor: '#1f1a17',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" className={beVietnam.variable}>
      <body className="min-h-dvh font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
