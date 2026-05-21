import { redirect } from 'next/navigation';

export default function ExecutionsPage() {
  // @author codex: Execution history must be viewed under a concrete AI application.
  redirect('/ai-quality-platform/apps');
}
