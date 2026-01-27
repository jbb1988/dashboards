import { redirect } from 'next/navigation';

export default function WIPDashboardPage() {
  redirect('/operations?tab=wip');
}
