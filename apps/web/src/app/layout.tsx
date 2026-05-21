import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { Toaster } from '@/components/ui';
import './styles.css';

export const metadata: Metadata = {
  title: 'AI 质量平台',
  description: 'AI 应用质量评估平台',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body className={GeistSans.className}>
        {children}
        {/* @author codex: Global toast host keeps feedback consistent across console workflows. */}
        <Toaster />
      </body>
    </html>
  );
}
