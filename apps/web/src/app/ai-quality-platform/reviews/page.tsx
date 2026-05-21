import { redirect } from 'next/navigation';

export default function ReviewsPage() {
  // @author codex: Review work is tied to execution results inside a selected AI application.
  redirect('/ai-quality-platform/apps');
}
