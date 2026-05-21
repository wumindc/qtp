import type { ReactNode } from 'react';
import { PlatformLayout as PlatformLayoutShell } from '../../components/platform-layout';

export default function PlatformLayout({ children }: { children: ReactNode }) {
  return <PlatformLayoutShell>{children}</PlatformLayoutShell>;
}
