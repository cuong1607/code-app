'use client';

import { Toaster } from 'sonner';
import { TooltipProvider } from '@/components/ui/tooltip';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider delayDuration={250} skipDelayDuration={100}>
      {children}
      <Toaster
        position="top-right"
        richColors
        closeButton
        toastOptions={{ className: 'font-sans', style: { whiteSpace: 'pre-line' } }}
      />
    </TooltipProvider>
  );
}
