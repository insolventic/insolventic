import { Suspense } from 'react';

import { DashboardHeaderClient } from './dashboard-header-client';
import { DashboardHeaderSkeleton } from './dashboard-header-skeleton';

export function DashboardHeader() {
  return (
    <div className="transition-opacity duration-300">
      <Suspense fallback={<DashboardHeaderSkeleton />}>
        <DashboardHeaderClient />
      </Suspense>
    </div>
  );
}
