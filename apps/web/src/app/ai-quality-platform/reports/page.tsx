import { redirect } from 'next/navigation';

export default function ReportsPage() {
  // @author codex: Reports are generated from an app execution batch, not from a global report console.
  redirect('/ai-quality-platform/apps');
}
