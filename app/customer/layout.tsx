import React, { Suspense } from 'react';
import { Skeleton } from '@/components/ui/Skeleton';

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 space-y-4">
          <Skeleton className="h-10 w-64 rounded-xl" />
          <Skeleton className="h-32 w-80 rounded-2xl" />
        </div>
      }
    >
      {children}
    </Suspense>
  );
}
