import { redirect } from 'next/navigation';

export default function PlansPage() {
  // @author codex: Plans are scoped by appCode and are created from the selected AI application.
  redirect('/ai-quality-platform/apps');
}
