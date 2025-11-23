import { Bell } from 'lucide-react';
import Image from 'next/image';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export function DashboardHeaderSkeleton() {
  return (
    <header className="border-b border-gray-200 bg-white px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex cursor-pointer items-center space-x-3">
            <Image
              src="/images/insolventic-logo.png"
              alt="INSOLVENTIC Logo"
              width={40}
              height={40}
              className="rounded-full"
            />
            <div>
              <h1 className="text-xl font-bold text-gray-900">INSOLVENTIC</h1>
              <div className="flex items-center space-x-2">
                <Skeleton className="h-4 w-4 rounded-full" />
                <Skeleton className="h-5 w-24" />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-6">
          <div className="hidden items-center space-x-6 lg:flex">
            <Button
              variant="ghost"
              size="sm"
              aria-label="Notificaciones"
              disabled
              className="text-gray-600"
            >
              <Bell className="h-4 w-4" />
            </Button>

            <div className="flex items-center space-x-3 rounded-lg bg-gray-50 px-3 py-2">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex flex-col space-y-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-40" />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-8 w-28" />
            </div>
          </div>

          <div className="flex items-center space-x-3 lg:hidden">
            <Button
              variant="ghost"
              size="sm"
              aria-label="Notificaciones"
              disabled
              className="text-gray-600"
            >
              <Bell className="h-4 w-4" />
            </Button>

            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
        </div>
      </div>
    </header>
  );
}
