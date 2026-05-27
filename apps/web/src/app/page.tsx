/**
 * 根路径入口
 * @author codex
 */
import { CONTEXT_PATH } from '@ai-quality-platform/shared-config';
import { redirect } from 'next/navigation';

export default function RootPage() {
  redirect(`/${CONTEXT_PATH}`);
}
