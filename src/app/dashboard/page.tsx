import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { verifyToken } from '@/lib/auth';

import { DashboardHeader } from './components/dashboard-header';
import { NotificationPanel } from './components/notification-panel';
import { RecentCases } from './components/recent-cases';
import { TaskSelector } from './components/task-selector';

export default async function DashboardPage() {
  // Verify authentication server-side before rendering
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('access-token')?.value;

  if (!accessToken) {
    redirect('/login?redirect=/dashboard');
  }

  const payload = await verifyToken(accessToken);
  if (!payload) {
    redirect('/login?redirect=/dashboard');
  }

  return (
    <div className="bg-background min-h-screen">
      <DashboardHeader />

      <main className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          <div className="space-y-6 lg:col-span-3">
            <TaskSelector />
            <RecentCases />
          </div>

          <div className="lg:col-span-1">
            <NotificationPanel />
          </div>
        </div>
      </main>
    </div>
  );
}
